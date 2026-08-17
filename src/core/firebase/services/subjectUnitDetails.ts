import { Collections } from '@/src/core/firebase/collections';
import { runQuery } from '@/src/core/firebase/firestoreRest';
import {
  fetchLearningProgress,
  type LearningProgress,
} from '@/src/core/firebase/services/learningProgress';

export interface SubjectUnitDetail {
  id: string;
  name: string;
  nameNe: string;
  order: number;
  course: string;
  subcourse: string;
  subjectId: string;
  pro: boolean;
  price: number;
  chapterCount: number;
  isPublished: boolean;
}

export interface UnitChapterDetail {
  id: string;
  name: string;
  nameNe: string;
  order: number;
  course: string;
  subcourse: string;
  subjectId: string;
  unitId: string;
  unit: string;
  unitNameNe: string;
  pro: boolean;
  price: number;
  isPublished: boolean;
}

export interface UnitChapterWithProgress extends UnitChapterDetail {
  progress: {
    chapterId: string;
    attempted: number;
    correct: number;
    percentage: number;
    completed: boolean;
    progress: LearningProgress | null;
  };
}

export interface SubjectUnitWithChapters extends SubjectUnitDetail {
  chapters: UnitChapterWithProgress[];
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

/**
 * Unit documents use a composite Firestore document ID, while seeded unit
 * chapters store the catalog slug in `unitId` (for example `surveying`).
 * Normalize both forms to the final catalog segment before joining them.
 */
function normalizeUnitId(unitId: string): string {
  const parts = unitId.split('__').filter(Boolean);
  return normalizeCatalogId(parts[parts.length - 1] ?? unitId);
}

function fromUnitDocument(document: Record<string, unknown>): SubjectUnitDetail {
  return {
    id: asString(document.id),
    name: asString(document.name, 'Unit'),
    nameNe: asString(document.nameNe, asString(document.name, 'Unit')),
    order: asNumber(document.order),
    course: asString(document.course),
    subcourse: asString(document.subcourse),
    subjectId: asString(document.subjectId),
    pro: asBoolean(document.pro),
    price: asNumber(document.price),
    chapterCount: asNumber(document.chapterCount),
    isPublished: document.isPublished !== false,
  };
}

function fromChapterDocument(document: Record<string, unknown>): UnitChapterDetail {
  return {
    id: asString(document.id),
    name: asString(document.name, 'Chapter'),
    nameNe: asString(document.nameNe, asString(document.name, 'Chapter')),
    order: asNumber(document.order),
    course: asString(document.course),
    subcourse: asString(document.subcourse),
    subjectId: asString(document.subjectId),
    unitId: asString(document.unitId),
    unit: asString(document.unit),
    unitNameNe: asString(document.unitNameNe, asString(document.unit)),
    pro: asBoolean(document.pro),
    price: asNumber(document.price),
    isPublished: document.isPublished !== false,
  };
}

function sortByOrder<T extends { order: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order);
}

/**
 * Read-budget note: the old implementation re-scanned the entire
 * `app_subjects_units_details` collection whenever a structured query failed,
 * which silently multiplied read usage on every index/rules error and every
 * focus-driven refresh. The scan is gone — scoped queries are bounded reads,
 * and the module-level cache below deduplicates repeated refreshes.
 */
export async function fetchSubjectUnits(
  course: string,
  subcourse: string,
  subjectId: string,
  opts?: { force?: boolean },
): Promise<SubjectUnitDetail[]> {
  const logicalSubjectId = normalizeSubjectId(subjectId);
  const key = `${course}__${subcourse}__${logicalSubjectId}`;
  const force = opts?.force === true;

  return cachedOrInFlight(
    cachedUnits,
    inFlightUnits,
    key,
    () => loadUnits(course, subcourse, logicalSubjectId),
    force,
  );
}

function loadUnits(
  course: string,
  subcourse: string,
  logicalSubjectId: string,
): Promise<SubjectUnitDetail[]> {
  const where = [
    { field: 'course', op: '==' as const, value: course },
    { field: 'subcourse', op: '==' as const, value: subcourse },
    { field: 'subjectId', op: '==' as const, value: logicalSubjectId },
    { field: 'isPublished', op: '==' as const, value: true },
  ];

  return runQuery(Collections.subjectUnitDetails, {
    where,
    orderBy: [{ field: 'order', direction: 'asc' }],
  }).then((queried) => sortByOrder(queried.map(fromUnitDocument))).catch(() => {
    // Collection scan removed to protect the daily read budget; query
    // failures surface as an empty unit list instead of a full scan.
    return [];
  });
}

