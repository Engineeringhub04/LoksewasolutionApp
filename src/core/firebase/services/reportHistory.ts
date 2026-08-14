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
export type ReportTargetType = 'question' | 'post' | 'comment' | 'reply';

export interface AdminReportResponse {
  id: string;
  message: string;
  status: Exclude<ReportStatus, 'pending'>;
  createdAt: string;
}

export interface ReportHistoryRecord {
  id: string;
  reporterId: string;
  reporterName: string;
  reporterEmail: string | null;
  reporterPhoto: string | null;
  reporterCourseId: string | null;
  reporterSubcourseId: string | null;
  source: ReportSource;
  targetType: ReportTargetType;
  targetId: string;
  targetTitle: string | null;
  targetPreview: string | null;
  targetAuthorName: string | null;
  targetAuthorPhoto: string | null;
  reason: string;
  description: string;
  status: ReportStatus;
  adminMessage: string | null;
  adminResponses: AdminReportResponse[];
  createdAt: FirestoreTimestamp | null;
  reviewedAt: FirestoreTimestamp | null;
}

export interface CreateReportHistoryInput {
  source: ReportSource;
  targetType: ReportTargetType;
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

function parseResponses(value: unknown, legacyMessage: string | null, status: ReportStatus, reviewedAt: FirestoreTimestamp | null, createdAt: FirestoreTimestamp | null): AdminReportResponse[] {
  const parsed = Array.isArray(value) ? value.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const entry = item as Record<string, unknown>;
    const message = stringOrNull(entry.message);
    const entryStatus = parseStatus(entry.status);
    if (!message || entryStatus === 'pending') return [];
    return [{
      id: stringOrNull(entry.id) ?? `response-${index}`,
      message,
      status: entryStatus,
      createdAt: stringOrNull(entry.createdAt) ?? '',
    }];
  }) : [];
  if (parsed.length || !legacyMessage) return parsed;
  const fallbackStatus = status === 'pending' ? 'reviewed' : status;
  return [{
    id: 'legacy-admin-response',
    message: legacyMessage,
    status: fallbackStatus,
    createdAt: reviewedAt?.toDate?.().toISOString?.() ?? createdAt?.toDate?.().toISOString?.() ?? '',
  }];
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
    targetType: doc.targetType === 'post' || doc.targetType === 'comment' || doc.targetType === 'reply' ? doc.targetType : 'question',
    targetId: stringOrNull(doc.targetId) ?? '',
    targetTitle: stringOrNull(doc.targetTitle),
    targetPreview: stringOrNull(doc.targetPreview),
    targetAuthorName: stringOrNull(doc.targetAuthorName),
    targetAuthorPhoto: stringOrNull(doc.targetAuthorPhoto),
    reason: stringOrNull(doc.reason) ?? 'other',
    description: stringOrNull(doc.description) ?? '',
    status: parseStatus(doc.status),
    adminMessage: stringOrNull(doc.adminMessage),
    adminResponses: parseResponses(doc.adminResponses, stringOrNull(doc.adminMessage), parseStatus(doc.status), (doc.reviewedAt as FirestoreTimestamp | null | undefined) ?? null, (doc.createdAt as FirestoreTimestamp | null | undefined) ?? null),
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
    adminResponses: [],
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
  const current = await fetchReportHistory(id);
  const message = adminMessage?.trim() || '';
  const nextResponses = message ? [
    ...(current?.adminResponses ?? []),
    {
      id: `response-${Date.now()}`,
      message,
      status,
      createdAt: new Date().toISOString(),
    },
  ] : (current?.adminResponses ?? []);
  await updateDocument(`${Collections.reportHistory}/${id}`, {
    status,
    adminMessage: message || current?.adminMessage || null,
    adminResponses: nextResponses,
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
