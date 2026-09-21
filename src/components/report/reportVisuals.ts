// Shared look-up table for the four report screens (user list + detail, admin
// list + detail).
//
// WHY this exists: each of those screens used to carry its own copy of "which
// icon and which colour goes with this source / this status", and they had
// already drifted apart — the admin list printed the raw `record.status` string
// while the user list printed a translated label, and the detail pages painted
// their panels with fixed hex values (#1E2A5A, #8A3F0A, #EEF2FF) that could only
// ever be right in one theme. Mapping to a Tone instead of a hex means the
// colour is resolved from the ACTIVE theme at render time, so the same table is
// correct in light and dark.
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReportSource, ReportStatus, ReportTargetType } from '@/src/core/firebase/services/reportHistory';
import type { Tone } from '@/src/components/premium';

export interface SourceVisual {
  icon: keyof typeof Ionicons.glyphMap;
  tone: Tone;
}

/** Icon + tone per report origin. A new source falls back to `other`. */
export const SOURCE_VISUAL: Record<ReportSource, SourceVisual> = {
  question: { icon: 'help-circle-outline', tone: 'primary' },
  discussion: { icon: 'chatbubbles-outline', tone: 'accent' },
  comment: { icon: 'chatbubble-ellipses-outline', tone: 'info' },
  app: { icon: 'phone-portrait-outline', tone: 'danger' },
  read: { icon: 'book-outline', tone: 'success' },
  article: { icon: 'newspaper-outline', tone: 'warning' },
  other: { icon: 'flag-outline', tone: 'neutral' },
};

export function sourceVisual(source: ReportSource): SourceVisual {
  return SOURCE_VISUAL[source] ?? SOURCE_VISUAL.other;
}

/** Tone per review state — the one place that decides "resolved is green". */
export function statusTone(status: ReportStatus): Tone {
  if (status === 'resolved') return 'success';
  if (status === 'dismissed') return 'danger';
  if (status === 'reviewed') return 'info';
  return 'warning';
}

export function statusIcon(status: ReportStatus): keyof typeof Ionicons.glyphMap {
  if (status === 'resolved') return 'checkmark-circle';
  if (status === 'dismissed') return 'close-circle';
  if (status === 'reviewed') return 'eye';
  return 'time';
}

/** i18n key, so the admin list stops leaking the raw Firestore value. */
export function statusKey(status: ReportStatus): string {
  if (status === 'resolved') return 'discussion.reportResolved';
  if (status === 'dismissed') return 'discussion.reportDismissed';
  if (status === 'reviewed') return 'discussion.reportReviewed';
  return 'discussion.reportPending';
}

export function targetIcon(targetType: ReportTargetType): keyof typeof Ionicons.glyphMap {
  if (targetType === 'question') return 'help-circle-outline';
  if (targetType === 'post') return 'chatbubbles-outline';
  if (targetType === 'reply') return 'return-down-forward-outline';
  if (targetType === 'app') return 'phone-portrait-outline';
  if (targetType === 'content') return 'document-text-outline';
  return 'chatbubble-ellipses-outline';
}

export function targetKey(targetType: ReportTargetType): string {
  if (targetType === 'question') return 'discussion.reportTargetQuestion';
  if (targetType === 'post') return 'discussion.reportTargetPost';
  if (targetType === 'reply') return 'discussion.reportTargetReply';
  return 'discussion.reportTargetComment';
}
