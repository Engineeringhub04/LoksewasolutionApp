// Exam start notifications are now delivered centrally by the Cloudflare →
// GitHub push automation. Keeping a second local scheduler would double-notify
// devices that opened the Exam page before start time, so this module now only
// removes legacy local schedules created by earlier app versions.
import * as Notifications from 'expo-notifications';
import type { ExamSet } from '@/src/core/firebase/services/examHub';

const LEGACY_KIND = 'exam-set-live';

function isLegacyExamNotification(request: Notifications.NotificationRequest): boolean {
  const data = request.content.data as { kind?: unknown } | undefined;
  return data?.kind === LEGACY_KIND;
}

/**
 * Kept under the existing API so the Exam page needs no behavioural rewrite.
 * Every call clears stale local schedules and intentionally schedules nothing.
 */
export async function syncExamSetNotifications(
  _sets: ExamSet[],
  _subcourseLabel?: string | null
): Promise<void> {
  await clearExamSetNotifications();
}

/** Removes every legacy locally-scheduled exam-start notification. */
export async function clearExamSetNotifications(): Promise<void> {
  try {
    const existing = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
    for (const request of existing) {
      if (isLegacyExamNotification(request)) {
        await Notifications.cancelScheduledNotificationAsync(request.identifier).catch(() => {});
      }
    }
  } catch {
    // Best effort: notification cleanup must never block app startup/navigation.
  }
}
