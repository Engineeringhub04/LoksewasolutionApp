import { Collections } from '@/src/core/firebase/collections';
import { runQuery, listDocuments } from '@/src/core/firebase/firestoreRest';
import {
  fetchLearningProgress,
  type LearningProgress,
} from '@/src/core/firebase/services/learningProgress';

export interface SubjectChapterDetail {
  id: string;
  name: string;
  nameNe: string;
  order: number;
  course: string;
  subcourse: string;
  subjectId: string;
  unitId: string | null;
  pro: boolean;
  price: number;
  isPublished: boolean;
}

export interface SubjectChapterProgress {
  chapterId: string;
  attempted: number;
  correct: number;
  totalQuestions: number;
  percentage: number;
  completed: boolean;
  progress: LearningProgress | null;
}

export interface ChapterWithProgress extends SubjectChapterDetail {
  progress: SubjectChapterProgress;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Subject cards carry the Phase 1 Firestore document ID, for example
 * `civil-engineering__civil-assistant-sub-engineer__general-awareness`, while
 * the learning hierarchy is seeded with the canonical catalog slug
 * `general-awareness`. Keep the boundary normalization here so chapter,
 * question, and progress lookups all use the same logical subject ID.
 */
function normalizeSubjectId(subjectId: string): string {
  const parts = subjectId.split('__').filter(Boolean);
  return parts[parts.length - 1] ?? subjectId;
}

function fromDocument(document: Record<string, unknown>): SubjectChapterDetail {
  const unitId = typeof document.unitId === 'string' && document.unitId.trim()
    ? document.unitId
    : null;

  return {
    id: asString(document.id),
    name: asString(document.name, 'Chapter'),
    nameNe: asString(document.nameNe, asString(document.name, 'Chapter')),
    order: asNumber(document.order),
    course: asString(document.course),
    subcourse: asString(document.subcourse),
    subjectId: asString(document.subjectId),
    unitId,
    pro: asBoolean(document.pro),
    price: asNumber(document.price),
    isPublished: document.isPublished !== false,
  };
}

/**
 * Fetches direct chapters only. Technical subject unit-chapters deliberately do
 * not belong to this Phase 3 screen and are excluded by the null unitId filter.
 */
export async function fetchSubjectChapters(
  course: string,
  subcourse: string,
  subjectId: string,
): Promise<SubjectChapterDetail[]> {
  const logicalSubjectId = normalizeSubjectId(subjectId);
  const where = [
    { field: 'course', op: '==' as const, value: course },
    { field: 'subcourse', op: '==' as const, value: subcourse },
    { field: 'subjectId', op: '==' as const, value: logicalSubjectId },
    { field: 'unitId', op: '==' as const, value: null },
    { field: 'isPublished', op: '==' as const, value: true },
  ];

  try {
    const documents = await runQuery(Collections.subjectChapterDetails, {
      where,
      orderBy: [{ field: 'order', direction: 'asc' }],
    });
    return documents.map(fromDocument).sort((a, b) => a.order - b.order);
  } catch {
    // Keep the screen usable when the Firebase project has not created the
    // composite index for the scoped query yet.
    const documents = await listDocuments(Collections.subjectChapterDetails);
    return documents
      .filter((document) => (
        document.course === course
        && document.subcourse === subcourse
        && document.subjectId === logicalSubjectId
        && document.unitId == null
        && document.isPublished !== false
      ))
      .map(fromDocument)
      .sort((a, b) => a.order - b.order);
  }
}

function percentageFor(progress: LearningProgress | null, totalQuestions: number): number {
  if (!progress) return 0;
  if (totalQuestions <= 0) return progress.completed ? 100 : 0;
  return Math.min(100, Math.round((progress.attemptedQuestionIds.length / totalQuestions) * 100));
}

async function progressForChapter(
  uid: string | null | undefined,
  subjectId: string,
  chapter: SubjectChapterDetail,
): Promise<SubjectChapterProgress> {
  // Phase 3 intentionally renders the chapter hierarchy independently of the
  // question bank. Questions may be seeded later, so their absence must never
  // prevent chapter cards from appearing.
  const progress = uid ? await fetchLearningProgress(uid, subjectId, chapter.id) : null;
  const percentage = percentageFor(progress, 0);
  return {
    chapterId: chapter.id,
    attempted: progress?.attemptedQuestionIds.length ?? 0,
    correct: progress?.correctQuestionIds.length ?? 0,
    totalQuestions: 0,
    percentage,
    completed: progress?.completed === true || percentage >= 100,
    progress,
  };
}

export async function fetchSubjectChaptersWithProgress(
  course: string,
  subcourse: string,
  subjectId: string,
  uid?: string | null,
): Promise<ChapterWithProgress[]> {
  const logicalSubjectId = normalizeSubjectId(subjectId);
  const chapters = await fetchSubjectChapters(course, subcourse, logicalSubjectId);
  return Promise.all(chapters.map(async (chapter) => ({
    ...chapter,
    progress: await progressForChapter(uid, logicalSubjectId, chapter),
  })));
}

/** Fetches only the persisted progress documents used by a chapter summary. */
export async function fetchChapterProgressMap(
  uid: string,
  subjectId: string,
  chapters: SubjectChapterDetail[],
): Promise<Record<string, LearningProgress | null>> {
  const logicalSubjectId = normalizeSubjectId(subjectId);
  const entries = await Promise.all(chapters.map(async (chapter) => [
    chapter.id,
    await fetchLearningProgress(uid, logicalSubjectId, chapter.id),
  ] as const));
  return Object.fromEntries(entries);
}
