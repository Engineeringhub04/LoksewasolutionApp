// Syllabus service — one document per course+subcourse combination.
// Document ID = `{courseId}__{subcourseId}` so every fetch is a single
// direct getDocument() call (O(1) read, no query, no index needed).
import { Collections } from '@/src/core/firebase/collections';
import {
  getDocument,
  runQuery,
} from '@/src/core/firebase/firestoreRest';

export interface SyllabusData {
  id: string;
  name: string;
  nameNe: string;
  courseId: string;
  subcourseId: string;
  pdfLink: string;
  isPro: boolean;
  price: number;
  active: boolean;
  order: number;
  createdAt: unknown;
  updatedAt: unknown;
}

function syllabusDocId(courseId: string, subcourseId: string): string {
  return `${courseId}__${subcourseId}`;
}

function syllabusPath(courseId: string, subcourseId: string): string {
  return `${Collections.syllabusData}/${syllabusDocId(courseId, subcourseId)}`;
}

function syllabusFromDocument(doc: Record<string, unknown>, id: string): SyllabusData {
  return {
    id,
    name: String(doc.name ?? ''),
    nameNe: String(doc.nameNe ?? doc.name ?? ''),
    courseId: String(doc.courseId ?? ''),
    subcourseId: String(doc.subcourseId ?? ''),
    pdfLink: String(doc.pdfLink ?? ''),
    isPro: doc.isPro === true,
    price: typeof doc.price === 'number' ? doc.price : 0,
    active: doc.active !== false,
    order: typeof doc.order === 'number' ? doc.order : 0,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/**
 * Fetch syllabus data for a specific course+subcourse.
 * Uses a single direct document read — no query, no index.
 */
export async function fetchSyllabusData(
  courseId: string,
  subcourseId: string,
): Promise<SyllabusData | null> {
  const doc = await getDocument(syllabusPath(courseId, subcourseId));
  if (!doc) return null;
  return syllabusFromDocument(doc, syllabusDocId(courseId, subcourseId));
}

/**
 * Fetches every syllabus record for a course (all its subcourse levels), sorted
 * by `order`. One query scoped by `courseId` — the Syllabus screen shows one
 * card per level (4th / 5th / 7th, etc.) for whichever course the user enrolled in.
 *
 * `active` is filtered client-side rather than in the query so a single-field
 * index on `courseId` is enough (no composite index needed on Spark plan).
 */
export async function fetchSyllabusList(courseId: string): Promise<SyllabusData[]> {
  if (!courseId) return [];
  const rows = await runQuery(Collections.syllabusData, {
    where: [{ field: 'courseId', op: '==', value: courseId }],
  });
  return rows
    .map((row) => syllabusFromDocument(row, String(row.id ?? '')))
    .filter((item) => item.active)
    .sort((a, b) => a.order - b.order);
}
