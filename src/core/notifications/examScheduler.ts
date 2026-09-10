// Local scheduled notifications for exam sets — the "goes live" alert.
//
// WHY LOCAL (not server push): the app runs on Firebase's free Spark plan, so
// there are no Cloud Functions to fire a push at an exam's exact start time. The
// device itself already fetches the exam sets it should care about (a login user
// gets only their enrolled subcourse's sets; an anonymous device sees whatever
// the exam tab loads), so we let the OS deliver a LOCAL notification exactly when
// each upcoming set becomes live. This fires even when the app is backgrounded or
// closed, needs no backend, and is automatically subcourse-correct because we
// only ever schedule for the sets this device actually loaded.
//
// The admin website's "Exam Page Notification" send is the complementary path: it
// reaches devices that haven't opened the app recently (and writes the login-user
// inbox entry, which the app itself is not allowed to write per Firestore rules).
//
// Idempotency: every scheduled notification carries data.examSetId + data.kind so
// re-running the sync (on every exam-tab load) reconciles instead of duplicating —
// we cancel ours that are stale/past and only schedule ids we haven't already.
import * as Notifications from 'expo-notifications';
import { serverNow } from '@/src/core/firebase/firestoreRest';
import type { ExamSet } from '@/src/core/firebase/services/examHub';

/** Marks a scheduled notification as belonging to this feature. */
const KIND = 'exam-set-live';

/** Don't bother scheduling something further out than this (OS limits + churn). */
const MAX_LEAD_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

interface ExamNotifData {
  kind: typeof KIND;
  examSetId: string;
  deepLink: string;
  [key: string]: unknown;
}

/** The English body shown when a set goes live, e.g. subcourse prep encouragement. */
function buildContent(set: ExamSet, subcourseLabel?: string | null): Notifications.NotificationContentInput {
  const where = subcourseLabel ? ` for ${subcourseLabel}` : '';
  return {
    title: 'New Model Set is Live! 🎯',
    body: `"${set.title}"${where} has just been published. Give it a try now and sharpen your preparation!`,
    sound: 'default',
    data: {
      kind: KIND,
      examSetId: set.id,
      // Tapping opens the Exams tab — same deep-link field the tray push + inbox use.
      deepLink: '/exam',
    } satisfies ExamNotifData,
  };
}

function isExamNotif(req: Notifications.NotificationRequest): boolean {
  const data = req.content.data as Partial<ExamNotifData> | undefined;
  return data?.kind === KIND;
}

function examSetIdOf(req: Notifications.NotificationRequest): string | null {
  const data = req.content.data as Partial<ExamNotifData> | undefined;
  return typeof data?.examSetId === 'string' ? data.examSetId : null;
}

/**
 * Reconciles the OS's scheduled local notifications with the exam sets this device
 * currently knows about. For every set with a future startTime, ensures exactly one
 * notification is scheduled to fire AT that start time. Cancels ours whose set is no
 * longer upcoming (rescheduled earlier, removed, or already fired). Best-effort:
 * never throws, so a scheduling hiccup can't break the exam screen.
 *
 * Call this after exam sets load (and on refresh). `sets` should be the sets the
 * user is entitled to see — free sets, or pro sets, your call; we skip only ones
 * with no future startTime.
 */
export async function syncExamSetNotifications(
  sets: ExamSet[],
  subcourseLabel?: string | null
): Promise<void> {
  try {
    const now = serverNow().getTime();

    // Target: sets that go live strictly in the future and within the lead window.
    const upcoming = new Map<string, ExamSet>();
    for (const set of sets) {
      const start = set.startTime?.getTime();
      if (start === undefined) continue; // "always open" sets never get a go-live alert
      if (start <= now) continue; // already live — nothing to schedule
      if (start - now > MAX_LEAD_MS) continue; // too far out
      upcoming.set(set.id, set);
    }

    // What's already scheduled by us, keyed by set id (a set could, in theory,
    // have more than one stale entry — collect them all so we can prune extras).
    const existing = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
    const oursBySet = new Map<string, string[]>();
    for (const req of existing) {
      if (!isExamNotif(req)) continue;
      const id = examSetIdOf(req);
      if (!id) {
        // Malformed/legacy — drop it.
        await Notifications.cancelScheduledNotificationAsync(req.identifier).catch(() => {});
        continue;
      }
      const list = oursBySet.get(id) ?? [];
      list.push(req.identifier);
      oursBySet.set(id, list);
    }

    // Cancel scheduled notifications for sets that are no longer upcoming, and any
    // duplicate entries for sets that are (keep the first, drop the rest).
    for (const [setId, identifiers] of oursBySet) {
      const stillUpcoming = upcoming.has(setId);
      const toCancel = stillUpcoming ? identifiers.slice(1) : identifiers;
      for (const identifier of toCancel) {
        await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});
      }
    }

    // Schedule any upcoming set we don't already have an entry for.
    for (const [setId, set] of upcoming) {
      if (oursBySet.has(setId)) continue; // already scheduled
      const start = set.startTime!.getTime();
      await Notifications.scheduleNotificationAsync({
        content: buildContent(set, subcourseLabel),
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: start,
        },
      }).catch(() => {});
    }
  } catch {
    /* best-effort — local scheduling must never break the exam screen */
  }
}

/** Cancels every exam-set go-live notification this feature scheduled. */
export async function clearExamSetNotifications(): Promise<void> {
  try {
    const existing = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
    for (const req of existing) {
      if (isExamNotif(req)) {
        await Notifications.cancelScheduledNotificationAsync(req.identifier).catch(() => {});
      }
    }
  } catch {
    /* ignore */
  }
}
