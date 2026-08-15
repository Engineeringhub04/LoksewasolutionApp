import { Collections } from '@/src/core/firebase/collections';
import { listDocuments, runQuery } from '@/src/core/firebase/firestoreRest';
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

function sameScope(document: Record<string, unknown>, course: string, subcourse: string): boolean {
  return normalizeCatalogId(asString(document.course)) === normalizeCatalogId(course)
    && normalizeCatalogId(asString(document.subcourse)) === normalizeCatalogId(subcourse);
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

function unitMatches(document: Record<string, unknown>, logicalSubjectId: string): boolean {
  return document.isPublished !== false
    && normalizeCatalogId(asString(document.subjectId)) === logicalSubjectId;
}

function chapterMatches(
  document: Record<string, unknown>,
  logicalSubjectId: string,
  unitId: string,
): boolean {
  return document.isPublished !== false
    && normalizeCatalogId(asString(document.subjectId)) === logicalSubjectId
    && normalizeUnitId(asString(document.unitId)) === normalizeUnitId(unitId);
}

export async function fetchSubjectUnits(
  course: string,
  subcourse: string,
  subjectId: string,
): Promise<SubjectUnitDetail[]> {
  const logicalSubjectId = normalizeSubjectId(subjectId);
  const where = [
    { field: 'course', op: '==' as const, value: course },
    { field: 'subcourse', op: '==' as const, value: subcourse },
    { field: 'subjectId', op: '==' as const, value: logicalSubjectId },
    { field: 'isPublished', op: '==' as const, value: true },
  ];

  try {
    const queried = await runQuery(Collections.subjectUnitDetails, {
      where,
      orderBy: [{ field: 'order', direction: 'asc' }],
    });
    if (queried.length > 0) return sortByOrder(queried.map(fromUnitDocument));
  } catch {
    // Older projects or missing indexes use the scan fallback below.
  }

  const documents = await listDocuments(Collections.subjectUnitDetails);
  const matching = documents.filter((document) => unitMatches(document, logicalSubjectId));
  const scoped = matching.filter((document) => sameScope(document, course, subcourse));
  return sortByOrder((scoped.length > 0 ? scoped : matching).map(fromUnitDocument));
}

export async function fetchUnitChapters(
  course: string,
  subcourse: string,
  subjectId: string,
  unitId: string,
): Promise<UnitChapterDetail[]> {
  const logicalSubjectId = normalizeSubjectId(subjectId);
  const where = [
    { field: 'course', op: '==' as const, value: course },
    { field: 'subcourse', op: '==' as const, value: subcourse },
    { field: 'subjectId', op: '==' as const, value: logicalSubjectId },
    { field: 'unitId', op: '==' as const, value: normalizeUnitId(unitId) },
    { field: 'isPublished', op: '==' as const, value: true },
  ];

  try {
    const queried = await runQuery(Collections.subjectUnitChapterDetails, {
      where,
      orderBy: [{ field: 'order', direction: 'asc' }],
    });
    if (queried.length > 0) return sortByOrder(queried.map(fromChapterDocument));
  } catch {
    // Older projects or missing indexes use the scan fallback below.
  }

  const documents = await listDocuments(Collections.subjectUnitChapterDetails);
  const matching = documents.filter((document) => chapterMatches(document, logicalSubjectId, unitId));
  const scoped = matching.filter((document) => sameScope(document, course, subcourse));
  return sortByOrder((scoped.length > 0 ? scoped : matching).map(fromChapterDocument));
}

async function withProgress(
  chapter: UnitChapterDetail,
  subjectId: string,
  uid?: string | null,
): Promise<UnitChapterWithProgress> {
  const progress = uid ? await fetchLearningProgress(uid, subjectId, chapter.id) : null;
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
    const chapters = await fetchUnitChapters(course, subcourse, logicalSubjectId, unit.id);
    return {
      ...unit,
      chapters: await Promise.all(chapters.map((chapter) => withProgress(chapter, logicalSubjectId, uid))),
    };
  }));
}

export function normalizeUnitSubjectId(subjectId: string): string {
  return normalizeSubjectId(subjectId);
}
