import {
  getDocument,
  runQuery,
  serverTimestamp,
  setDocument,
} from '@/src/core/firebase/firestoreRest';
import { fetchPracticeQuestionSet } from '@/src/core/firebase/services/learningContent';
import { Collections } from '@/src/core/firebase/collections';

export type LearningMode = 'practice' | 'read' | 'theory';

export interface LearningProgress {
  id: string;
  subjectId: string;
  unitId: string | null;
  chapterId: string;
  attemptedQuestionIds: string[];
  correctQuestionIds: string[];
  selectedAnswerIndexes: Record<string, number>;
  totalQuestions: number;
  bookmarked: boolean;
  completed: boolean;
  lastMode: LearningMode;
  dailyDate?: string | null;
  dailyQuestionIds?: string[];
  dailyAttemptedQuestionIds?: string[];
  dailyCorrectQuestionIds?: string[];
  updatedAt?: { toMillis?: () => number } | string | null;
}

function normalizeLogicalId(value: string): string {
  const parts = value.split('__').filter(Boolean);
  const logicalPart = parts[parts.length - 1] ?? value;
  return logicalPart
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function canonicalSubjectId(subjectId: string): string {
  return normalizeLogicalId(subjectId);
}

function canonicalChapterId(chapterId: string): string {
  return normalizeLogicalId(chapterId);
}

function canonicalUnitId(unitId: string | null | undefined): string | null {
  return unitId ? normalizeLogicalId(unitId) : null;
}

function progressId(subjectId: string, chapterId: string): string {
  return `${canonicalSubjectId(subjectId)}__${canonicalChapterId(chapterId)}`.replace(/[^A-Za-z0-9_-]/g, '_');
}

function progressPath(uid: string, subjectId: string, chapterId: string): string {
  return `${Collections.learningProgress(uid)}/${progressId(subjectId, chapterId)}`;
}

function learningProgressFromDocument(
  document: Record<string, unknown>,
  fallbackSubjectId = '',
  fallbackChapterId = '',
): LearningProgress {
  const normalizedSubjectId = canonicalSubjectId(String(document.subjectId ?? fallbackSubjectId));
  const normalizedChapterId = canonicalChapterId(String(document.chapterId ?? fallbackChapterId));
  return {
    id: String(document.id ?? progressId(normalizedSubjectId, normalizedChapterId)),
    subjectId: normalizedSubjectId,
    unitId: typeof document.unitId === 'string' ? canonicalUnitId(document.unitId) : null,
    chapterId: normalizedChapterId,
    attemptedQuestionIds: Array.isArray(document.attemptedQuestionIds)
      ? document.attemptedQuestionIds.filter((value): value is string => typeof value === 'string')
      : [],
    selectedAnswerIndexes: document.selectedAnswerIndexes && typeof document.selectedAnswerIndexes === 'object'
      ? Object.fromEntries(Object.entries(document.selectedAnswerIndexes).filter(([, value]) => typeof value === 'number')) as Record<string, number>
      : {},
    totalQuestions: typeof document.totalQuestions === 'number' ? Math.max(0, document.totalQuestions) : 0,
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

export async function fetchLearningProgress(
  uid: string,
  subjectId: string,
  chapterId: string,
): Promise<LearningProgress | null> {
  const normalizedSubjectId = canonicalSubjectId(subjectId);
  const normalizedChapterId = canonicalChapterId(chapterId);
  const document = await getDocument(progressPath(uid, normalizedSubjectId, normalizedChapterId));
  if (!document) return null;
  return learningProgressFromDocument(document, normalizedSubjectId, normalizedChapterId);
}

export type SubjectLearningStats = {
  complete: number;
  inProgress: number;
};

/**
 * Reads only progress documents for the requested subjects, then refreshes the
 * denominator from the current practice question-set document for chapters that
 * already have progress. This keeps the subject summary accurate when a set
 * grows from the original seed size without scanning every question document.
 */
export async function fetchSubjectLearningStats(params: {
  uid: string;
  courseId: string;
  subcourseId: string;
  subjectIds: string[];
}): Promise<SubjectLearningStats> {
  const subjectIds = [...new Set(params.subjectIds.map(canonicalSubjectId).filter(Boolean))];
  if (!subjectIds.length) return { complete: 0, inProgress: 0 };

  const documents = await runQuery(Collections.learningProgress(params.uid), {
    where: [{ field: 'subjectId', op: 'in', value: subjectIds }],
  });

  const progressEntries = documents.map((document) => learningProgressFromDocument(document));
  const refreshed = await Promise.all(progressEntries.map(async (progress) => {
    let currentTotal = progress.totalQuestions;
    try {
      const questions = await fetchPracticeQuestionSet({
        courseId: params.courseId,
        subcourseId: params.subcourseId,
        subjectId: progress.subjectId,
        unitId: progress.unitId,
        chapterId: progress.chapterId,
      });
      if (questions.length > 0) currentTotal = questions.length;
    } catch {
      // Keep the persisted denominator when current content is unavailable.
    }
    return { progress, currentTotal };
  }));

  return refreshed.reduce<SubjectLearningStats>((stats, { progress, currentTotal }) => {
    const attempted = progress.attemptedQuestionIds.length;
    const percentage = currentTotal > 0
      ? Math.min(100, Math.round((attempted / currentTotal) * 100))
      : progress.completed ? 100 : 0;
    if (percentage >= 100 || (progress.completed && currentTotal <= attempted)) stats.complete += 1;
    else if (percentage > 0) stats.inProgress += 1;
    return stats;
  }, { complete: 0, inProgress: 0 });
}

export async function saveLearningProgress(
  uid: string,
  input: {
    subjectId: string;
    unitId?: string | null;
    chapterId: string;
    attemptedQuestionIds?: string[];
    correctQuestionIds?: string[];
    selectedAnswerIndexes?: Record<string, number>;
    totalQuestions?: number;
    bookmarked?: boolean;
    completed?: boolean;
    lastMode?: LearningMode;
    dailyDate?: string | null;
    dailyQuestionIds?: string[];
    dailyAttemptedQuestionIds?: string[];
    dailyCorrectQuestionIds?: string[];
  },
): Promise<void> {
  const normalizedSubjectId = canonicalSubjectId(input.subjectId);
  const normalizedChapterId = canonicalChapterId(input.chapterId);
  const normalizedUnitId = canonicalUnitId(input.unitId);

  await setDocument(
    progressPath(uid, normalizedSubjectId, normalizedChapterId),
    {
      subjectId: normalizedSubjectId,
      unitId: normalizedUnitId,
      chapterId: normalizedChapterId,
      attemptedQuestionIds: input.attemptedQuestionIds ?? [],
      correctQuestionIds: input.correctQuestionIds ?? [],
      ...(input.selectedAnswerIndexes !== undefined ? { selectedAnswerIndexes: input.selectedAnswerIndexes } : {}),
      ...(input.totalQuestions !== undefined ? { totalQuestions: Math.max(0, input.totalQuestions) } : {}),
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
