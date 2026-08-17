// Subject page catalogue backed by deterministic document IDs.
//
// Phase 1 seeded exactly one document per course+subcourse+subject under
// `app_subjects_details`, with the ID `${course}__${subcourse}__${slug}`. That
// means the whole subject catalogue for one scope is a small handful of direct
// document reads (3 subjects x 1 read each) — no structured query and,
// critically, no full-collection scan as recovery. Every other screen that
// previously ran a scoped query with a `listDocuments` fallback (chapters,
// units, unit-chapters) now reads from this bounded layer instead, which is
// why Firebase read usage stays near zero after app opens and navigations.
//
// Concurrency and focus refreshes are deduplicated by a module-level cache with
// a short stale window (see CACHED_* helpers at the bottom). Re-opens of the
// Subject page within the window reuse the in-memory result without a new
// Firestore request.
import { commitWrites, getDocument, setWrite } from '@/src/core/firebase/firestoreRest';
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

// ---------- Module-level cache with a stale window ----------
//
// Each scope key holds { result, cachedAt }. Entries older than STALE_MS are
// refetched on the next access; concurrent callers for the same key share one
// in-flight request so focus-driven refreshes never issue duplicate reads.

const STALE_MS = 3 * 60 * 1000;

interface CacheEntry<T> {
  result: T;
  cachedAt: number;
}

const cachedSubjects = new Map<string, CacheEntry<SubjectDetail[]>>();
const inFlightSubjects = new Map<string, Promise<SubjectDetail[]>>();

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

export function clearSubjectDetailCache(): void {
  cachedSubjects.clear();
  inFlightSubjects.clear();
}

/**
 * Fetches the seeded subject catalogue for one course+subcourse scope using
 * direct document reads against deterministic IDs only. Never scans the
 * collection — failures surface as an empty array so screens keep rendering,
 * while `fetchSubjectDetailsAll` exposes the raw error for refresh handlers.
 */
export async function fetchSubjectDetails(
  course: string,
  subcourse: string,
  opts?: { force?: boolean },
): Promise<SubjectDetail[]> {
  const result = await fetchSubjectDetailsAll(course, subcourse, opts).catch(() => []);
  return result;
}

/**
 * Same as fetchSubjectDetails but lets the caller observe failures instead of
 * swallowing them — used by screens that want pull-to-refresh to fail visibly.
 */
export async function fetchSubjectDetailsAll(
  course: string,
  subcourse: string,
  opts?: { force?: boolean },
): Promise<SubjectDetail[]> {
  const key = `${course}__${subcourse}`;
  const force = opts?.force === true;

  return cachedOrInFlight(
    cachedSubjects,
    inFlightSubjects,
    key,
    () => loadSubjectDetails(course, subcourse),
    force,
  );
}

async function loadSubjectDetails(course: string, subcourse: string): Promise<SubjectDetail[]> {
  // Deterministic ID reads only — 3 documents, 3 Firestore reads, no scans.
  const subjects: SubjectDetail[] = [];
  for (const seed of SUBJECT_SEED) {
    const doc = await getDocument(`${Collections.subjectDetails}/${subjectDocumentId({ course, subcourse }, seed.slug)}`);
    if (!doc) continue;
    subjects.push(fromDocument({ ...doc, id: subjectDocumentId({ course, subcourse }, seed.slug) }));
  }

  if (subjects.length > 0) return subjects.sort((a, b) => a.order - b.order);

  // The seed documents genuinely are missing for this scope. Keep behaviour
  // consistent with the old implementation, which also returned an empty
  // catalogue when nothing matched — but do it without scanning Firestore.
  return [];
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
