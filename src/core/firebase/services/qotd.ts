// Question of the Day (PRD §23) + streak tracking, persisted per-user under users/{uid}/qotd.
import { getDocument, setDocument, serverTimestamp } from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';
import type { Question } from './questions';

export interface QotdState {
  question: Question | null;
  answeredIndex: number | null;
  streak: number;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// Scoped per-course: a user can answer once per day PER course they're enrolled in.
function statePath(uid: string, courseId?: string | null): string {
  const suffix = courseId ? `state-${courseId}` : 'state';
  return `${Collections.users}/${uid}/qotd/${suffix}`;
}

// ---------- Module-level cache with a stale window ----------
//
// Home renders this state on every mount, focus return, and pull-to-refresh.
// Caching the per-day state for a minute prevents the same qotd document from
// being read repeatedly as the user moves between tabs.

const QOTD_STALE_MS = 60 * 1000;

const qotdStateCache = new Map<string, { data: Record<string, unknown> | null; cachedAt: number }>();
const qotdStateInFlight = new Map<string, Promise<Record<string, unknown> | null>>();

function qotdKey(uid: string, courseId?: string | null): string {
  return `${uid}__${courseId ?? ''}__${todayKey()}`;
}

function fetchQotdState(uid: string, courseId?: string | null): Promise<Record<string, unknown> | null> {
  const key = qotdKey(uid, courseId);
  const entry = qotdStateCache.get(key);
  if (entry && Date.now() - entry.cachedAt < QOTD_STALE_MS) {
    return Promise.resolve(entry.data);
  }
  const inFlight = qotdStateInFlight.get(key);
  if (inFlight) return inFlight;

  const request = getDocument(statePath(uid, courseId))
    .then((data) => {
      qotdStateCache.set(key, { data, cachedAt: Date.now() });
      return data;
    })
    .finally(() => {
      qotdStateInFlight.delete(key);
    });

  qotdStateInFlight.set(key, request);
  return request;
}

function invalidateQotdCache(uid: string, courseId?: string | null): void {
  qotdStateCache.delete(qotdKey(uid, courseId));
}

export async function fetchQuestionOfTheDay(
  uid: string,
  pickQuestion: () => Promise<Question | null>,
  courseId?: string | null
): Promise<QotdState> {
  const [question, data] = await Promise.all([pickQuestion(), fetchQotdState(uid, courseId)]);

  const answeredToday = data?.lastAnsweredDate === todayKey();
  return {
    question,
    answeredIndex: answeredToday ? ((data?.answeredIndex as number | null) ?? null) : null,
    streak: (data?.streak as number) ?? 0,
  };
}

/** Quick check used by Home — no question fetch, just whether today's is already answered. */
export async function hasAnsweredQotdToday(uid: string, courseId?: string | null): Promise<boolean> {
  const data = await fetchQotdState(uid, courseId);
  return data?.lastAnsweredDate === todayKey();
}

export function invalidateQotdStateCache(uid: string, courseId?: string | null): void {
  invalidateQotdCache(uid, courseId);
}

export async function submitQotdAnswer(
  uid: string,
  selectedIndex: number,
  currentStreak: number,
  courseId?: string | null
): Promise<number> {
  const data = await getDocument(statePath(uid, courseId));
  const lastDate = data?.lastAnsweredDate as string | undefined;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const wasYesterday = lastDate === yesterday.toISOString().slice(0, 10);

  const nextStreak = wasYesterday ? currentStreak + 1 : 1;

  // Keep the cached read state fresh for subsequent Home refreshes.
  invalidateQotdCache(uid, courseId);

  await setDocument(
    statePath(uid, courseId),
    {
      lastAnsweredDate: todayKey(),
      answeredIndex: selectedIndex,
      streak: nextStreak,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return nextStreak;
}
