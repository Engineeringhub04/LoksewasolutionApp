// App usage tracking — "app focus" for the main leaderboard.
//
// Two numbers are accumulated per user:
//   • foregroundSeconds — how long the app was actually open and in front of the
//     user. Measured by an AppState listener: the clock starts on 'active' and
//     stops on 'background'/'inactive'.
//   • activityCount     — how many meaningful things the user finished (a quiz
//     submitted, a chapter read, a topic practised). Recorded by callers.
//
// Both exist because the leaderboard tiebreak is two-level: equal PTS and equal
// % is broken by who uses the app more (foreground time), and an exact tie there
// falls through to activity count.
//
// Writes are BUFFERED in AsyncStorage and flushed to Firestore at most once every
// FLUSH_INTERVAL_MS. Without this, a user who switches apps ten times a minute
// would issue ten writes a minute — on the Spark plan that burns the daily quota
// for no benefit, since nothing reads this value in real time.
import { AppState, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDocument, increment, serverTimestamp, setDocument } from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';

/** Single document under the per-user usage collection. */
const SUMMARY_DOC = 'summary';

const usagePath = (uid: string) => `${Collections.appUsage(uid)}/${SUMMARY_DOC}`;
const bufferKey = (uid: string) => `@loksewa/app-usage/pending/${uid}`;

/** Don't write to Firestore more often than this. */
const FLUSH_INTERVAL_MS = 5 * 60 * 1000;
/**
 * A single stretch longer than this is almost certainly the app sitting open in
 * a pocket or on a dead screen, not study time. Capping it keeps the leaderboard
 * honest — otherwise leaving the app open overnight would outrank real work.
 */
const MAX_SESSION_SECONDS = 2 * 60 * 60;
/** Below this a "session" is just a bounce through the app; ignore it. */
const MIN_SESSION_SECONDS = 3;

export interface AppUsageSummary {
  foregroundSeconds: number;
  sessionCount: number;
  activityCount: number;
}

export const EMPTY_USAGE: AppUsageSummary = { foregroundSeconds: 0, sessionCount: 0, activityCount: 0 };

interface PendingUsage {
  seconds: number;
  sessions: number;
  activities: number;
  lastFlushMs: number;
}

const EMPTY_PENDING: PendingUsage = { seconds: 0, sessions: 0, activities: 0, lastFlushMs: 0 };

// ---------- module state ----------

let currentUid: string | null = null;
let activeSinceMs: number | null = null;
let subscription: { remove: () => void } | null = null;

async function readPending(uid: string): Promise<PendingUsage> {
  try {
    const raw = await AsyncStorage.getItem(bufferKey(uid));
    if (!raw) return { ...EMPTY_PENDING };
    const parsed = JSON.parse(raw) as Partial<PendingUsage>;
    return {
      seconds: Number(parsed.seconds ?? 0),
      sessions: Number(parsed.sessions ?? 0),
      activities: Number(parsed.activities ?? 0),
      lastFlushMs: Number(parsed.lastFlushMs ?? 0),
    };
  } catch {
    return { ...EMPTY_PENDING };
  }
}

async function writePending(uid: string, pending: PendingUsage): Promise<void> {
  try {
    await AsyncStorage.setItem(bufferKey(uid), JSON.stringify(pending));
  } catch {
    // A failed buffer write costs a few seconds of credit, never an error to the user.
  }
}

/**
 * Pushes the buffer to Firestore if enough time has passed (or `force`).
 * Uses increment() so two devices signed into the same account both count,
 * instead of one overwriting the other's total.
 */
