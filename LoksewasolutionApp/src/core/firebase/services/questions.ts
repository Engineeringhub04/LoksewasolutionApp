// Question Bank (PRD §47.3): filtered by subject/chapter/difficulty for Quiz Practice.
import { runQuery } from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';

export interface Question {
  id: string;
  subjectId: string;
  chapterId: string | null;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export async function fetchQuestionsBySubject(subjectId: string, max = 50): Promise<Question[]> {
  return (await runQuery(Collections.questions, {
    where: [{ field: 'subjectId', op: '==', value: subjectId }],
    limit: max,
  })) as unknown as Question[];
}

export async function fetchAllQuestions(max = 200): Promise<Question[]> {
  return (await runQuery(Collections.questions, { limit: max })) as unknown as Question[];
}

export async function fetchRandomQuestion(): Promise<Question | null> {
  const all = await fetchAllQuestions();
  if (all.length === 0) return null;
  return all[Math.floor(Math.random() * all.length)];
}
