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

export async function fetchQuestionOfTheDay(
  uid: string,
  pickQuestion: () => Promise<Question | null>,
  courseId?: string | null
): Promise<QotdState> {
  const question = await pickQuestion();
  const data = await getDocument(statePath(uid, courseId));

  const answeredToday = data?.lastAnsweredDate === todayKey();
  return {
    question,
    answeredIndex: answeredToday ? ((data?.answeredIndex as number | null) ?? null) : null,
    streak: (data?.streak as number) ?? 0,
  };
}

/** Quick check used by Home — no question fetch, just whether today's is already answered. */
export async function hasAnsweredQotdToday(uid: string, courseId?: string | null): Promise<boolean> {
  const data = await getDocument(statePath(uid, courseId));
  return data?.lastAnsweredDate === todayKey();
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