async function flush(uid: string, options: { force?: boolean } = {}): Promise<void> {
  const pending = await readPending(uid);
  const hasSomething = pending.seconds > 0 || pending.sessions > 0 || pending.activities > 0;
  if (!hasSomething) return;

  const due = Date.now() - pending.lastFlushMs >= FLUSH_INTERVAL_MS;
  if (!options.force && !due) return;

  try {
    await setDocument(
      usagePath(uid),
      {
        foregroundSeconds: increment(Math.round(pending.seconds)),
        sessionCount: increment(pending.sessions),
        activityCount: increment(pending.activities),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    await writePending(uid, { ...EMPTY_PENDING, lastFlushMs: Date.now() });
  } catch {
    // Keep the buffer so the next flush retries it. Deliberately silent: usage
    // tracking must never surface an error to someone just using the app.
  }
}

/** Adds a finished stretch of foreground time to the buffer. */
async function bankSession(uid: string, seconds: number): Promise<void> {
  const clamped = Math.min(MAX_SESSION_SECONDS, Math.max(0, Math.round(seconds)));
  if (clamped < MIN_SESSION_SECONDS) return;
  const pending = await readPending(uid);
  await writePending(uid, {
    ...pending,
    seconds: pending.seconds + clamped,
    sessions: pending.sessions + 1,
  });
}

/**
 * Starts tracking for a user. Safe to call repeatedly with the same uid.
 * Call from the root layout once the session is known.
 */
export function startAppUsageTracking(uid: string): void {
  if (!uid) return;
  if (currentUid === uid && subscription) return;

  // Switching accounts: close the outgoing user's open stretch first.
  if (currentUid && currentUid !== uid) void stopAppUsageTracking();

  currentUid = uid;
  activeSinceMs = AppState.currentState === 'active' ? Date.now() : null;

  subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
    const uidAtEvent = currentUid;
    if (!uidAtEvent) return;

    if (next === 'active') {
      activeSinceMs = Date.now();
      return;
    }

    // 'background' or 'inactive' — close the open stretch.
    if (activeSinceMs !== null) {
      const seconds = (Date.now() - activeSinceMs) / 1000;
      activeSinceMs = null;
      void bankSession(uidAtEvent, seconds).then(() => flush(uidAtEvent, { force: true }));
    }
  });
}

/** Stops tracking and banks whatever is open. Call on sign-out. */
export async function stopAppUsageTracking(): Promise<void> {
  const uid = currentUid;
  subscription?.remove();
  subscription = null;
  currentUid = null;

  if (uid && activeSinceMs !== null) {
    const seconds = (Date.now() - activeSinceMs) / 1000;
    activeSinceMs = null;
    await bankSession(uid, seconds);
    await flush(uid, { force: true });
  }
}

/**
 * Records one completed activity (a quiz submitted, a chapter read...). Cheap —
 * it only touches AsyncStorage; the Firestore write happens on the next flush.
 */
export async function recordAppActivity(uid: string, count = 1): Promise<void> {
  if (!uid || count <= 0) return;
  const pending = await readPending(uid);
  await writePending(uid, { ...pending, activities: pending.activities + count });
  await flush(uid);
}

/**
 * Current totals = what Firestore holds plus whatever is still buffered locally,
 * including the stretch happening right now. Without folding those in, a user who
 * opens the leaderboard during their first session would see a flat zero.
 */
export async function fetchAppUsage(uid: string): Promise<AppUsageSummary> {
  if (!uid) return { ...EMPTY_USAGE };

  const [doc, pending] = await Promise.all([
    getDocument(usagePath(uid)).catch(() => null),
    readPending(uid),
  ]);

  const openSeconds = currentUid === uid && activeSinceMs !== null
    ? Math.min(MAX_SESSION_SECONDS, (Date.now() - activeSinceMs) / 1000)
    : 0;

  return {
    foregroundSeconds: Number(doc?.foregroundSeconds ?? 0) + pending.seconds + Math.round(openSeconds),
    sessionCount: Number(doc?.sessionCount ?? 0) + pending.sessions,
    activityCount: Number(doc?.activityCount ?? 0) + pending.activities,
  };
}

/** Forces a flush — used right before publishing a leaderboard score. */
export async function flushAppUsage(uid: string): Promise<void> {
  if (!uid) return;
  // Bank the in-flight stretch too, so a score published mid-session counts it.
  if (currentUid === uid && activeSinceMs !== null) {
    const seconds = (Date.now() - activeSinceMs) / 1000;
    activeSinceMs = Date.now();
    await bankSession(uid, seconds);
  }
  await flush(uid, { force: true });
}
