// Content read services (PRD §47.3): Subjects, Chapters, Topics, Notices,
// Current Affairs, Gorkhapatra. Thin wrappers over Firestore REST queries.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDocument, listDocuments, runQuery, type FirestoreTimestamp } from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';

export interface Subject {
  id: string;
  name: string;
  icon: string;
  chapterCount: number;
}

export interface Chapter {
  id: string;
  title: string;
  topicCount: number;
}

export interface Topic {
  id: string;
  title: string;
  body: string;
}

export interface Notice {
  id: string;
  title: string;
  body: string;
  featuredOnHome: boolean;
  date: { toDate: () => Date } | null;
}

export interface CurrentAffairItem {
  id: string;
  headline: string;
  summary: string;
  category: string;
  date: { toDate: () => Date } | null;
}

/**
 * A single ordered piece of a Gorkhapatra post body, reconstructed natively
 * (NOT an iframe/webview — the user explicitly rejected webview). Images point
 * to the app's own Cloudinary re-host so they survive if the source site later
 * renames or removes the original file.
 */
export interface GorkhapatraBlock {
  type: 'heading' | 'text' | 'image';
  /** heading/paragraph text (for 'heading' and 'text' blocks) */
  text?: string;
  /** image source — a Cloudinary URL (for 'image' blocks) */
  url?: string;
  /** optional image caption */
  caption?: string;
  /** natural pixel size of the image, if the scraper could read it, so the
   *  renderer can preserve aspect ratio instead of guessing a fixed height */
  width?: number;
  height?: number;
}

/**
 * One Gorkhapatra Loksewa post. Authored by an admin and written to Firestore
 * out-of-band — client writes are locked to admins by Security Rules and
 * ordinary users only read it. The document id equals `slug` (a stable key), so
 * the detail screen is a single direct read and re-writing the same post is
 * idempotent (overwrites in place, never duplicates).
 */
export interface GorkhapatraPost {
  id: string;
  /** dedupe key; also the Firestore document id */
  slug: string;
  title: string;
  /** original article URL for the "open original" link; empty for manual posts */
  sourceUrl: string;
  /** publish instant (AD) — drives list ordering and pagination only */
  publishedAt: FirestoreTimestamp | null;
  /** verbatim Bikram Sambat date string from the source, e.g. "२४ भदौ २०८३, बुधबार".
   *  Shown as-is on the card/detail date chip — nicer for Nepali readers and avoids
   *  any BS→AD conversion drift being visible. Falls back to a formatted publishedAt. */
  dateLabel?: string | null;
  /** when the scraper ingested it */
  fetchedAt?: FirestoreTimestamp | null;
  /** Cloudinary cover image for the card and the detail hero (optional) */
  coverImage?: string | null;
  /** short summary shown on the list card */
  excerpt?: string;
  /** ordered native body blocks (text/headings/images) */
  blocks: GorkhapatraBlock[];
  /** true on "question set" days → the card/detail shows a badge */
  isQuestionSet?: boolean;
  /** free-form label shown as the card badge, authored per post in the seed data
   *  (e.g. "New topic", "Question set"). DB-driven so the badge is NOT hardcoded in
   *  the UI; when absent the card falls back to the question-set label. */
  tag?: string | null;
  /** optional category label, e.g. "लोकसेवा" */
  category?: string | null;
  /** the app renders only 'published'; 'hidden' lets an admin pull a bad post */
  status?: 'published' | 'hidden';
  /** provenance, e.g. "gorkhapatraonline.com" */
  source?: string;
}

export async function fetchSubjects(): Promise<Subject[]> {
  return (await listDocuments(Collections.subjects)) as unknown as Subject[];
}

export async function fetchSubject(subjectId: string): Promise<Subject | null> {
  return (await getDocument(`${Collections.subjects}/${subjectId}`)) as Subject | null;
}

export async function fetchChapters(subjectId: string): Promise<Chapter[]> {
  return (await listDocuments(Collections.chapters(subjectId))) as unknown as Chapter[];
}

export async function fetchTopics(subjectId: string, chapterId: string): Promise<Topic[]> {
  return (await listDocuments(Collections.topics(subjectId, chapterId))) as unknown as Topic[];
}

