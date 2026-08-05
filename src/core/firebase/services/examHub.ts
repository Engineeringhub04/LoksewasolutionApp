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
  /** Percentage after negative marking, 0..100. */
  score: number;
  totalQuestions: number;
  correct: number;
  incorrect: number;
  skipped: number;
  passed: number; // stored 1/0 so it survives the REST serialiser cleanly
  timeTakenSeconds: number;
  /**
   * The chosen option per question, -1 for skipped. Stored so Review Answers can
   * be rebuilt exactly as it was answered, without re-deriving anything.
   */
  answers: number[];
  createdAt: FirestoreTimestamp | null;
}

export interface RankingRow {
  id: string;
  uid: string;
  name: string;
  photoURL: string | null;
  score: number;
  timeTakenSeconds: number;
  createdAt: FirestoreTimestamp | null;
}

/** Marks deducted for a wrong answer — matches what the rules sheet states. */
export const NEGATIVE_MARK_PER_WRONG = 0.25;

export interface ScoreBreakdown {
  correct: number;
  incorrect: number;
  skipped: number;
  /** Raw marks after negative marking, floored at 0. */
  marks: number;
  /** Percentage of the total, 0..100. */
  percent: number;
  negativeMarks: number;
  passed: boolean;
}

/**
 * Single source of truth for scoring, used by the quiz screen, the summary and
 * the review screen so all three can never disagree.
 */
export function scoreAttempt(questions: ExamQuestion[], answers: number[], passPercent: number): ScoreBreakdown {
  let correct = 0;
  let incorrect = 0;
  let skipped = 0;

  questions.forEach((question, index) => {
    const chosen = answers[index];
    if (chosen === undefined || chosen < 0) skipped += 1;
    else if (chosen === question.correctIndex) correct += 1;
    else incorrect += 1;
  });

  const negativeMarks = incorrect * NEGATIVE_MARK_PER_WRONG;
  const marks = Math.max(0, correct - negativeMarks);
  const total = questions.length || 1;
  const percent = Math.round((marks / total) * 100);

  return { correct, incorrect, skipped, marks, percent, negativeMarks, passed: percent >= passPercent };
}

/**
 * Answer review and rankings unlock only once the exam's own window has closed
 * (start + duration), so finishing early can't reveal answers to others.
 */
export function resultsUnlockAt(set: ExamSet): number | null {
  if (!set.startTime) return null;
  return set.startTime.getTime() + set.durationMinutes * 60 * 1000;
}

export function areResultsUnlocked(set: ExamSet, now: number): boolean {
  const unlockAt = resultsUnlockAt(set);
  return unlockAt === null || now >= unlockAt;
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
      answers: Array.isArray(d.answers) ? d.answers.map((a) => num(a, -1)) : [],
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

export async function fetchAttemptsForSet(uid: string, examSetId: string): Promise<ExamAttempt[]> {
  const grouped = await fetchExamAttempts(uid);
  return grouped[examSetId] ?? [];
}

/**
 * Saves an attempt twice, on purpose:
 *  - users/{uid}/exam_attempts — private history, only this user can read it
 *  - app_exam_rankings         — one public row per attempt, so a leaderboard can
 *                                be built without a backend job
 *
 * Per-user subcollections cannot be queried across users, which is why the public
 * row exists at all. The ranking write is best-effort: losing a leaderboard entry
 * must never cost the user their attempt.
 */
export async function saveExamAttempt(
  uid: string,
  attempt: Omit<ExamAttempt, 'id' | 'createdAt'>,
  identity: { name: string; photoURL: string | null }
): Promise<string> {
  const { id } = await createDocument(Collections.examAttempts(uid), {
    ...attempt,
    createdAt: serverTimestamp(),
  });

  await createDocument(Collections.examRankings, {
    examSetId: attempt.examSetId,
    uid,
    name: identity.name || 'Anonymous',
    photoURL: identity.photoURL,
    score: attempt.score,
    timeTakenSeconds: attempt.timeTakenSeconds,
    createdAt: serverTimestamp(),
  }).catch(() => {});

  return id;
}

/**
 * Leaderboard for one exam set: best score per user, ties broken by the faster
 * time. Reduced client-side because Firestore can't express "max per group".
 */
export async function fetchExamRanking(examSetId: string): Promise<RankingRow[]> {
  const docs = await runQuery(Collections.examRankings, {
    where: [{ field: 'examSetId', op: '==', value: examSetId }],
  });

  const bestByUid = new Map<string, RankingRow>();
  for (const d of docs) {
    const row: RankingRow = {
      id: str(d.id),
      uid: str(d.uid),
      name: str(d.name, 'Anonymous'),
      photoURL: typeof d.photoURL === 'string' && d.photoURL ? d.photoURL : null,
      score: num(d.score),
      timeTakenSeconds: num(d.timeTakenSeconds),
      createdAt: (d.createdAt as FirestoreTimestamp | undefined) ?? null,
    };
    if (!row.uid) continue;

    const existing = bestByUid.get(row.uid);
    const better =
      !existing ||
      row.score > existing.score ||
      (row.score === existing.score && row.timeTakenSeconds < existing.timeTakenSeconds);
    if (better) bestByUid.set(row.uid, row);
  }

  return Array.from(bestByUid.values()).sort(
    (a, b) => b.score - a.score || a.timeTakenSeconds - b.timeTakenSeconds
  );
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
