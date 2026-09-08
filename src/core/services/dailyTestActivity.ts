// On-device Daily Test activity log.
//
// The Daily Test landing screen shows a short "Your History" list. Per the
// feature design this history is kept ON THE DEVICE ONLY (AsyncStorage), not in
// Firestore — it's a lightweight convenience list, so there's no reason to spend
// reads/writes on it. The authoritative full result still goes to the user's
// Firestore subcollection via saveDailyTestResult(); this is purely the local
// "what did I just do" feed.
//
// PER-ACCOUNT: the log is stored under a uid-scoped key, so two accounts sharing
// one phone each see only their own attempts. Without a uid (signed out) nothing
// is read or written at all — that avoids an anonymous bucket leaking into the
// next account that signs in.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = '@loksewa/daily-test/recent-activities';
/** Pre-scoping key. Data in it can't be attributed to an account, so it is dropped. */
const LEGACY_KEY = KEY_PREFIX;
const MAX_ENTRIES = 20;

/** Storage key for one account, or null when there is no signed-in user. */
function storageKey(uid: string | null | undefined): string | null {
  return uid ? `${KEY_PREFIX}/${uid}` : null;
}

export interface DailyTestActivity {
  /** Firestore result id when available, else a local fallback id. */
  id: string;
  modelId: string;
  modelName: string;
  score: number;
  totalQuestions: number;
  correct: number;
  incorrect: number;
  skipped: number;
  timeTakenSeconds: number;
  /** Epoch millis at the moment the attempt finished (device clock). */
  completedAt: number;
  /**
   * The answer sheet as submitted (option index per question, -1 = skipped).
   * Stored so tapping a history card can reopen the Summary — and from there the
   * Review page — without re-reading the result from Firestore.
   */
  answers?: number[];
  /** Whether the attempt cleared the model's pass mark. */
  passed?: boolean;
  /** The model's pass mark at the time of the attempt, for the pass/fail label. */
  passPercent?: number;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asAnswers(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((entry) => asNumber(entry, -1));
}

function activityFromRaw(raw: unknown): DailyTestActivity | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const modelId = asString(r.modelId);
  if (!modelId) return null;
  return {
    id: asString(r.id, `${modelId}-${asNumber(r.completedAt)}`),
    modelId,
    modelName: asString(r.modelName),
    score: asNumber(r.score),
    totalQuestions: asNumber(r.totalQuestions),
    correct: asNumber(r.correct),
    incorrect: asNumber(r.incorrect),
    skipped: asNumber(r.skipped),
    timeTakenSeconds: asNumber(r.timeTakenSeconds),
    completedAt: asNumber(r.completedAt),
    answers: asAnswers(r.answers),
    passed: typeof r.passed === 'boolean' ? r.passed : undefined,
    passPercent: typeof r.passPercent === 'number' ? asNumber(r.passPercent) : undefined,
  };
}

/** Reads one account's feed, newest first. Never throws. */
export async function getRecentDailyTestActivities(
  uid: string | null | undefined,
): Promise<DailyTestActivity[]> {
  const key = storageKey(uid);
  if (!key) return [];
  try {
    // One-time cleanup of the old shared (un-scoped) bucket.
    void AsyncStorage.removeItem(LEGACY_KEY).catch(() => undefined);
    const value = await AsyncStorage.getItem(key);
    if (!value) return [];
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(activityFromRaw)
      .filter((a): a is DailyTestActivity => a !== null)
      .sort((a, b) => b.completedAt - a.completedAt);
  } catch {
    return [];
  }
}

/**
 * Prepends a finished attempt to the signed-in account's feed, de-duplicating by
 * modelId so a re-attempt of the same model replaces its earlier entry, and caps
 * the list at MAX_ENTRIES. Returns the updated list (newest first). Never throws.
 */
export async function addDailyTestActivity(
  uid: string | null | undefined,
  activity: DailyTestActivity,
): Promise<DailyTestActivity[]> {
  const key = storageKey(uid);
  if (!key) return [];
  try {
    const existing = await getRecentDailyTestActivities(uid);
    const deduped = existing.filter((a) => a.modelId !== activity.modelId);
    const next = [activity, ...deduped]
      .sort((a, b) => b.completedAt - a.completedAt)
      .slice(0, MAX_ENTRIES);
    await AsyncStorage.setItem(key, JSON.stringify(next));
    return next;
  } catch {
    return getRecentDailyTestActivities(uid);
  }
}

/**
 * The local record for one model, or null. Used by the landing carousel to badge
 * a completed card with its score, and by the Summary screen to rehydrate an
 * attempt opened from the history list.
 */
export async function getDailyTestActivity(
  uid: string | null | undefined,
  modelId: string,
): Promise<DailyTestActivity | null> {
  if (!modelId) return null;
  const activities = await getRecentDailyTestActivities(uid);
  return activities.find((a) => a.modelId === modelId) ?? null;
}

/** True if this account has a local record of completing the given model. */
export async function hasCompletedDailyTestLocally(
  uid: string | null | undefined,
  modelId: string,
): Promise<boolean> {
  if (!modelId) return false;
  const activities = await getRecentDailyTestActivities(uid);
  return activities.some((a) => a.modelId === modelId);
}

/** Clears one account's local feed. Never throws. */
export async function clearDailyTestActivities(
  uid: string | null | undefined,
): Promise<void> {
  const key = storageKey(uid);
  if (!key) return;
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Ignore — clearing a convenience cache must never surface an error.
  }
}
