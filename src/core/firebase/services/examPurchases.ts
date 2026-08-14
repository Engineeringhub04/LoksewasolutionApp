import {
  getDocument,
  listDocuments,
  runQuery,
  setDocument,
  updateDocument,
  serverTimestamp,
} from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';

export type ExamPurchaseStatus = 'pending' | 'active' | 'rejected';

export interface ExamPurchaseRecord {
  id: string;
  uid: string;
  userName: string | null;
  userEmail: string | null;
  courseId: string | null;
  courseName: string | null;
  subcourseId: string | null;
  subcourseName: string | null;
  examSetId: string;
  examTitle: string;
  examContentType: 'mcq' | 'pdf';
  amount: number;
  currency: string;
  method: 'qr';
  status: ExamPurchaseStatus;
  transactionRef: string | null;
  screenshotUrl: string;
  customerMessage: string | null;
  couponCode: string | null;
  adminMessage: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface SubmitExamPurchaseInput {
  uid: string;
  userName: string | null;
  userEmail: string | null;
  courseId: string | null;
  courseName: string | null;
  subcourseId: string | null;
  subcourseName: string | null;
  examSetId: string;
  examTitle: string;
  examContentType: 'mcq' | 'pdf';
  amount: number;
  transactionRef: string;
  screenshotUrl: string;
  customerMessage: string | null;
  couponCode: string | null;
}

export const EXAM_PURCHASE_EDIT_WINDOW_MS = 30 * 60 * 1000;

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function parseRecord(doc: Record<string, unknown>): ExamPurchaseRecord {
  return {
    id: typeof doc.id === 'string' ? doc.id : '',
    uid: typeof doc.uid === 'string' ? doc.uid : '',
    userName: stringValue(doc.userName),
    userEmail: stringValue(doc.userEmail),
    courseId: stringValue(doc.courseId),
    courseName: stringValue(doc.courseName),
    subcourseId: stringValue(doc.subcourseId),
    subcourseName: stringValue(doc.subcourseName),
    examSetId: typeof doc.examSetId === 'string' ? doc.examSetId : '',
    examTitle: typeof doc.examTitle === 'string' ? doc.examTitle : '',
    examContentType: doc.examContentType === 'pdf' ? 'pdf' : 'mcq',
    amount: numberValue(doc.amount),
    currency: typeof doc.currency === 'string' ? doc.currency : 'NPR',
    method: 'qr',
    status: doc.status === 'active' || doc.status === 'rejected' ? doc.status : 'pending',
    transactionRef: stringValue(doc.transactionRef),
    screenshotUrl: typeof doc.screenshotUrl === 'string' ? doc.screenshotUrl : '',
    customerMessage: stringValue(doc.customerMessage),
    couponCode: stringValue(doc.couponCode),
    adminMessage: stringValue(doc.adminMessage),
    submittedAt: stringValue(doc.submittedAt),
    reviewedAt: stringValue(doc.reviewedAt),
    reviewedBy: stringValue(doc.reviewedBy),
    rejectionReason: stringValue(doc.rejectionReason),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function newestFirst(records: ExamPurchaseRecord[]): ExamPurchaseRecord[] {
  return records.sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));
}

export async function fetchMyExamPurchases(uid: string): Promise<ExamPurchaseRecord[]> {
  const docs = await runQuery(Collections.examPurchases, {
    where: [{ field: 'uid', op: '==', value: uid }],
  });
  return newestFirst(docs.map(parseRecord));
}

export async function fetchMyApprovedExamSetIds(uid: string): Promise<string[]> {
  const records = await fetchMyExamPurchases(uid);
  return records.filter((record) => record.status === 'active').map((record) => record.examSetId);
}

export async function fetchExamPurchaseById(id: string): Promise<ExamPurchaseRecord | null> {
  const doc = await getDocument(`${Collections.examPurchases}/${id}`);
  return doc ? parseRecord(doc) : null;
}

export async function fetchAllExamPurchases(): Promise<ExamPurchaseRecord[]> {
  const docs = await listDocuments(Collections.examPurchases);
  return newestFirst(docs.map(parseRecord));
}

export async function submitExamPurchase(input: SubmitExamPurchaseInput): Promise<string> {
  const id = `${input.uid}_${input.examSetId}_${Date.now()}`;
  await setDocument(`${Collections.examPurchases}/${id}`, {
    uid: input.uid,
    userName: input.userName,
    userEmail: input.userEmail,
    courseId: input.courseId,
    courseName: input.courseName,
    subcourseId: input.subcourseId,
    subcourseName: input.subcourseName,
    examSetId: input.examSetId,
    examTitle: input.examTitle,
    examContentType: input.examContentType,
    amount: input.amount,
    currency: 'NPR',
    method: 'qr',
    status: 'pending',
    transactionRef: input.transactionRef.trim(),
    screenshotUrl: input.screenshotUrl,
    customerMessage: input.customerMessage,
    couponCode: input.couponCode,
    adminMessage: null,
    submittedAt: new Date().toISOString(),
    reviewedAt: null,
    reviewedBy: null,
    rejectionReason: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return id;
}

export async function updateMyExamPurchaseDetails(
  id: string,
  input: { transactionRef: string; screenshotUrl: string; customerMessage: string | null },
): Promise<void> {
  await updateDocument(`${Collections.examPurchases}/${id}`, {
    transactionRef: input.transactionRef.trim(),
    screenshotUrl: input.screenshotUrl,
    customerMessage: input.customerMessage,
    updatedAt: serverTimestamp(),
  });
}

export function isExamPurchaseEditable(record: ExamPurchaseRecord, now = Date.now()): boolean {
  if (record.status !== 'pending' || !record.submittedAt) return false;
  return now - new Date(record.submittedAt).getTime() <= EXAM_PURCHASE_EDIT_WINDOW_MS;
}

export function examPurchaseEditRemainingMs(record: ExamPurchaseRecord, now = Date.now()): number {
  if (!record.submittedAt) return 0;
  return Math.max(0, EXAM_PURCHASE_EDIT_WINDOW_MS - (now - new Date(record.submittedAt).getTime()));
}

export async function approveExamPurchase(id: string, reviewerUid: string, adminMessage: string | null): Promise<void> {
  await updateDocument(`${Collections.examPurchases}/${id}`, {
    status: 'active',
    reviewedAt: new Date().toISOString(),
    reviewedBy: reviewerUid,
    adminMessage,
    rejectionReason: null,
    updatedAt: serverTimestamp(),
  });
}

export async function rejectExamPurchase(id: string, reviewerUid: string, reason: string, adminMessage: string | null): Promise<void> {
  await updateDocument(`${Collections.examPurchases}/${id}`, {
    status: 'rejected',
    reviewedAt: new Date().toISOString(),
    reviewedBy: reviewerUid,
    rejectionReason: reason,
    adminMessage,
    updatedAt: serverTimestamp(),
  });
}

export async function seedMissingExamPrices(defaultPrice = 50): Promise<{ updated: number; total: number }> {
  const docs = await listDocuments(Collections.examSets);
  const missing = docs.filter((doc) => typeof doc.price !== 'number' || !Number.isFinite(doc.price));
  for (const doc of missing) {
    if (typeof doc.id !== 'string' || !doc.id) continue;
    await updateDocument(`${Collections.examSets}/${doc.id}`, {
      price: defaultPrice,
      currency: 'NPR',
      priceSeeded: true,
      updatedAt: serverTimestamp(),
    });
  }
  return { updated: missing.length, total: docs.length };
}

export async function updateExamPrice(examSetId: string, price: number): Promise<void> {
  await updateDocument(`${Collections.examSets}/${examSetId}`, {
    price: Math.max(0, Math.round(price)),
    currency: 'NPR',
    updatedAt: serverTimestamp(),
  });
}
