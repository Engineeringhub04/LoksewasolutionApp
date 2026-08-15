import { commitWrites, listDocuments, runQuery, setWrite } from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';
import { fetchCourses, fetchSubcourses } from '@/src/core/firebase/services/courses';

export interface SubjectDetail {
  id: string;
  name: string;
  course: string;
  subcourse: string;
  pro: boolean;
  price: number;
  order: number;
}

export interface SubjectDetailScope {
  course: string;
  subcourse: string;
}

export interface SubjectDetailsSeedResult {
  scopes: number;
  records: number;
}

const DEFAULT_SCOPE: SubjectDetailScope = {
  course: 'civil-engineering',
  subcourse: 'civil-assistant-sub-engineer',
};

const SUBJECT_SEED = [
  { slug: 'general-awareness', name: 'General Awareness (सामान्य ज्ञान)', order: 1, pro: false, price: 0 },
  { slug: 'public-management', name: 'Public Management (सार्वजनिक व्यवस्थापन)', order: 2, pro: false, price: 0 },
  { slug: 'technical-subject', name: 'Technical Subject (प्राविधिक विषय)', order: 3, pro: true, price: 50 },
] as const;

function subjectDocumentId(scope: SubjectDetailScope, slug: string): string {
  return `${scope.course}__${scope.subcourse}__${slug}`;
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

function fromDocument(document: Record<string, unknown>): SubjectDetail {
  return {
    id: asString(document.id),
    name: asString(document.name, 'Subject'),
    course: asString(document.course),
    subcourse: asString(document.subcourse),
    pro: asBoolean(document.pro),
    price: asNumber(document.price),
    order: asNumber(document.order),
  };
}

export async function fetchSubjectDetails(course: string, subcourse: string): Promise<SubjectDetail[]> {
  try {
    const documents = await runQuery(Collections.subjectDetails, {
      where: [
        { field: 'course', op: '==', value: course },
        { field: 'subcourse', op: '==', value: subcourse },
      ],
      orderBy: [{ field: 'order', direction: 'asc' }],
    });
    return documents.map(fromDocument).sort((a, b) => a.order - b.order);
  } catch {
    // A client-side fallback keeps the first phase usable if the Firebase project
    // requires a composite index for the scoped query.
    const documents = await listDocuments(Collections.subjectDetails);
    return documents
      .filter((document) => document.course === course && document.subcourse === subcourse)
      .map(fromDocument)
      .sort((a, b) => a.order - b.order);
  }
}

export async function discoverSubjectDetailScopes(): Promise<SubjectDetailScope[]> {
  const scopes: SubjectDetailScope[] = [];
  try {
    const courses = await fetchCourses();
    for (const course of courses) {
      const subcourses = await fetchSubcourses(course.id);
      for (const subcourse of subcourses) {
        scopes.push({ course: course.id, subcourse: subcourse.id });
      }
    }
  } catch {
    // Use the default Civil scope only when course metadata is unavailable.
  }

  if (scopes.length === 0) scopes.push(DEFAULT_SCOPE);
  return Array.from(new Map(scopes.map((scope) => [`${scope.course}:${scope.subcourse}`, scope])).values());
}

export async function seedSubjectDetails(): Promise<SubjectDetailsSeedResult> {
  const scopes = await discoverSubjectDetailScopes();
  const writes = scopes.flatMap((scope) => SUBJECT_SEED.map((subject) => setWrite(
    `${Collections.subjectDetails}/${subjectDocumentId(scope, subject.slug)}`,
    {
      name: subject.name,
      course: scope.course,
      subcourse: scope.subcourse,
      pro: subject.pro,
      price: subject.price,
      order: subject.order,
    },
    { merge: true },
  )));

  await commitWrites(writes);
  return { scopes: scopes.length, records: writes.length };
}
