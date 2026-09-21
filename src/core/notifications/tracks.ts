// Filter tracks for the notification inbox — admins only.
//
// An admin's inbox carries two unrelated things: the notices they receive as a
// user of the app, and the items that arrive because they are an admin (today,
// every incoming report). Mixed into one stream, a busy report queue buries
// everything else, and there is no way to read just one of the two.
//
// The tracks PARTITION the inbox rather than overlapping it: "User" holds
// everything a normal user would also see, and every admin-only category gets a
// track of its own. The counts therefore add up to the "All" count, which is
// what makes a row of chips readable at a glance instead of confusing.
//
// Nothing here is configured anywhere. A track exists because a notification of
// that category is actually in the list right now — so the day a new kind of
// admin feed starts producing rows, its track appears on its own, with no new
// Firestore field, no new rule and no change to this file.
import type { AppNotification } from '@/src/core/firebase/services/notifications';

export const ALL_TRACK = 'all';
export const USER_TRACK = 'user';
/**
 * Category tracks are namespaced so a category someone literally names "all" or
 * "user" in the admin console cannot shadow one of the two fixed tracks.
 */
export const CATEGORY_TRACK_PREFIX = 'category:';

/** Shaped to drop straight into <FilterTrack />. */
export interface NotificationTrack {
  value: string;
  /** Display-ready: a translated string for the fixed tracks, the category's own text otherwise. */
  label: string;
  count: number;
}

export interface TrackLabels {
  all: string;
  user: string;
  /** Used for the rare admin row that carries no category at all. */
  other: string;
}

/**
 * Lower-cased so two spellings of the same category ("New Report" / "new
 * report") share one track. An empty string is a valid key — it is the bucket
 * for a row with no category, and no real category can trim down to it.
 */
function categoryKey(item: AppNotification): string {
  return (item.category ?? '').trim().toLowerCase();
}

/**
 * Builds the chip row: All, User, then one chip per admin-only category present.
 * The label keeps the FIRST spelling actually seen rather than a title-cased
 * guess, so the chip reads exactly like the category printed on the rows it
 * filters to.
 */
export function buildNotificationTracks(
  items: AppNotification[],
  labels: TrackLabels,
): NotificationTrack[] {
  let userCount = 0;
  const categories = new Map<string, { label: string; count: number }>();

  for (const item of items) {
    if (!item.adminOnly) {
      userCount += 1;
      continue;
    }
    const key = categoryKey(item);
    const existing = categories.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      categories.set(key, { label: (item.category ?? '').trim() || labels.other, count: 1 });
    }
  }

  // Alphabetical rather than by count: counts change on every pull-to-refresh,
  // and chips that reorder under the finger are worse than chips in a dull order.
  const derived = Array.from(categories.entries())
    .sort((a, b) => a[1].label.localeCompare(b[1].label))
    .map(([key, entry]) => ({
      value: `${CATEGORY_TRACK_PREFIX}${key}`,
      label: entry.label,
      count: entry.count,
    }));

  return [
    { value: ALL_TRACK, label: labels.all, count: items.length },
    { value: USER_TRACK, label: labels.user, count: userCount },
    ...derived,
  ];
}

/** The rows one track shows. An unknown track falls back to showing everything. */
export function filterByTrack(items: AppNotification[], track: string): AppNotification[] {
  if (track === USER_TRACK) return items.filter((item) => !item.adminOnly);
  if (!track.startsWith(CATEGORY_TRACK_PREFIX)) return items;
  const wanted = track.slice(CATEGORY_TRACK_PREFIX.length);
  return items.filter((item) => item.adminOnly === true && categoryKey(item) === wanted);
}

/**
 * Keeps the selection valid when the list changes underneath it — a track
 * disappears the moment its last notification does. Resolving here instead of in
 * an effect means the list never renders one frame of an empty filter.
 */
export function resolveTrack(tracks: NotificationTrack[], selected: string): string {
  return tracks.some((track) => track.value === selected) ? selected : ALL_TRACK;
}

/**
 * Whether the chip row is worth drawing at all. Two tracks means All and User
 * hold the same rows, so the row would be decoration that does nothing.
 */
export function hasUsefulTracks(tracks: NotificationTrack[]): boolean {
  return tracks.length > 2;
}
