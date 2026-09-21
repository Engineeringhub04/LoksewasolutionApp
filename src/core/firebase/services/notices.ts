// Notice board read service — the Firestore-backed replacement for the old
// hardcoded APP_NOTICES list. Follows the exact same three-tier low-read cache
// as Gorkhapatra (see content.ts for the full rationale): a normal open costs
// ONE tiny `meta/notices` version read no matter how many notices exist, an
// in-session reopen costs zero, and the N-document list query only runs when
// an admin actually changed something (the admin site bumps meta/notices on
// every save/delete, exactly like the Gorkhapatra seeder does).
//
// Schema contract (written by the admin site, locked by Security Rules):
//   id                    — doc id == slug, so the detail screen is one read
//   title                 — required
//   kind                  — presentational category (feature|update|maintenance|exam|welcome)
//   excerpt               — short summary for list cards
//   blocks                — ordered content blocks; images carry number tags
//                           by their position, which the push notification
//                           references ("show image N from this notice")
//   downloadEnabled       — optional: when true the notice page shows a
//                           download button beside the header
//   downloadUrl           — the link that button opens
//   targetSubcourseIds    — empty = everyone; non-empty = only enrolled users
//                           of those sub-courses see it (and only they get the
//                           push). Filtered client-side so the cached list
//                           serves every user from one shared blob.
//   notificationImageNumber — which numbered image the push shows; null falls
//                           back to the admin's default setting
//   status                — 'published' | 'hidden' (hidden = pulled by admin)
//   publishedAt           — drives ordering + the date chip
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDocument, runQuery, type FirestoreTimestamp } from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';

export type NoticeKind = 'feature' | 'update' | 'maintenance' | 'exam' | 'welcome';

/** One ordered piece of a notice body — same shape as a Gorkhapatra block. */
export interface NoticeBlock {
  type: 'heading' | 'text' | 'image';
  text?: string;
  url?: string;
  caption?: string;
  /**
   * Inline images authored INSIDE a paragraph: the admin's editor places
   * `[img:KEY]` tokens in the text, and this map holds what each token shows.
   * The renderer splits the paragraph at the tokens and draws the image right
   * there, in the flow of the text.
   */
  images?: Record<string, { url: string; caption?: string }> | null;
}

export interface Notice {
  id: string;
  title: string;
  kind?: NoticeKind | null;
  /** Free-form admin label (custom categories authored in the admin site). */
  category?: string | null;
  excerpt?: string;
  blocks: NoticeBlock[];
  downloadEnabled?: boolean;
  downloadUrl?: string | null;
  /** Admin-authored call-to-action shown on the button (e.g. "View official
   *  site"). Falls back to the generic word when blank. */
  downloadLabel?: string | null;
  /** Empty/null = visible to everyone (and pushed to everyone). */
  targetSubcourseIds?: string[] | null;
  /** 1-based image number for the push; null = use the admin default. */
  notificationImageNumber?: number | null;
  status?: 'published' | 'hidden';
  /**
   * Admin-typed Nepali date shown verbatim on cards and the detail page
   * (e.g. "२३ भदौ २०८३"). Falls back to formatting publishedAt when blank —
   * which stays in English.
   */
  dateLabel?: string | null;
  publishedAt: FirestoreTimestamp | null;
  updatedAt?: FirestoreTimestamp | null;
}

/** The numbered images of a notice, in order — the push picks from these. */
export function noticeImages(notice: Notice): string[] {
  return (notice.blocks ?? [])
    .filter((block) => block.type === 'image' && block.url)
    .map((block) => block.url!);
}

/**
 * The image a push notification for this notice should show, resolved the way
 * the admin site resolves it: the notice's own per-post number wins; a blank
 * falls back to the admin-set default; with no images at all nothing is sent.
 * `defaultImageNumber` comes from meta/notice_notification_config.
 */
export function resolveNotificationImage(
  notice: Notice,
  defaultImageNumber: number | null,
): string | null {
  const images = noticeImages(notice);
  if (images.length === 0) return null;
  const wanted = notice.notificationImageNumber ?? defaultImageNumber ?? 1;
  const index = Math.min(Math.max(Math.trunc(wanted), 1), images.length) - 1;
  return images[index];
}

/** True when the notice should be visible to a user enrolled in `subcourseId`. */
export function noticeTargetsSubcourse(notice: Notice, subcourseId: string | null): boolean {
  const targets = notice.targetSubcourseIds ?? [];
  // No targeting = broadcast to everyone, including users who never finished
  // course setup.
  if (targets.length === 0) return true;
  return !!subcourseId && targets.includes(subcourseId);
}

// ---------- Three-tier read cache (identical recipe to Gorkhapatra) ----------

const NOTICE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const NOTICE_LIST_STORAGE_KEY = 'loksewa:notices:list:v1';
/** Fetch more than we show so "Recent Notices" and the full list share one blob. */
export const NOTICE_PAGE_SIZE = 30;

