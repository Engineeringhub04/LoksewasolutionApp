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

function statePath(uid: string): string {
  return `${Collections.users}/${uid}/qotd/state`;
}

export async function fetchQuestionOfTheDay(uid: string, pickQuestion: () => Promise<Question | null>): Promise<QotdState> {
  const question = await pickQuestion();
  const data = await getDocument(statePath(uid));

  const answeredToday = data?.lastAnsweredDate === todayKey();
  return {
    question,
    answeredIndex: answeredToday ? ((data?.answeredIndex as number | null) ?? null) : null,
    streak: (data?.streak as number) ?? 0,
  };
}

export async function submitQotdAnswer(uid: string, selectedIndex: number, currentStreak: number): Promise<number> {
  const data = await getDocument(statePath(uid));
  const lastDate = data?.lastAnsweredDate as string | undefined;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const wasYesterday = lastDate === yesterday.toISOString().slice(0, 10);

  const nextStreak = wasYesterday ? currentStreak + 1 : 1;

  await setDocument(
    statePath(uid),
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
