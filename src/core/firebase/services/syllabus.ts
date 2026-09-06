// Syllabus service — one document per course+subcourse combination.
// Document ID = `{courseId}__{subcourseId}` so every fetch is a single
// direct getDocument() call (O(1) read, no query, no index needed).
import {
  commitWrites,
  setWrite,
  getDocument,
  serverTimestamp,
} from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';

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

const SYLLABUS_PDF_PLACEHOLDER =
  'https://drive.google.com/file/d/1wdiV-Uh8sAVtBCJ2K4KjxrPGk42MLGAZ/view?usp=sharing';

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

interface SyllabusSeedEntry {
  courseId: string;
  subcourseId: string;
  name: string;
  nameNe: string;
  order: number;
}

const SYLLABUS_SEED_DATA: SyllabusSeedEntry[] = [
  {
    courseId: 'civil-engineering',
    subcourseId: 'civil-assistant-sub-engineer',
    name: 'Civil Assistant Sub Engineer 4th Level Syllabus',
    nameNe: 'सिभिल सहायक सब इन्जिनियर ४थो तह पाठ्यक्रम',
    order: 1,
  },
  {
    courseId: 'civil-engineering',
    subcourseId: 'civil-sub-engineer',
    name: 'Civil Sub Engineer 5th Level Syllabus',
    nameNe: 'सिभिल सब इन्जिनियर ५औं तह पाठ्यक्रम',
    order: 2,
  },
  {
    courseId: 'civil-engineering',
    subcourseId: 'civil-engineering-7th',
    name: 'Civil Engineering 7th Level Syllabus',
    nameNe: 'सिभिल इन्जिनियरिङ ७औं तह पाठ्यक्रम',
    order: 3,
  },
  {
    courseId: 'geometric-engineering',
    subcourseId: 'amin',
    name: 'Amin 4th Level Syllabus',
    nameNe: 'अमिन ४थो तह पाठ्यक्रम',
    order: 4,
  },
  {
    courseId: 'geometric-engineering',
    subcourseId: 'surveyor',
    name: 'Surveyor 5th Level Syllabus',
    nameNe: 'सर्भेयर ५औं तह पाठ्यक्रम',
    order: 5,
  },
  {
    courseId: 'geometric-engineering',
    subcourseId: 'geometric-engineering-7th',
    name: 'Geometric Engineering 7th Level Syllabus',
    nameNe: 'ज्यामितीय इन्जिनियरिङ ७औं तह पाठ्यक्रम',
    order: 6,
  },
  {
    courseId: 'electrical-engineering',
    subcourseId: 'electrical-assistant-engineer',
    name: 'Electrical Assistant Engineer 4th Level Syllabus',
    nameNe: 'विद्युत सहायक इन्जिनियर ४थो तह पाठ्यक्रम',
    order: 7,
  },
  {
    courseId: 'electrical-engineering',
    subcourseId: 'sub-electrical-engineer',
    name: 'Sub Electrical Engineer 5th Level Syllabus',
    nameNe: 'सब विद्युत इन्जिनियर ५औं तह पाठ्यक्रम',
    order: 8,
  },
  {
    courseId: 'electrical-engineering',
    subcourseId: 'electrical-engineering-7th',
    name: 'Electrical Engineering 7th Level Syllabus',
    nameNe: 'विद्युत इन्जिनियरिङ ७औं तह पाठ्यक्रम',
    order: 9,
  },
];

/**
 * Seeds all 9 syllabus documents into `app_syllabusdata`.
 * Safe to call multiple times — uses setWrite (merge) so existing
 * pdfLink overrides are preserved on re-seed.
 * Admin/dev utility only — guarded by isAdmin check in the UI.
 */
export async function seedSyllabusData(): Promise<number> {
  const writes = SYLLABUS_SEED_DATA.map((entry) =>
    setWrite(
      `${Collections.syllabusData}/${syllabusDocId(entry.courseId, entry.subcourseId)}`,
      {
        name: entry.name,
        nameNe: entry.nameNe,
        courseId: entry.courseId,
        subcourseId: entry.subcourseId,
        pdfLink: SYLLABUS_PDF_PLACEHOLDER,
        isPro: false,
        price: 0,
        active: true,
        order: entry.order,
        isSeed: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ),
  );

  await commitWrites(writes);
  return writes.length;
}