export async function fetchTopic(subjectId: string, chapterId: string, topicId: string): Promise<Topic | null> {
  return (await getDocument(`${Collections.topics(subjectId, chapterId)}/${topicId}`)) as Topic | null;
}

export async function fetchNotices(max = 20): Promise<Notice[]> {
  return (await runQuery(Collections.notices, {
    orderBy: [{ field: 'date', direction: 'desc' }],
    limit: max,
  })) as unknown as Notice[];
}

export async function fetchCurrentAffairs(max = 30): Promise<CurrentAffairItem[]> {
  return (await runQuery(Collections.currentAffairs, {
    orderBy: [{ field: 'date', direction: 'desc' }],
    limit: max,
  })) as unknown as CurrentAffairItem[];
}

// Small page size keeps the first read cheap: with a handful of manual posts the
// whole feed is one page, and each Firestore read is billed per document, so a
// tighter page caps how many docs a single query can ever pull.
export const GORKHAPATRA_PAGE_SIZE = 10;

// ---------- Read cache (keep Firestore reads very low) ----------
//
// Gorkhapatra posts change only when an admin taps "Seed". Re-reading the whole
// feed on every open would burn the daily read quota, so reads are gated three
// ways, cheapest first:
//
//   1. In-memory cache (0 reads) — serves repeat opens within one session/TTL.
//   2. Persistent cache in AsyncStorage, gated by a version token (1 cheap read)
//      — after an app restart we read ONE tiny `meta/gorkhapatra` doc to learn the
//      current version; if it matches what we stored, we serve the saved feed and
//      skip the (N-document) list query entirely. So a normal open costs a single
//      read no matter how many posts exist.
//   3. Full list query (N reads) — only when the version changed (admin edited),
//      the persistent cache is missing, or a refresh is forced.
//
// The seeder bumps `meta/gorkhapatra.updatedAt` and calls
// invalidateGorkhapatraCache(), so a fresh seed is picked up on the next open.
const GORKHAPATRA_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const GORKHAPATRA_LIST_STORAGE_KEY = 'loksewa:gorkhapatra:list:v1';
let gorkhapatraListCache: { at: number; posts: GorkhapatraPost[] } | null = null;
const gorkhapatraPostCache = new Map<string, { at: number; post: GorkhapatraPost | null }>();

const cacheFresh = (at: number) => Date.now() - at < GORKHAPATRA_CACHE_TTL_MS;

// FirestoreTimestamp is a shim of two functions (toDate/toMillis) — JSON.stringify
// silently drops functions, so before persisting we convert any timestamp to a
// plain { __ts: millis } marker and revive it back into the shim on load. Walks
// the whole object graph so nested timestamps (now or later) are handled too.
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

