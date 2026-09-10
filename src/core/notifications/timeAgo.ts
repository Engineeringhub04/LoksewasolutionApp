// Compact "time ago" formatter for the notification inbox, bilingual.
//
// English uses the short form the app already uses elsewhere ("2m", "3h", "5d");
// Nepali uses Devanagari digits with natural units ("२ मिनेट"). Both are wrapped
// by the i18n `notifications.ago` / `notifications.justNow` strings so the word
// order stays correct per language. Falls back to a plain date for anything older
// than a month so we never render "120d ago".
import type { FirestoreTimestamp } from '@/src/core/firebase/firestoreRest';
import type { Language } from '@/src/core/i18n';

const NEPALI_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];

function toNepaliDigits(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => NEPALI_DIGITS[Number(d)]);
}

type T = (key: string, params?: Record<string, string | number>) => string;

/**
 * Returns a short relative time like "5m ago" / "५ मिनेट अघि", or an absolute
 * date string for timestamps older than 30 days. Returns '' for missing/invalid
 * input so callers can simply skip rendering.
 */
export function formatTimeAgo(createdAt: FirestoreTimestamp | null, language: Language, t: T): string {
  if (!createdAt) return '';

  let date: Date;
  try {
    date = createdAt.toDate();
  } catch {
    return '';
  }
  const ms = date.getTime();
  if (!Number.isFinite(ms)) return '';

  const diff = Date.now() - ms;
  if (diff < 0) return t('notifications.justNow');

  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('notifications.justNow');

  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  // Older than a month → an absolute, locale-appropriate date is clearer.
  if (days > 30) {
    return date.toLocaleDateString(language === 'ne' ? 'ne-NP' : 'en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  let n: number;
  let enUnit: string;
  let neUnit: string;
  if (days >= 1) {
    n = days;
    enUnit = 'd';
    neUnit = 'दिन';
  } else if (hours >= 1) {
    n = hours;
    enUnit = 'h';
    neUnit = 'घण्टा';
  } else {
    n = mins;
    enUnit = 'm';
    neUnit = 'मिनेट';
  }

  const time = language === 'ne' ? `${toNepaliDigits(n)} ${neUnit}` : `${n}${enUnit}`;
  return t('notifications.ago', { time });
}
