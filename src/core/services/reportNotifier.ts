// Notifies a reporter that an admin acted on their report — from INSIDE the app.
//
// This existed only in the admin website before, which is why resolving a report
// looked like it did nothing: reports are actually resolved from
// app/admin/report-history/[id].tsx, and that path wrote the status and stopped.
//
// Two independent halves, on purpose:
//   • A durable row in users/{reporterId}/notifications — survives a stale or
//     missing push token and is what the in-app Notifications page lists. This is
//     the half that guarantees the user eventually sees it, even if they were
//     offline when the admin acted.
//   • An Expo tray push — the only half that can reach a CLOSED app. Expo queues
//     it for an offline device and delivers on reconnect.
//
// Rules: no change needed. users/{uid}/notifications is `create: if isAdmin()`
// and users/{uid}/push_tokens is `read: if isOwner || isAdmin`, and the only
// caller of this is an admin acting on a report.
import { createDocument, serverTimestamp } from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';
import { pushToUser } from '@/src/core/notifications/pushSender';
import type { ReportStatus } from '@/src/core/firebase/services/reportHistory';

/** Only these three are real decisions; 'pending' is the un-reviewed state. */
export type ReportReviewStatus = Exclude<ReportStatus, 'pending'>;

export interface ReportReviewNotifyInput {
  reportId: string;
  reporterId: string;
  reporterName?: string | null;
  /** Short title of the reported item, used in the sentence. */
  targetTitle?: string | null;
  /** Fallback for the sentence when there is no title, e.g. "Exam · Set 3". */
  contextLabel?: string | null;
}

export interface ReportReviewNotifyResult {
  /** Null when the inbox write failed or there was no reporter to write to. */
  inboxId: string | null;
  pushOk: number;
  pushFailed: number;
  errors: string[];
  /** True when the reporter has no registered device — inbox row only. */
  noDevice: boolean;
}

/**
 * The category string matters: categoryIcon() in services/notifications.ts maps
 * anything containing "report" to a flag glyph, and that check deliberately runs
 * BEFORE the "update" check so this does not render as a download icon.
 */
const REPORT_CATEGORY = 'Report Update';

const STATUS_COPY: Record<ReportReviewStatus, { title: string; body: (name: string, target: string) => string }> = {
  resolved: {
    title: 'Report Resolved',
    body: (name, target) =>
      `Hi ${name}! The report you filed about "${target}" has been resolved. Thank you for helping us improve Loksewa Solution.`,
  },
  dismissed: {
    title: 'Report Update',
    body: (name, target) =>
      `Hi ${name}, we reviewed your report about "${target}" but could not take action this time. Thanks for flagging it.`,
  },
  reviewed: {
    title: 'Report Under Review',
    body: (name, target) =>
      `Hi ${name}, your report about "${target}" is being reviewed by our team. We will update you soon.`,
  },
};

/** Trims a message to a push-sized snippet, breaking on a word where possible. */
function clip(value: string, max: number): string {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trim()}…`;
}

/** Firestore doc ids may not contain '/'. */
function safeIdPart(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120) || 'unknown';
}

/**
 * Writes the inbox row and sends the tray push. NEVER throws — the status update
 * has already committed by the time this runs, so a delivery problem must not be
 * reported to the admin as a failed review. Problems come back in `errors`.
 */
export async function notifyReporterOfReview(
  input: ReportReviewNotifyInput,
  status: ReportReviewStatus,
  adminMessage?: string | null,
): Promise<ReportReviewNotifyResult> {
  const result: ReportReviewNotifyResult = {
    inboxId: null,
    pushOk: 0,
    pushFailed: 0,
    errors: [],
    noDevice: false,
  };

  const uid = (input.reporterId ?? '').trim();
  if (!uid) return result;

  const copy = STATUS_COPY[status];
  const name = (input.reporterName ?? '').trim() || 'there';
  const target =
    (input.targetTitle ?? '').trim() || (input.contextLabel ?? '').trim() || 'your report';
  const sentence = copy.body(name, clip(target, 70));
  const note = (adminMessage ?? '').trim();
  const deepLink = `/report-history/${encodeURIComponent(input.reportId)}`;

  // A FRESH id per status change, never a reusable one per report. Two reasons:
  // the rules grant the admin `create` but not `update`, so a second write onto
  // the same id would be denied when a report goes reviewed -> resolved; and
  // "under review" and "resolved" are two real events the reporter should see,
  // not one row silently overwritten.
  const inboxId = `report-${safeIdPart(input.reportId)}-${Date.now().toString(36)}`;
  try {
    await createDocument(
      `${Collections.users}/${uid}/notifications`,
      {
        icon: 'flag',
        title: copy.title,
        preview: note ? `${sentence}\n\n${note}` : sentence,
        read: false,
        category: REPORT_CATEGORY,
        deepLink,
        source: 'personal',
        reportId: input.reportId,
        reportStatus: status,
        createdAt: serverTimestamp(),
      },
      inboxId,
    );
    result.inboxId = inboxId;
  } catch (e) {
    result.errors.push(e instanceof Error ? e.message : 'INBOX_WRITE_FAILED');
  }

  // The admin's own message rides along but clipped: the OS truncates a long push
  // body mid-sentence, and the full text is already in the inbox row above.
  try {
    const push = await pushToUser(uid, {
      title: copy.title,
      body: note ? `${sentence} Message from our team: ${clip(note, 90)}` : sentence,
      data: { deepLink, reportId: input.reportId, kind: 'report_review' },
    });
    result.pushOk = push.ok;
    result.pushFailed = push.failed;
    result.noDevice = push.noDevice;
    for (const error of push.errors) {
      if (!result.errors.includes(error)) result.errors.push(error);
    }
  } catch (e) {
    result.errors.push(e instanceof Error ? e.message : 'PUSH_FAILED');
  }

  return result;
}
