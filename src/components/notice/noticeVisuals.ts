// Shared look-up table for the notice surfaces (Home's "Recent Notices"
// section, the full Notices list, and a notice's detail page).
//
// WHY this exists: all three places used to hardcode `megaphone` +
// `${colors.primary}17`, so five different notices — a new feature, an app
// update, a maintenance report, an exam schedule and a welcome message — all
// looked like the exact same announcement. Mapping kind -> { icon, tone } gives
// each one its own identity, and mapping to a Tone rather than a hex means the
// colour is resolved from the ACTIVE theme at render time, so it stays legible
// in light and dark. Same recipe as src/components/report/reportVisuals.ts.
//
// This lives under src/components (not src/core/data) on purpose: `Tone` is a
// presentation concern, and src/core must not depend on the component layer.
import Ionicons from '@expo/vector-icons/Ionicons';
import type { NoticeKind } from '@/src/core/firebase/services/notices';
import type { Tone } from '@/src/components/premium';

export interface NoticeVisual {
  icon: keyof typeof Ionicons.glyphMap;
  tone: Tone;
  /** Short badge word shown next to the date. */
  label: string;
}

export const NOTICE_VISUAL: Record<NoticeKind, NoticeVisual> = {
  feature: { icon: 'sparkles', tone: 'accent', label: 'New' },
  update: { icon: 'cloud-download-outline', tone: 'info', label: 'Update' },
  maintenance: { icon: 'construct-outline', tone: 'warning', label: 'Maintenance' },
  exam: { icon: 'calendar-outline', tone: 'danger', label: 'Exam' },
  welcome: { icon: 'hand-left-outline', tone: 'success', label: 'Welcome' },
};

/** A kind we have not styled yet falls back to the generic announcement look. */
const FALLBACK: NoticeVisual = { icon: 'megaphone', tone: 'primary', label: 'Notice' };

export function noticeVisual(kind: NoticeKind | undefined): NoticeVisual {
  if (!kind) return FALLBACK;
  return NOTICE_VISUAL[kind] ?? FALLBACK;
}
