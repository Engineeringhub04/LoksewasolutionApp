import {
  getDocument,
  listDocuments,
  runQuery,
  setDocument,
  updateDocument,
  serverTimestamp,
} from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';

export type ContentPurchaseStatus = 'pending' | 'active' | 'rejected';
export type ContentPurchaseType = 'subject' | 'unit' | 'chapter';

export interface ContentPurchaseRecord {
  id: string;
  uid: string;
  userName: string | null;
  userEmail: string | null;
  courseId: string | null;
  subcourseId: string | null;
  contentType: ContentPurchaseType;
  contentId: string;
  contentTitle: string;
  contentTitleNe: string;
  subjectId: string;
  unitId: string | null;
  amount: number;
  currency: string;
  method: 'qr';
  status: ContentPurchaseStatus;
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

export interface SubmitContentPurchaseInput {
  uid: string;
  userName: string | null;
  userEmail: string | null;
  courseId: string | null;
  subcourseId: string | null;
  contentType: ContentPurchaseType;
  contentId: string;
  contentTitle: string;
  contentTitleNe: string;
  subjectId: string;
  unitId: string | null;
  amount: number;
  transactionRef: string;
  screenshotUrl: string;
  customerMessage: string | null;
  couponCode?: string | null;
}

export const CONTENT_PURCHASE_EDIT_WINDOW_MS = 30 * 60 * 1000;

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function contentTypeValue(value: unknown): ContentPurchaseType {
  return value === 'subject' || value === 'unit' ? value : 'chapter';
}

function parseRecord(doc: Record<string, unknown>): ContentPurchaseRecord {
  return {
    id: typeof doc.id === 'string' ? doc.id : '',
    uid: typeof doc.uid === 'string' ? doc.uid : '',
    userName: stringValue(doc.userName),
    userEmail: stringValue(doc.userEmail),
    courseId: stringValue(doc.courseId),
    subcourseId: stringValue(doc.subcourseId),
    contentType: contentTypeValue(doc.contentType),
    contentId: typeof doc.contentId === 'string' ? doc.contentId : '',
    contentTitle: typeof doc.contentTitle === 'string' ? doc.contentTitle : '',
    contentTitleNe: typeof doc.contentTitleNe === 'string' ? doc.contentTitleNe : '',
    subjectId: typeof doc.subjectId === 'string' ? doc.subjectId : '',
    unitId: stringValue(doc.unitId),
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

function newestFirst(records: ContentPurchaseRecord[]): ContentPurchaseRecord[] {
  return records.sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));
}

export async function fetchMyContentPurchases(uid: string): Promise<ContentPurchaseRecord[]> {
  const docs = await runQuery(Collections.contentPurchases, {
    where: [{ field: 'uid', op: '==', value: uid }],
  });
  return newestFirst(docs.map(parseRecord));
}

export async function fetchMyApprovedContentIds(uid: string): Promise<string[]> {
  const records = await fetchMyContentPurchases(uid);
  return records.filter((record) => record.status === 'active').map((record) => record.contentId);
}

export async function fetchPendingContentPurchase(
  uid: string,
  contentType: ContentPurchaseType,
  contentId: string,
): Promise<ContentPurchaseRecord | null> {
  const records = await fetchMyContentPurchases(uid);
  return records.find(
    (record) => record.contentType === contentType && record.contentId === contentId && record.status === 'pending',
  ) ?? null;
}

export async function fetchContentPurchaseById(id: string): Promise<ContentPurchaseRecord | null> {
  const doc = await getDocument(`${Collections.contentPurchases}/${id}`);
  return doc ? parseRecord(doc) : null;
}

export async function fetchAllContentPurchases(): Promise<ContentPurchaseRecord[]> {
  const docs = await listDocuments(Collections.contentPurchases);
  return newestFirst(docs.map(parseRecord));
}

export async function submitContentPurchase(input: SubmitContentPurchaseInput): Promise<string> {
  const existingPending = await fetchPendingContentPurchase(input.uid, input.contentType, input.contentId);
  if (existingPending) return existingPending.id;

  const id = `${input.uid}_${input.contentType}_${input.contentId}_${Date.now()}`;
  await setDocument(`${Collections.contentPurchases}/${id}`, {
    uid: input.uid,
    userName: input.userName,
    userEmail: input.userEmail,
    courseId: input.courseId,
    subcourseId: input.subcourseId,
    contentType: input.contentType,
    contentId: input.contentId,
    contentTitle: input.contentTitle,
    contentTitleNe: input.contentTitleNe,
    subjectId: input.subjectId,
    unitId: input.unitId,
    amount: Math.max(0, Math.round(input.amount)),
    currency: 'NPR',
    method: 'qr',
    status: 'pending',
    transactionRef: input.transactionRef.trim(),
    screenshotUrl: input.screenshotUrl,
    customerMessage: input.customerMessage,
    couponCode: input.couponCode ?? null,
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

export async function updateMyContentPurchaseDetails(
  id: string,
  input: { transactionRef: string; screenshotUrl: string; customerMessage: string | null },
): Promise<void> {
  await updateDocument(`${Collections.contentPurchases}/${id}`, {
    transactionRef: input.transactionRef.trim(),
    screenshotUrl: input.screenshotUrl,
    customerMessage: input.customerMessage,
    updatedAt: serverTimestamp(),
  });
}

export function isContentPurchaseEditable(record: ContentPurchaseRecord, now = Date.now()): boolean {
  if (record.status !== 'pending' || !record.submittedAt) return false;
  return now - new Date(record.submittedAt).getTime() <= CONTENT_PURCHASE_EDIT_WINDOW_MS;
}

export function contentPurchaseEditRemainingMs(record: ContentPurchaseRecord, now = Date.now()): number {
  if (!record.submittedAt) return 0;
  return Math.max(0, CONTENT_PURCHASE_EDIT_WINDOW_MS - (now - new Date(record.submittedAt).getTime()));
}

export async function approveContentPurchase(id: string, reviewerUid: string, adminMessage: string | null): Promise<void> {
  await updateDocument(`${Collections.contentPurchases}/${id}`, {
    status: 'active',
    reviewedAt: new Date().toISOString(),
    reviewedBy: reviewerUid,
    adminMessage,
    rejectionReason: null,
    updatedAt: serverTimestamp(),
  });
}

export async function rejectContentPurchase(
  id: string,
  reviewerUid: string,
  reason: string,
  adminMessage: string | null,
): Promise<void> {
  await updateDocument(`${Collections.contentPurchases}/${id}`, {
    status: 'rejected',
    reviewedAt: new Date().toISOString(),
    reviewedBy: reviewerUid,
    rejectionReason: reason,
    adminMessage,
    updatedAt: serverTimestamp(),
  });
}
