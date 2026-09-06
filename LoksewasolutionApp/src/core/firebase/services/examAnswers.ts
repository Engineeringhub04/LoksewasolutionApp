// Theory Answer Upload + Admin Review — data layer.
//
// A student answers a Theory Desk / Past Qns paper on paper, photographs or
// scans it into a single PDF, and uploads it here for a human (admin) to grade.
// This is deliberately NOT part of the Exam Hub attempt flow (examHub.ts):
// theory answers cannot be auto-scored, so they go through a review queue
// instead of the instant scoreAttempt() path MCQ sets use.
//
// Flat top-level collection (app_exam_answers), not a per-user subcollection —
// the Admin desk must list and filter submissions across every user, which a
// subcollection cannot do. Ownership is enforced by an `uid` field instead (see
// firebase.rules).
import {
  getDocument,
  createDocument,
  updateDocument,
  runQuery,
  serverTimestamp,
  type FirestoreTimestamp,
} from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';

export type AnswerStatus = 'pending' | 'reviewed';

export interface ExamAnswer {
  id: string;
  uid: string;
  studentName: string;
  /** The student's real name from their profile at submission time — always shown to the admin, even if studentName above was hand-edited. */
  profileName: string;
  photoURL: string | null;
  email: string | null;
  courseId: string;
  courseName: string;
  subcourseId: string;
  subcourseName: string;
  examSetId: string;
  examSetTitle: string;
  /**
   * The exam-hub section this paper was submitted from (e.g. "Theory Desk",
   * "Past Qns Desk") — captured at submission time so the Admin desk's track
   * filter can group by it without joining back to app_exam_sections.
   */
  sectionName: string;
  message: string;
  pdfUrl: string;
  status: AnswerStatus;
  /** Percentage 0..100, only meaningful once status === 'reviewed'. */
  score: number;
  fullMarks: number;
  passed: boolean;
  reviewNote: string;
  createdAt: FirestoreTimestamp | null;
  reviewedAt: FirestoreTimestamp | null;
}

/** A submission may be edited by its owner for one hour after upload. */
export const ANSWER_EDIT_WINDOW_MS = 60 * 60 * 1000;

export function isWithinEditWindow(createdAt: FirestoreTimestamp | null, now: number): boolean {
  if (!createdAt) return false;
  return now - createdAt.toMillis() < ANSWER_EDIT_WINDOW_MS;
}

export function editWindowRemainingMs(createdAt: FirestoreTimestamp | null, now: number): number {
  if (!createdAt) return 0;
  return Math.max(0, ANSWER_EDIT_WINDOW_MS - (now - createdAt.toMillis()));
}

// ---------- Parsing ----------

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function parseAnswer(doc: Record<string, unknown>): ExamAnswer {
  return {
    id: str(doc.id),
    uid: str(doc.uid),
    studentName: str(doc.studentName),
    profileName: str(doc.profileName),
    photoURL: (doc.photoURL as string | undefined) || null,
    email: (doc.email as string | undefined) || null,
    courseId: str(doc.courseId),
    courseName: str(doc.courseName),
    subcourseId: str(doc.subcourseId),
    subcourseName: str(doc.subcourseName),
    examSetId: str(doc.examSetId),
    examSetTitle: str(doc.examSetTitle),
    sectionName: str(doc.sectionName),
    message: str(doc.message),
    pdfUrl: str(doc.pdfUrl),
    status: doc.status === 'reviewed' ? 'reviewed' : 'pending',
    score: num(doc.score),
    fullMarks: num(doc.fullMarks, 100),
    passed: doc.passed === true,
    reviewNote: str(doc.reviewNote),
    createdAt: (doc.createdAt as FirestoreTimestamp | undefined) ?? null,
    reviewedAt: (doc.reviewedAt as FirestoreTimestamp | undefined) ?? null,
  };
}

function answerPath(id: string): string {
  return `${Collections.examAnswers}/${id}`;
}

// ---------- Student-facing ----------