let noticeListCache: { at: number; notices: Notice[] } | null = null;
const noticeCache = new Map<string, { at: number; notice: Notice | null }>();

const cacheFresh = (at: number) => Date.now() - at < NOTICE_CACHE_TTL_MS;

// Timestamps are function shims and die in JSON.stringify, so they travel to
// AsyncStorage as { __ts: millis } markers and are revived on the way back out.
// Copied verbatim from content.ts so both caches behave identically.
function serializeForStorage(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return { __ts: (value as FirestoreTimestamp).toMillis() };
  }
  if (Array.isArray(value)) return value.map(serializeForStorage);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = serializeForStorage(v);
  return out;
}

function reviveFromStorage(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(reviveFromStorage);
  const obj = value as Record<string, unknown>;
  if (typeof obj.__ts === 'number') {
    const ms = obj.__ts;
    return { toDate: () => new Date(ms), toMillis: () => ms } as FirestoreTimestamp;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) out[k] = reviveFromStorage(v);
  return out;
}

async function loadPersistentList(): Promise<{ version: number; notices: Notice[] } | null> {
  try {
    const raw = await AsyncStorage.getItem(NOTICE_LIST_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { version?: unknown; notices?: unknown };
    if (typeof parsed.version !== 'number' || !Array.isArray(parsed.notices)) return null;
    return { version: parsed.version, notices: reviveFromStorage(parsed.notices) as Notice[] };
  } catch {
    return null;
  }
}

async function savePersistentList(version: number, notices: Notice[]): Promise<void> {
  try {
    await AsyncStorage.setItem(
      NOTICE_LIST_STORAGE_KEY,
      JSON.stringify({ version, notices: serializeForStorage(notices) }),
    );
  } catch {
    // best-effort: a failed write just means the next open re-queries
  }
}

/** One cheap read of the version doc the admin bumps on every change. */
async function fetchVersion(): Promise<number | null> {
  try {
    const meta = await getDocument(`${Collections.meta}/notices`);
    const updatedAt = meta?.updatedAt as FirestoreTimestamp | undefined;
    return updatedAt && typeof updatedAt.toMillis === 'function' ? updatedAt.toMillis() : null;
  } catch {
    return null;
  }
}

function warmCaches(notices: Notice[]): void {
  const now = Date.now();
  for (const notice of notices) {
    if (notice.id) noticeCache.set(notice.id, { at: now, notice });
  }
  noticeListCache = { at: now, notices };
}

/** Drop every cached notice read. (App side is read-only — this is for tests
 *  and future in-app invalidation paths; the admin site bumps the version doc.) */
export function invalidateNoticeCache(): void {
  noticeListCache = null;
  noticeCache.clear();
  AsyncStorage.removeItem(NOTICE_LIST_STORAGE_KEY).catch(() => {});
}

/**
 * Published notices, newest first, already filtered to what THIS user may see
 * (`subcourseId` is the user's enrolled subcourse; pass null for a guest).
 * Hidden notices are dropped client-side so read access never depends on
 * `status` — that would need a composite index on a Spark plan.
 */
export async function fetchNotices(
  options: { subcourseId?: string | null; force?: boolean } = {},
): Promise<Notice[]> {
  // 1. In-memory fast path — 0 reads.
  if (!options.force && noticeListCache && cacheFresh(noticeListCache.at)) {
    return visible(noticeListCache.notices, options.subcourseId ?? null);
  }

  // 2. Version check — 1 cheap read; a match serves the AsyncStorage blob.
  const version = await fetchVersion();
  if (!options.force && version != null) {
    const persisted = await loadPersistentList();
    if (persisted && persisted.version === version) {
      warmCaches(persisted.notices);
      return visible(persisted.notices, options.subcourseId ?? null);
    }
  }

  // 3. Full list query — only on change / force / cold cache.
  const rows = await runQuery(Collections.notices, {
    orderBy: [{ field: 'publishedAt', direction: 'desc' }],
    limit: NOTICE_PAGE_SIZE,
  });
  const notices = rows as unknown as Notice[];

  warmCaches(notices);
  if (version != null) void savePersistentList(version, notices);

  return visible(notices, options.subcourseId ?? null);
}

function visible(notices: Notice[], subcourseId: string | null): Notice[] {
  return notices.filter(
    (n) => n.status !== 'hidden' && noticeTargetsSubcourse(n, subcourseId),
  );
}

/**
 * One notice by id (== doc id). Served from the cache the list warmed, so
 * opening a notice from Home or the list usually costs zero reads; a direct
 * read otherwise — never a query.
 */
export async function fetchNotice(
  id: string,
  options: { force?: boolean } = {},
): Promise<Notice | null> {
  const cached = noticeCache.get(id);
  if (!options.force && cached && cacheFresh(cached.at)) return cached.notice;
  const notice = (await getDocument(`${Collections.notices}/${id}`)) as Notice | null;
  noticeCache.set(id, { at: Date.now(), notice });
  return notice;
}