async function loadPersistentGorkhapatraList(): Promise<{ version: number; posts: GorkhapatraPost[] } | null> {
  try {
    const raw = await AsyncStorage.getItem(GORKHAPATRA_LIST_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { version?: unknown; posts?: unknown };
    if (typeof parsed.version !== 'number' || !Array.isArray(parsed.posts)) return null;
    return { version: parsed.version, posts: reviveFromStorage(parsed.posts) as GorkhapatraPost[] };
  } catch {
    return null; // corrupt/unreadable cache → treat as cold
  }
}

async function savePersistentGorkhapatraList(version: number, posts: GorkhapatraPost[]): Promise<void> {
  try {
    await AsyncStorage.setItem(
      GORKHAPATRA_LIST_STORAGE_KEY,
      JSON.stringify({ version, posts: serializeForStorage(posts) }),
    );
  } catch {
    // best-effort: a failed write just means the next open re-queries
  }
}

/** Read the tiny version doc the seeder bumps. Returns updatedAt in ms, or null
 *  if the doc is missing/unreadable (then we can't version-gate and fall back to
 *  a normal query). One cheap single-document read. */
async function fetchGorkhapatraVersion(): Promise<number | null> {
  try {
    const meta = await getDocument(`${Collections.meta}/gorkhapatra`);
    const updatedAt = meta?.updatedAt as FirestoreTimestamp | undefined;
    return updatedAt && typeof updatedAt.toMillis === 'function' ? updatedAt.toMillis() : null;
  } catch {
    return null;
  }
}

/** Warm the in-memory list + per-slug caches from a set of posts. */
function warmGorkhapatraCaches(posts: GorkhapatraPost[]): void {
  const now = Date.now();
  for (const post of posts) {
    if (post.slug) gorkhapatraPostCache.set(post.slug, { at: now, post });
  }
  gorkhapatraListCache = { at: now, posts };
}

/** Drop every cached Gorkhapatra read (in-memory + persistent). Call right after
 *  seeding/editing posts. The persistent clear is fire-and-forget. */
export function invalidateGorkhapatraCache(): void {
  gorkhapatraListCache = null;
  gorkhapatraPostCache.clear();
  AsyncStorage.removeItem(GORKHAPATRA_LIST_STORAGE_KEY).catch(() => {});
}

/**
 * Latest Gorkhapatra posts, newest first. Pagination is cursor-based on
 * `publishedAt`: pass `before` (the oldest publishedAt you already hold) to get
 * the next page. Using an inequality filter + orderBy on the SAME field needs
 * only the automatic single-field index — no composite index to create — so this
 * stays Spark-plan friendly. Posts flagged `status: 'hidden'` are dropped here.
 *
 * The first page is version-gated (see the cache notes above): a normal cold open
 * costs one small read, an in-session open costs none, and the multi-document list
 * query runs only when posts actually changed or `force` is set (pull-to-refresh).
 * Listed posts are also warmed into the per-slug cache so opening one costs zero
 * extra reads.
 */
export async function fetchGorkhapatraPosts(
  options: { limit?: number; before?: Date; force?: boolean } = {},
): Promise<GorkhapatraPost[]> {
  const limit = options.limit ?? GORKHAPATRA_PAGE_SIZE;
  const cacheable = !options.before && limit === GORKHAPATRA_PAGE_SIZE;

  // Non-first-page (pagination) requests bypass the cache entirely.
  if (!cacheable) {
    const rows = await runQuery(Collections.gorkhapatra, {
      where: options.before ? [{ field: 'publishedAt', op: '<', value: options.before }] : undefined,
      orderBy: [{ field: 'publishedAt', direction: 'desc' }],
      limit,
    });
    return (rows as unknown as GorkhapatraPost[]).filter((post) => post.status !== 'hidden');
  }

  // 1. In-memory fast path — 0 reads.
  if (!options.force && gorkhapatraListCache && cacheFresh(gorkhapatraListCache.at)) {
    return gorkhapatraListCache.posts;
  }

  // 2. Version check (1 cheap read). If the version is unchanged and we hold a
  //    matching persistent cache, serve it and skip the list query.
  const version = await fetchGorkhapatraVersion();
  if (!options.force && version != null) {
    const persisted = await loadPersistentGorkhapatraList();
    if (persisted && persisted.version === version) {
      warmGorkhapatraCaches(persisted.posts);
      return persisted.posts;
    }
  }

  // 3. Full list query — only reached on change / force / cold cache.
  const rows = await runQuery(Collections.gorkhapatra, {
    orderBy: [{ field: 'publishedAt', direction: 'desc' }],
    limit,
  });
  const posts = (rows as unknown as GorkhapatraPost[]).filter((post) => post.status !== 'hidden');

  warmGorkhapatraCaches(posts);
  if (version != null) void savePersistentGorkhapatraList(version, posts);

  return posts;
}

/**
 * One Gorkhapatra post by slug (== document id). Served from the cache warmed by
 * the list (or a prior read) when fresh, so the detail screen usually costs zero
 * reads. A single direct read otherwise — never a query.
 */
export async function fetchGorkhapatraPost(
  slug: string,
  options: { force?: boolean } = {},
): Promise<GorkhapatraPost | null> {
  const cached = gorkhapatraPostCache.get(slug);
  if (!options.force && cached && cacheFresh(cached.at)) {
    return cached.post;
  }
  const post = (await getDocument(`${Collections.gorkhapatra}/${slug}`)) as GorkhapatraPost | null;
  gorkhapatraPostCache.set(slug, { at: Date.now(), post });
  return post;
}