export interface SubmitAnswerInput {
  uid: string;
  studentName: string;
  courseId: string;
  courseName: string;
  subcourseId: string;
  subcourseName: string;
  examSetId: string;
  examSetTitle: string;
  sectionName: string;
  /** The student's real name from their profile at submission time — always shown to the admin, even if they edited studentName below. */
  profileName: string;
  photoURL: string | null;
  email: string | null;
  message: string;
  pdfUrl: string;
}

/** Uploads a new answer submission. Always starts 'pending' with no score. */
export async function submitExamAnswer(input: SubmitAnswerInput): Promise<string> {
  const { id } = await createDocument(Collections.examAnswers, {
    ...input,
    status: 'pending',
    score: 0,
    fullMarks: 100,
    passed: false,
    reviewNote: '',
    createdAt: serverTimestamp(),
    reviewedAt: null,
  });
  return id;
}

export async function fetchExamAnswer(id: string): Promise<ExamAnswer | null> {
  const doc = await getDocument(answerPath(id));
  return doc ? parseAnswer(doc) : null;
}

/** All submissions by this user, newest first. */
export async function fetchMyExamAnswers(uid: string): Promise<ExamAnswer[]> {
  const docs = await runQuery(Collections.examAnswers, {
    where: [{ field: 'uid', op: '==', value: uid }],
  });
  return docs
    .map(parseAnswer)
    .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
}

/**
 * Same data as fetchMyExamAnswers, keyed by examSetId — lets the Exam Hub
 * cards look up "did I already submit for this set?" in O(1) without a
 * separate query per card. Multiple attempts aren't allowed (see
 * firebase.rules — a student can only ever have one answer per set in
 * practice, enforced by the UI hiding Upload once a submission exists), so
 * "first submission per set" is the only entry kept.
 */
export async function fetchMyExamAnswersBySet(uid: string): Promise<Record<string, ExamAnswer>> {
  const list = await fetchMyExamAnswers(uid);
  const map: Record<string, ExamAnswer> = {};
  for (const answer of list) {
    if (!map[answer.examSetId]) map[answer.examSetId] = answer;
  }
  return map;
}

/**
 * Re-upload during the 1-hour edit window. Only the file/message may change —
 * status, score and reviewedAt are owned by the admin and never touched here
 * (also enforced server-side by firebase.rules).
 */
export async function updateMyExamAnswer(
  id: string,
  patch: { pdfUrl: string; message: string }
): Promise<void> {
  await updateDocument(answerPath(id), patch);
}

// ---------- Admin-facing ----------

/** All submissions with a given status, newest first — feeds the two Admin desk tabs. */
export async function fetchExamAnswersByStatus(status: AnswerStatus): Promise<ExamAnswer[]> {
  const docs = await runQuery(Collections.examAnswers, {
    where: [{ field: 'status', op: '==', value: status }],
  });
  return docs
    .map(parseAnswer)
    .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
}

/**
 * Every submission, newest first — feeds the inline Admin Answer Update desk
 * on the Theory Desk board, which filters by track (All / Theory Desk / Past
 * Qns Desk / Other) entirely client-side rather than one query per track,
 * since the whole list is small enough to filter in memory and the tabs need
 * to feel instant when switching.
 */
export async function fetchAllExamAnswers(): Promise<ExamAnswer[]> {
  const docs = await runQuery(Collections.examAnswers);
  return docs
    .map(parseAnswer)
    .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
}

export interface ReviewAnswerInput {
  score: number;
  fullMarks: number;
  passed: boolean;
  reviewNote: string;
  /** Only present when the admin replaced the PDF (e.g. an annotated copy). */
  pdfUrl?: string;
}

/** Admin grades a submission, moving it from 'pending' to 'reviewed'. */
export async function reviewExamAnswer(id: string, input: ReviewAnswerInput): Promise<void> {
  await updateDocument(answerPath(id), {
    ...input,
    status: 'reviewed',
    reviewedAt: serverTimestamp(),
  });
}
