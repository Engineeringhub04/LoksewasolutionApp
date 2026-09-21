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
import { notifyAdminsOfReport } from '@/src/core/messaging/adminAlerts';
import { notifyReporterOfReview } from '@/src/core/services/reportNotifier';
import type { ReportReviewNotifyResult } from '@/src/core/services/reportNotifier';
import type { FirestoreTimestamp } from '@/src/core/firebase/firestoreRest';

/**
 * Where the report came from. This started as question/discussion/comment only;
 * it now covers every screen that shows a report icon, because the Report History
 * page groups by exactly this value. Adding a member here needs NO rule change —
 * `app_report_history` is not schema-locked.
 */
export type ReportSource =
  | 'question'
  | 'discussion'
  | 'comment'
  | 'app'
  | 'read'
  | 'article'
  | 'other';
export type ReportStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed';
export type ReportTargetType = 'question' | 'post' | 'comment' | 'reply' | 'app' | 'content';

const REPORT_SOURCES: ReportSource[] = ['question', 'discussion', 'comment', 'app', 'read', 'article', 'other'];
const REPORT_TARGET_TYPES: ReportTargetType[] = ['question', 'post', 'comment', 'reply', 'app', 'content'];

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
  /** Human-readable origin, e.g. "Exam · Set 3" or "GK · Practice Mode". */
  contextLabel: string | null;
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
  contextLabel?: string | null;
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
    source: REPORT_SOURCES.includes(doc.source as ReportSource) ? (doc.source as ReportSource) : 'question',
    targetType: REPORT_TARGET_TYPES.includes(doc.targetType as ReportTargetType) ? (doc.targetType as ReportTargetType) : 'question',
    targetId: stringOrNull(doc.targetId) ?? '',
    targetTitle: stringOrNull(doc.targetTitle),
    targetPreview: stringOrNull(doc.targetPreview),
    contextLabel: stringOrNull(doc.contextLabel),
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
 *
 * It also rings every admin device. That lives HERE rather than in each of the
 * four submit helpers (submitProblemReport, submitContextReport,
 * submitQuestionReport, reportContent) so a new report path can never forget it.
 */
export async function createReportHistory(input: CreateReportHistoryInput): Promise<string> {
  const user = await getCurrentUser();
  if (!user) throw new Error('AUTH_REQUIRED');
  const profile = await fetchUserProfile(user.uid).catch(() => null);
  const reporterName = profile?.name || user.displayName || 'Anonymous';

  const { id } = await createDocument(Collections.reportHistory, {
    reporterId: user.uid,
    reporterName,
    reporterEmail: profile?.email ?? user.email,
    reporterPhoto: profile?.photoURL ?? user.photoURL,
    reporterCourseId: profile?.courseId ?? null,
    reporterSubcourseId: profile?.subcourseId ?? null,
    source: input.source,
    targetType: input.targetType,
    targetId: input.targetId,
    targetTitle: input.targetTitle ?? null,
    targetPreview: input.targetPreview ?? null,
    contextLabel: input.contextLabel ?? null,
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

  // Deliberately NOT awaited: the report is already saved, and an Apps Script
  // cold start can take seconds. The user should not wait on it, and a relay
  // outage must not turn a saved report into a visible failure.
  void notifyAdminsOfReport({
    reportId: id,
    reporterName,
    contextLabel: input.contextLabel ?? null,
    reason: input.reason,
    targetTitle: input.targetTitle ?? null,
    description: input.description ?? null,
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

/**
 * Updates only moderation fields; Firestore rules restrict this write to admins.
 *
 * It then notifies the reporter — inbox row plus tray push. That notification used
 * to exist only in the admin WEBSITE, which is why resolving a report from inside
 * the app looked like it did nothing.
 *
 * The delivery result comes BACK to the caller instead of being swallowed, so the
 * screen can say what actually happened ("notified" vs "saved, no device") rather
 * than claiming success it cannot verify. Delivery never fails the status write.
 */
export async function updateReportHistoryReview(
  id: string,
  status: Exclude<ReportStatus, 'pending'>,
  adminMessage: string | null,
): Promise<ReportReviewNotifyResult> {
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

  if (!current?.reporterId) {
    return { inboxId: null, pushOk: 0, pushFailed: 0, errors: ['REPORTER_UNKNOWN'], noDevice: true };
  }

  return notifyReporterOfReview(
    {
      reportId: id,
      reporterId: current.reporterId,
      reporterName: current.reporterName,
      targetTitle: current.targetTitle,
      contextLabel: current.contextLabel,
    },
    status,
    message || null,
  );
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
