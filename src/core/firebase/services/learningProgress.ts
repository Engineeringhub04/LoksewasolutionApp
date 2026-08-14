import {
  getDocument,
  serverTimestamp,
  setDocument,
} from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';

export type LearningMode = 'practice' | 'read' | 'theory';

export interface LearningProgress {
  id: string;
  subjectId: string;
  unitId: string | null;
  chapterId: string;
  attemptedQuestionIds: string[];
  correctQuestionIds: string[];
  bookmarked: boolean;
  completed: boolean;
  lastMode: LearningMode;
  dailyDate?: string | null;
  dailyQuestionIds?: string[];
  dailyAttemptedQuestionIds?: string[];
  dailyCorrectQuestionIds?: string[];
  updatedAt?: { toMillis?: () => number } | string | null;
}

function progressId(subjectId: string, chapterId: string): string {
  return `${subjectId}__${chapterId}`.replace(/[^A-Za-z0-9_-]/g, '_');
}

function progressPath(uid: string, subjectId: string, chapterId: string): string {
  return `${Collections.learningProgress(uid)}/${progressId(subjectId, chapterId)}`;
}

export async function fetchLearningProgress(
  uid: string,
  subjectId: string,
  chapterId: string,
): Promise<LearningProgress | null> {
  const document = await getDocument(progressPath(uid, subjectId, chapterId));
  if (!document) return null;
  return {
    id: String(document.id),
    subjectId: String(document.subjectId ?? subjectId),
    unitId: typeof document.unitId === 'string' ? document.unitId : null,
    chapterId: String(document.chapterId ?? chapterId),
    attemptedQuestionIds: Array.isArray(document.attemptedQuestionIds)
      ? document.attemptedQuestionIds.filter((value): value is string => typeof value === 'string')
      : [],
    correctQuestionIds: Array.isArray(document.correctQuestionIds)
      ? document.correctQuestionIds.filter((value): value is string => typeof value === 'string')
      : [],
    bookmarked: document.bookmarked === true,
    completed: document.completed === true,
    lastMode: document.lastMode === 'read' || document.lastMode === 'theory' ? document.lastMode : 'practice',
    dailyDate: typeof document.dailyDate === 'string' ? document.dailyDate : null,
    dailyQuestionIds: Array.isArray(document.dailyQuestionIds)
      ? document.dailyQuestionIds.filter((value): value is string => typeof value === 'string')
      : [],
    dailyAttemptedQuestionIds: Array.isArray(document.dailyAttemptedQuestionIds)
      ? document.dailyAttemptedQuestionIds.filter((value): value is string => typeof value === 'string')
      : [],
    dailyCorrectQuestionIds: Array.isArray(document.dailyCorrectQuestionIds)
      ? document.dailyCorrectQuestionIds.filter((value): value is string => typeof value === 'string')
      : [],
    updatedAt: (document.updatedAt as LearningProgress['updatedAt']) ?? null,
  };
}

export async function saveLearningProgress(
  uid: string,
  input: {
    subjectId: string;
    unitId?: string | null;
    chapterId: string;
    attemptedQuestionIds?: string[];
    correctQuestionIds?: string[];
    bookmarked?: boolean;
    completed?: boolean;
    lastMode?: LearningMode;
    dailyDate?: string | null;
    dailyQuestionIds?: string[];
    dailyAttemptedQuestionIds?: string[];
    dailyCorrectQuestionIds?: string[];
  },
): Promise<void> {
  await setDocument(
    progressPath(uid, input.subjectId, input.chapterId),
    {
      subjectId: input.subjectId,
      unitId: input.unitId ?? null,
      chapterId: input.chapterId,
      attemptedQuestionIds: input.attemptedQuestionIds ?? [],
      correctQuestionIds: input.correctQuestionIds ?? [],
      bookmarked: input.bookmarked ?? false,
      completed: input.completed ?? false,
      lastMode: input.lastMode ?? 'practice',
      ...(input.dailyDate !== undefined ? { dailyDate: input.dailyDate } : {}),
      ...(input.dailyQuestionIds !== undefined ? { dailyQuestionIds: input.dailyQuestionIds } : {}),
      ...(input.dailyAttemptedQuestionIds !== undefined ? { dailyAttemptedQuestionIds: input.dailyAttemptedQuestionIds } : {}),
      ...(input.dailyCorrectQuestionIds !== undefined ? { dailyCorrectQuestionIds: input.dailyCorrectQuestionIds } : {}),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function markLearningChapterComplete(
  uid: string,
  input: { subjectId: string; unitId?: string | null; chapterId: string; lastMode?: LearningMode },
): Promise<void> {
  await saveLearningProgress(uid, { ...input, completed: true });
}
