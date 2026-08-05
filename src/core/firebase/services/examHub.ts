// Exam Hub data layer — provinces, section tabs, exam sets (cards + questions),
// rules and per-user attempts.
//
// Everything the Exam tab renders comes from Firestore through this file; no
// screen builds a collection path or shapes a document itself.
import {
  listDocuments,
  runQuery,
  getDocument,
  createDocument,
  serverTimestamp,
  type FirestoreTimestamp,
} from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';

/** How a section delivers its content. */
export type SectionKind = 'mcq' | 'theory' | 'mixed';
export type ExamContentType = 'mcq' | 'pdf';
export type ExamAccessType = 'free' | 'pro';
export type ExamDifficulty = 'easy' | 'medium' | 'hard';

/** Sentinel for the "All Board" chip — a filter, never a stored document. */
export const ALL_PROVINCES = 'all';

export interface Province {
  id: string;
  nameEn: string;
  nameNe: string;
  order: number;
}

export interface ExamSection {
  id: string;
  nameEn: string;
  nameNe: string;
  order: number;
  kind: SectionKind;
  /** Accent colour used by the cards under this tab. */
  color: string;
  description: string;
  /**
   * Which courses/subcourses this tab applies to. Empty array = applies to all,
   * so a section can be removed for one subcourse straight from the database.
   */
  courseIds: string[];
  subcourseIds: string[];
}

export interface ExamQuestion {
  question: string;
  options: string[];
  /** Index into `options`. */
  correctIndex: number;
  explanation: string;
}

export interface ExamSet {
  id: string;
  courseId: string;
  subcourseId: string;
  provinceId: string;
  sectionId: string;

  title: string;
  /** When the exam opens. Cards appear 10 minutes before this. */
  startTime: Date | null;
  totalQuestions: number;
  durationMinutes: number;
  passPercent: number;
  accessType: ExamAccessType;
  difficulty: ExamDifficulty;

  contentType: ExamContentType;
  /** Only for contentType 'pdf' (Theory Desk / some Past Qns). */
  pdfUrl: string | null;
  questions: ExamQuestion[];
}

export interface ExamRule {
  icon: string;
  title: string;
  description: string;
}

export interface ExamAttempt {
  id: string;
  examSetId: string;
  attemptNumber: number;
  score: number;
  totalQuestions: number;
  correct: number;
  incorrect: number;
  skipped: number;
  passed: number; // stored 1/0 so it survives the REST serialiser cleanly
  timeTakenSeconds: number;
  createdAt: FirestoreTimestamp | null;
}

