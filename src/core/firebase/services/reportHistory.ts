import {
  createDocument,
  getDocument,
  runQuery,
  serverTimestamp,
  updateDocument,
} from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';
import { getCurrentUser } from '@/src/core/firebase/session';
import { fetchUserProfile } from '@/src/core/firebase/services/profile';
import type { FirestoreTimestamp } from '@/src/core/firebase/firestoreRest';

export type ReportSource = 'question' | 'discussion' | 'comment';
export type ReportStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed';

export interface ReportHistoryRecord {
  id: string;
  reporterId: string;
  reporterName: string;
  reporterEmail: string | null;
  reporterPhoto: string | null;
  reporterCourseId: string | null;
  reporterSubcourseId: string | null;
  source: ReportSource;
  targetType: 'question' | 'post' | 'comment';
  targetId: string;
  targetTitle: string | null;
  targetPreview: string | null;
  targetAuthorName: string | null;
  targetAuthorPhoto: string | null;
  reason: string;
  description: string;
  status: ReportStatus;
  adminMessage: string | null;
  createdAt: FirestoreTimestamp | null;
  reviewedAt: FirestoreTimestamp | null;
}

export interface CreateReportHistoryInput {
  source: ReportSource;
  targetType: ReportHistoryRecord['targetType'];
  targetId: string;
  targetTitle?: string | null;
  targetPreview?: string | null;
  targetAuthorName?: string | null;
  targetAuthorPhoto?: string | null;
  reason: string;
  description?: string;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function parseStatus(value: unknown): ReportStatus {
  return value === 'reviewed' || value === 'resolved' || value === 'dismissed' ? value : 'pending';
}

function parseRecord(doc: Record<string, unknown>): ReportHistoryRecord {
  return {
    id: typeof doc.id === 'string' ? doc.id : '',
    reporterId: stringOrNull(doc.reporterId) ?? '',
    reporterName: stringOrNull(doc.reporterName) ?? 'Anonymous',
    reporterEmail: stringOrNull(doc.reporterEmail),
    reporterPhoto: stringOrNull(doc.reporterPhoto),
    reporterCourseId: stringOrNull(doc.reporterCourseId),
    reporterSubcourseId: stringOrNull(doc.reporterSubcourseId),
    source: doc.source === 'discussion' || doc.source === 'comment' ? doc.source : 'question',
    targetType: doc.targetType === 'post' || doc.targetType === 'comment' ? doc.targetType : 'question',
    targetId: stringOrNull(doc.targetId) ?? '',
    targetTitle: stringOrNull(doc.targetTitle),
    targetPreview: stringOrNull(doc.targetPreview),
    targetAuthorName: stringOrNull(doc.targetAuthorName),
    targetAuthorPhoto: stringOrNull(doc.targetAuthorPhoto),
    reason: stringOrNull(doc.reason) ?? 'other',
    description: stringOrNull(doc.description) ?? '',
    status: parseStatus(doc.status),
    adminMessage: stringOrNull(doc.adminMessage),
    createdAt: (doc.createdAt as FirestoreTimestamp | null | undefined) ?? null,
    reviewedAt: (doc.reviewedAt as FirestoreTimestamp | null | undefined) ?? null,
  };
}

function newestFirst(records: ReportHistoryRecord[]): ReportHistoryRecord[] {
  return records.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
}

/**
 * Saves a private report-history copy. The caller should submit the same report
 * to the existing Google Form separately so Apps Script can notify Discord.
 */
export async function createReportHistory(input: CreateReportHistoryInput): Promise<string> {
  const user = await getCurrentUser();
  if (!user) throw new Error('AUTH_REQUIRED');
  const profile = await fetchUserProfile(user.uid).catch(() => null);

  const { id } = await createDocument(Collections.reportHistory, {
    reporterId: user.uid,
    reporterName: profile?.name || user.displayName || 'Anonymous',
    reporterEmail: profile?.email ?? user.email,
    reporterPhoto: profile?.photoURL ?? user.photoURL,
    reporterCourseId: profile?.courseId ?? null,
    reporterSubcourseId: profile?.subcourseId ?? null,
    source: input.source,
    targetType: input.targetType,
    targetId: input.targetId,
    targetTitle: input.targetTitle ?? null,
    targetPreview: input.targetPreview ?? null,
    targetAuthorName: input.targetAuthorName ?? null,
    targetAuthorPhoto: input.targetAuthorPhoto ?? null,
    reason: input.reason,
    description: input.description ?? '',
    status: 'pending',
    adminMessage: null,
    createdAt: serverTimestamp(),
    reviewedAt: null,
  });
  return id;
}

export async function fetchMyReportHistory(uid: string): Promise<ReportHistoryRecord[]> {
  const docs = await runQuery(Collections.reportHistory, {
    where: [{ field: 'reporterId', op: '==', value: uid }],
  });
  return newestFirst(docs.map(parseRecord));
}

/** Admin-only moderation list; Firestore rules enforce the administrator check. */
export async function fetchAllReportHistory(): Promise<ReportHistoryRecord[]> {
  const docs = await runQuery(Collections.reportHistory);
  return newestFirst(docs.map(parseRecord));
}

/** Updates only moderation fields; Firestore rules restrict this write to admins. */
export async function updateReportHistoryReview(
  id: string,
  status: Exclude<ReportStatus, 'pending'>,
  adminMessage: string | null,
): Promise<void> {
  await updateDocument(`${Collections.reportHistory}/${id}`, {
    status,
    adminMessage: adminMessage?.trim() || null,
    reviewedAt: serverTimestamp(),
  });
}

export async function fetchReportHistory(id: string): Promise<ReportHistoryRecord | null> {
  const doc = await getDocument(`${Collections.reportHistory}/${id}`);
  return doc ? parseRecord(doc) : null;
}

export function reportStatusLabel(status: ReportStatus): string {
  switch (status) {
    case 'resolved': return 'Resolved';
    case 'dismissed': return 'Dismissed';
    case 'reviewed': return 'Reviewed';
    default: return 'Pending review';
  }
}