// ---------- Module-level cache with a stale window ----------

const STALE_MS = 3 * 60 * 1000;

interface CacheEntry<T> {
  result: T;
  cachedAt: number;
}

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

const cachedUnits = new Map<string, CacheEntry<SubjectUnitDetail[]>>();
const inFlightUnits = new Map<string, Promise<SubjectUnitDetail[]>>();
const cachedUnitChapters = new Map<string, CacheEntry<UnitChapterDetail[]>>();
const inFlightUnitChapters = new Map<string, Promise<UnitChapterDetail[]>>();

export function clearUnitDetailCache(): void {
  cachedUnits.clear();
  inFlightUnits.clear();
  cachedUnitChapters.clear();
  inFlightUnitChapters.clear();
}

export async function fetchUnitChapters(
  course: string,
  subcourse: string,
  subjectId: string,
  unitId: string,
  opts?: { force?: boolean },
): Promise<UnitChapterDetail[]> {
  const logicalSubjectId = normalizeSubjectId(subjectId);
  const key = `${course}__${subcourse}__${logicalSubjectId}__${normalizeUnitId(unitId)}`;
  const force = opts?.force === true;

  return cachedOrInFlight(
    cachedUnitChapters,
    inFlightUnitChapters,
    key,
    () => loadUnitChapters(course, subcourse, logicalSubjectId, unitId),
    force,
  );
}

function loadUnitChapters(
  course: string,
  subcourse: string,
  logicalSubjectId: string,
  unitId: string,
): Promise<UnitChapterDetail[]> {
  const where = [
    { field: 'course', op: '==' as const, value: course },
    { field: 'subcourse', op: '==' as const, value: subcourse },
    { field: 'subjectId', op: '==' as const, value: logicalSubjectId },
    { field: 'unitId', op: '==' as const, value: normalizeUnitId(unitId) },
    { field: 'isPublished', op: '==' as const, value: true },
  ];

  return runQuery(Collections.subjectUnitChapterDetails, {
    where,
    orderBy: [{ field: 'order', direction: 'asc' }],
  }).then((queried) => sortByOrder(queried.map(fromChapterDocument))).catch(() => {
    // Collection scan removed to protect the daily read budget; query
    // failures surface as an empty chapter list instead of a full scan.
    return [];
  });
}

async function withProgress(
  chapter: UnitChapterDetail,
  subjectId: string,
  uid?: string | null,
): Promise<UnitChapterWithProgress> {
  let progress: LearningProgress | null = null;
  if (uid) {
    try {
      progress = await fetchLearningProgress(uid, subjectId, chapter.id);
    } catch {
      // A missing or temporarily unavailable progress document must not hide chapter metadata.
    }
  }
  const percentage = progress?.completed ? 100 : 0;
  return {
    ...chapter,
    progress: {
      chapterId: chapter.id,
      attempted: progress?.attemptedQuestionIds.length ?? 0,
      correct: progress?.correctQuestionIds.length ?? 0,
      percentage,
      completed: progress?.completed === true,
      progress,
    },
  };
}

export async function fetchSubjectUnitsWithChapters(
  course: string,
  subcourse: string,
  subjectId: string,
  uid?: string | null,
): Promise<SubjectUnitWithChapters[]> {
  const logicalSubjectId = normalizeSubjectId(subjectId);
  const units = await fetchSubjectUnits(course, subcourse, logicalSubjectId);
  return Promise.all(units.map(async (unit) => {
    let chapters: UnitChapterDetail[] = [];
    try {
      chapters = await fetchUnitChapters(course, subcourse, logicalSubjectId, unit.id);
    } catch {
      // Keep the unit visible even if its optional chapter collection is unavailable.
    }
    return {
      ...unit,
      chapters: await Promise.all(chapters.map((chapter) => withProgress(chapter, logicalSubjectId, uid))),
    };
  }));
}

export function normalizeUnitSubjectId(subjectId: string): string {
  return normalizeSubjectId(subjectId);
}
