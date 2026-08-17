import { Collections } from '@/src/core/firebase/collections';
import { runQuery } from '@/src/core/firebase/firestoreRest';
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
function normalizeCatalogId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeSubjectId(subjectId: string): string {
  const parts = subjectId.split('__').filter(Boolean);
  return normalizeCatalogId(parts[parts.length - 1] ?? subjectId);
}

function sortChapterDocuments(documents: Record<string, unknown>[]): SubjectChapterDetail[] {
  return documents.map(fromDocument).sort((a, b) => a.order - b.order);
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
 *
 * Read-budget note: a scoped structured query is a bounded read (only the
 * matching seeded documents come back), while the old `listDocuments`
 * recovery path re-scanned the entire collection on every index or rules
 * failure. That fallback has been removed — failures now surface as an empty
 * array, and the module-level cache below guarantees the same scope never
 * triggers duplicate Firestore requests from focus refreshes.
 */
export async function fetchSubjectChapters(
  course: string,
  subcourse: string,
  subjectId: string,
  opts?: { force?: boolean },
): Promise<SubjectChapterDetail[]> {
  const logicalSubjectId = normalizeSubjectId(subjectId);
  const key = `${course}__${subcourse}__${logicalSubjectId}`;
  const force = opts?.force === true;

  return cachedOrInFlight(
    cachedChapters,
    inFlightChapters,
    key,
    () => loadDirectChapters(course, subcourse, logicalSubjectId),
    force,
  );
}

function loadDirectChapters(
  course: string,
  subcourse: string,
  logicalSubjectId: string,
): Promise<SubjectChapterDetail[]> {
  const where = [
    { field: 'course', op: '==' as const, value: course },
    { field: 'subcourse', op: '==' as const, value: subcourse },
    { field: 'subjectId', op: '==' as const, value: logicalSubjectId },
    { field: 'unitId', op: '==' as const, value: null },
    { field: 'isPublished', op: '==' as const, value: true },
  ];

  return runQuery(Collections.subjectChapterDetails, {
    where,
    orderBy: [{ field: 'order', direction: 'asc' }],
  }).then((documents) => sortChapterDocuments(documents)).catch(() => {
    // The collection scan fallback was removed to protect the daily read
    // budget. Index and rules failures now return an empty catalogue instead
    // of silently scanning every chapter document in the project.
    return [];
  });
}

// ---------- Module-level cache with a stale window ----------
//
// Returns in-memory results within the stale window and deduplicates
// concurrent callers (e.g. repeated focus refreshes) to a single request.

const STALE_MS = 3 * 60 * 1000;

interface CacheEntry<T> {
  result: T;
  cachedAt: number;
}

const cachedChapters = new Map<string, CacheEntry<SubjectChapterDetail[]>>();
const inFlightChapters = new Map<string, Promise<SubjectChapterDetail[]>>();

function isStale(entry: CacheEntry<unknown> | undefined): boolean {
  return !entry || Date.now() - entry.cachedAt > STALE_MS;
}

function cachedOrInFlight<T>(
  cache: Map<string, CacheEntry<T>>,
  inFlight: Map<string, Promise<T>>,
  key: string,
  loader: () => Promise<T>,
  force: boolean,
): Promise<T> {
  if (!force && !isStale(cache.get(key))) return Promise.resolve(cache.get(key)!.result);
  const existing = inFlight.get(key);
  if (existing) return existing;

  const request = loader()
    .then((result) => {
      cache.set(key, { result, cachedAt: Date.now() });
      return result;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, request);
  return request;
}

export function clearChapterDetailCache(): void {
  cachedChapters.clear();
  inFlightChapters.clear();
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