// ---------- Parsing helpers ----------

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function strArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/** Timestamps come back from the REST client as { toDate, toMillis }, not Date. */
function toDate(value: unknown): Date | null {
  if (!value) return null;
  const ts = value as Partial<FirestoreTimestamp>;
  if (typeof ts.toDate === 'function') return ts.toDate();
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function parseQuestions(value: unknown): ExamQuestion[] {
  if (!Array.isArray(value)) return [];
  return value.map((raw) => {
    const q = (raw ?? {}) as Record<string, unknown>;
    return {
      question: str(q.question),
      options: strArray(q.options),
      correctIndex: num(q.correctIndex),
      explanation: str(q.explanation),
    };
  });
}

function parseExamSet(doc: Record<string, unknown>): ExamSet {
  return {
    id: str(doc.id),
    courseId: str(doc.courseId),
    subcourseId: str(doc.subcourseId),
    provinceId: str(doc.provinceId),
    sectionId: str(doc.sectionId),
    title: str(doc.title),
    startTime: toDate(doc.startTime),
    totalQuestions: num(doc.totalQuestions),
    durationMinutes: num(doc.durationMinutes, 5),
    passPercent: num(doc.passPercent, 40),
    accessType: doc.accessType === 'pro' ? 'pro' : 'free',
    difficulty:
      doc.difficulty === 'medium' || doc.difficulty === 'hard' ? doc.difficulty : 'easy',
    contentType: doc.contentType === 'pdf' ? 'pdf' : 'mcq',
    pdfUrl: typeof doc.pdfUrl === 'string' && doc.pdfUrl ? doc.pdfUrl : null,
    questions: parseQuestions(doc.questions),
  };
}

// ---------- Reads ----------

export async function fetchProvinces(): Promise<Province[]> {
  const docs = await listDocuments(Collections.examProvinces);
  return docs
    .map((d) => ({
      id: str(d.id),
      nameEn: str(d.nameEn),
      nameNe: str(d.nameNe),
      order: num(d.order),
    }))
    .sort((a, b) => a.order - b.order);
}

/**
 * Section tabs available for a given course/subcourse. A section with empty
 * course/subcourse arrays applies everywhere; listing ids restricts it, which is
 * how a tab gets hidden for one subcourse without a code change.
 */
export async function fetchExamSections(courseId: string | null, subcourseId: string | null): Promise<ExamSection[]> {
  const docs = await listDocuments(Collections.examSections);
  return docs
    .map((d) => ({
      id: str(d.id),
      nameEn: str(d.nameEn),
      nameNe: str(d.nameNe),
      order: num(d.order),
      kind: (d.kind === 'theory' || d.kind === 'mixed' ? d.kind : 'mcq') as SectionKind,
      color: str(d.color, '#2563EB'),
      description: str(d.description),
      courseIds: strArray(d.courseIds),
      subcourseIds: strArray(d.subcourseIds),
    }))
    .filter((section) => {
      const courseOk = section.courseIds.length === 0 || (courseId ? section.courseIds.includes(courseId) : true);
      const subOk = section.subcourseIds.length === 0 || (subcourseId ? section.subcourseIds.includes(subcourseId) : true);
      return courseOk && subOk;
    })
    .sort((a, b) => a.order - b.order);
}

/**
 * Exam sets for the current selection. `provinceId === ALL_PROVINCES` returns
 * every province's sets, which is what the "All Board" chip shows.
 *
 * Filtering is done with a single equality query on subcourseId plus in-memory
 * narrowing, deliberately: combining three equality filters with an orderBy would
 * require a composite Firestore index that has to be created by hand, and the
 * per-subcourse result set is small.
 */
export async function fetchExamSets(params: {
  subcourseId: string;
  sectionId: string;
  provinceId: string;
}): Promise<ExamSet[]> {
  const { subcourseId, sectionId, provinceId } = params;
  if (!subcourseId) return [];

  const docs = await runQuery(Collections.examSets, {
    where: [{ field: 'subcourseId', op: '==', value: subcourseId }],
  });

  return docs
    .map(parseExamSet)
    .filter((set) => set.sectionId === sectionId)
    .filter((set) => provinceId === ALL_PROVINCES || set.provinceId === provinceId)
    .sort((a, b) => (a.startTime?.getTime() ?? 0) - (b.startTime?.getTime() ?? 0));
}

export async function fetchExamSet(examSetId: string): Promise<ExamSet | null> {
  const doc = await getDocument(`${Collections.examSets}/${examSetId}`);
  return doc ? parseExamSet(doc) : null;
}

/**
 * Rules for an exact course+subcourse+province+section combination, falling back
 * to progressively broader documents so a missing specific entry never leaves the
 * user with an empty rules sheet.
 */
export async function fetchExamRules(params: {
  courseId: string;
  subcourseId: string;
  provinceId: string;
  sectionId: string;
}): Promise<ExamRule[]> {
  const { courseId, subcourseId, provinceId, sectionId } = params;
  const candidates = [
    `${subcourseId}__${provinceId}__${sectionId}`,
    `${subcourseId}__${sectionId}`,
    `default__${sectionId}`,
    'default',
  ];

  for (const id of candidates) {
    try {
      const doc = await getDocument(`${Collections.examRules}/${id}`);
      const rules = doc?.rules;
      if (Array.isArray(rules) && rules.length > 0) {
        return rules.map((raw) => {
          const r = (raw ?? {}) as Record<string, unknown>;
          return {
            icon: str(r.icon, 'information-circle-outline'),
            title: str(r.title),
            description: str(r.description),
          };
        });
      }
    } catch {
      // Try the next, broader candidate.
    }
  }
  void courseId;
  return [];
}

/** All attempts by this user, grouped by exam set id. */
export async function fetchExamAttempts(uid: string): Promise<Record<string, ExamAttempt[]>> {
  const docs = await listDocuments(Collections.examAttempts(uid));
  const grouped: Record<string, ExamAttempt[]> = {};

  for (const d of docs) {
    const attempt: ExamAttempt = {
      id: str(d.id),
      examSetId: str(d.examSetId),
      attemptNumber: num(d.attemptNumber, 1),
      score: num(d.score),
      totalQuestions: num(d.totalQuestions),
      correct: num(d.correct),
      incorrect: num(d.incorrect),
      skipped: num(d.skipped),
      passed: num(d.passed),
      timeTakenSeconds: num(d.timeTakenSeconds),
      createdAt: (d.createdAt as FirestoreTimestamp | undefined) ?? null,
    };
    if (!attempt.examSetId) continue;
    (grouped[attempt.examSetId] ??= []).push(attempt);
  }

  for (const list of Object.values(grouped)) {
    list.sort((a, b) => a.attemptNumber - b.attemptNumber);
  }
  return grouped;
}

export async function saveExamAttempt(
  uid: string,
  attempt: Omit<ExamAttempt, 'id' | 'createdAt'>
): Promise<string> {
  const { id } = await createDocument(Collections.examAttempts(uid), {
    ...attempt,
    createdAt: serverTimestamp(),
  });
  return id;
}

// ---------- Card state machine ----------

/** How long before startTime a card becomes visible, with its countdown. */
export const CARD_REVEAL_LEAD_MS = 10 * 60 * 1000;

export type ExamCardState =
  | { kind: 'hidden' }
  | { kind: 'countdown'; msRemaining: number }
  | { kind: 'ready' }
  | { kind: 'rejoin' }
  | { kind: 'locked' };

/**
 * Single source of truth for what an exam card offers right now.
 *
 * - hidden    : more than 10 minutes before the start time
 * - countdown : within the 10-minute lead-in, button shows a timer
 * - ready     : open, and never attempted -> Start / View Question
 * - rejoin    : open, already attempted   -> Re-Join + Ranking
 * - locked    : pro exam the user hasn't purchased -> To Buy
 */
export function resolveExamCardState(
  set: ExamSet,
  now: number,
  hasAttempted: boolean,
  isPurchased: boolean
): ExamCardState {
  if (set.accessType === 'pro' && !isPurchased) return { kind: 'locked' };

  // No start time means "always open" rather than "never visible".
  const start = set.startTime?.getTime();
  if (start !== undefined) {
    if (now < start - CARD_REVEAL_LEAD_MS) return { kind: 'hidden' };
    if (now < start) return { kind: 'countdown', msRemaining: start - now };
  }

  return hasAttempted ? { kind: 'rejoin' } : { kind: 'ready' };
}
