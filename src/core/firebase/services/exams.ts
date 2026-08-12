// Mock Test / Live Exam / Attempt services (PRD §47.3, §47.6). Attempts are
// written under users/{uid}/attempts so history/results are user-scoped.
import { getDocument, listDocuments, runQuery, createDocument, serverTimestamp, type FirestoreTimestamp } from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';
import type { Question } from './questions';

export interface ExamDefinition {
  id: string;
  title: string;
  questionIds: string[];
  durationMinutes: number;
  markingScheme: string;
  scheduledStart?: FirestoreTimestamp;
}

export interface AttemptAnswer {
  questionId: string;
  selectedIndex: number | null;
  flagged: boolean;
}

export interface AttemptResult {
  id: string;
  examId: string;
  examTitle: string;
  answers: AttemptAnswer[];
  score: number;
  totalMarks: number;
  correctCount: number;
  incorrectCount: number;
  unattemptedCount: number;
  timeTakenSeconds: number;
  submittedAt: FirestoreTimestamp;
}

export async function fetchMockTests(): Promise<ExamDefinition[]> {
  return (await listDocuments(Collections.mockTests)) as unknown as ExamDefinition[];
}

export async function fetchMockTest(id: string): Promise<ExamDefinition | null> {
  return (await getDocument(`${Collections.mockTests}/${id}`)) as ExamDefinition | null;
}

export async function fetchLiveExams(): Promise<ExamDefinition[]> {
  return (await listDocuments(Collections.liveExams)) as unknown as ExamDefinition[];
}

export async function fetchLiveExam(id: string): Promise<ExamDefinition | null> {
  return (await getDocument(`${Collections.liveExams}/${id}`)) as ExamDefinition | null;
}

export async function fetchQuestionsByIds(ids: string[]): Promise<Question[]> {
  const results = await Promise.all(
    ids.map(async (id) => (await getDocument(`${Collections.questions}/${id}`)) as Question | null)
  );
  return results.filter((q): q is Question => q !== null);
}

export function scoreAttempt(
  questions: Question[],
  answers: AttemptAnswer[]
): { score: number; totalMarks: number; correctCount: number; incorrectCount: number; unattemptedCount: number } {
  let correctCount = 0;
  let incorrectCount = 0;
  let unattemptedCount = 0;

  for (const q of questions) {
    const answer = answers.find((a) => a.questionId === q.id);
    if (!answer || answer.selectedIndex === null) {
      unattemptedCount++;
    } else if (answer.selectedIndex === q.correctIndex) {
      correctCount++;
    } else {
      incorrectCount++;
    }
  }

  const score = correctCount - incorrectCount * 0.25;
  return { score: Math.max(0, Math.round(score * 100) / 100), totalMarks: questions.length, correctCount, incorrectCount, unattemptedCount };
}

export async function submitAttempt(
  uid: string,
  examId: string,
  examTitle: string,
  questions: Question[],
  answers: AttemptAnswer[],
  timeTakenSeconds: number
): Promise<string> {
  const { score, totalMarks, correctCount, incorrectCount, unattemptedCount } = scoreAttempt(questions, answers);
  const { id } = await createDocument(`${Collections.users}/${uid}/attempts`, {
    examId,
    examTitle,
    answers,
    score,
    totalMarks,
    correctCount,
    incorrectCount,
    unattemptedCount,
    timeTakenSeconds,
    submittedAt: serverTimestamp(),
  });
  return id;
}

export async function fetchAttempt(uid: string, attemptId: string): Promise<AttemptResult | null> {
  return (await getDocument(`${Collections.users}/${uid}/attempts/${attemptId}`)) as AttemptResult | null;
}

export async function fetchAttemptHistory(uid: string, max = 50): Promise<AttemptResult[]> {
  return (await runQuery(`${Collections.users}/${uid}/attempts`, {
    orderBy: [{ field: 'submittedAt', direction: 'desc' }],
    limit: max,
  })) as unknown as AttemptResult[];
}
