// In-app notification inbox (PRD §47.7): list, mark-read, mark-all-read.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { runQuery, updateDocument, commitWrites, setWrite, type FirestoreTimestamp } from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';

/**
 * Which inbox tab a notification belongs to:
 * - `app`   — app/admin-wide announcements (new mock test series, maintenance, etc.)
 * - `user`  — activity directed at this specific user (reply to their post, result ready)
 * - `other` — anything that fits neither
 */
export type NotificationCategory = 'app' | 'user' | 'other';

export interface AppNotification {
  id: string;
  icon: string;
  title: string;
  preview: string;
  read: boolean;
  createdAt: FirestoreTimestamp | null;
  deepLink?: string;
  category?: NotificationCategory;
  /**
   * Optional banner image (a hosted URL, e.g. Cloudinary/Firebase). Shown in the
   * inbox row and, on a real build, as a big-picture push in the tray. Absent on
   * text-only notifications.
   */
  imageUrl?: string | null;
  /**
   * True for rows that come from the shared broadcast feed (`app_notifications`
   * docs tagged `kind: 'gorkhapatra'`) rather than this user's private inbox
   * subcollection. Broadcasts are read by every signed-in user — including
   * accounts created long after the broadcast was sent — so their read-state
   * cannot live on the shared doc; it is tracked locally per-uid instead.
   */
  isBroadcast?: boolean;
}

/**
 * Documents written before this field existed have no `category`. Everything
 * produced so far is app/admin-generated, so those fall back to `app` rather
 * than disappearing from every tab.
 */
export function resolveNotificationCategory(n: AppNotification): NotificationCategory {
  return n.category === 'user' || n.category === 'other' ? n.category : 'app';
}

function notificationsPath(uid: string): string {
  return `${Collections.users}/${uid}/notifications`;
}

export async function fetchNotifications(uid: string, max = 50): Promise<AppNotification[]> {
  return (await runQuery(notificationsPath(uid), {
    orderBy: [{ field: 'createdAt', direction: 'desc' }],
    limit: max,
  })) as unknown as AppNotification[];
}

export async function markNotificationRead(uid: string, id: string): Promise<void> {
  await updateDocument(`${notificationsPath(uid)}/${id}`, { read: true });
}

export async function markAllNotificationsRead(uid: string): Promise<void> {
  const notifications = await runQuery(notificationsPath(uid));
  await commitWrites(
    notifications.map((n) => setWrite(`${notificationsPath(uid)}/${n.id}`, { read: true }, { merge: true }))
  );
}

// ---------------------------------------------------------------------------
// Broadcast feed — global notifications every signed-in user must see.
//
// Some announcements (e.g. "a new Gorkhapatra post was just added") must reach
// EVERY login user, including accounts that do not exist yet at send time.
// Writing one inbox doc per user cannot satisfy that — a user created next month
// would miss today's message — and would also be a large fan-out write on the
// Spark plan. So these live ONCE in the shared `app_notifications` collection
// (rule: read if signed-in) tagged `kind: 'gorkhapatra'`. Every user reads the
// same docs, so historical broadcasts stay visible to future accounts for free.
// Because the doc is shared, its read/unread state is per-user LOCAL (AsyncStorage)
// and is never written back to the shared document.
// ---------------------------------------------------------------------------

/** `app_notifications` docs with this `kind` are surfaced as inbox broadcasts. */
const BROADCAST_KIND = 'gorkhapatra';

/** Placeholder the stored login template uses for the recipient's name. */
const NAME_TOKEN = '{{name}}';

/** id prefix so a broadcast row can never collide with a private inbox id. */
const BROADCAST_ID_PREFIX = 'broadcast:';

/**
 * Fills the `{{name}}` placeholder with the user's name at render time. When the
 * name is unknown it falls back to a neutral word and tidies the punctuation that
 * an empty name would leave behind (e.g. "Hello , welcome" → "Hello, welcome").
 */
function personalizeName(template: string, name?: string): string {
  if (!template.includes(NAME_TOKEN)) return template;
  const safe = (name ?? '').trim();
  return template
    .split(NAME_TOKEN)
    .join(safe || 'there')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function broadcastReadKey(uid: string): string {
  return `loksewa:broadcastReadIds:${uid}`;
}

/** This user's local set of already-read broadcast ids. Never throws. */
export async function getBroadcastReadIds(uid: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(broadcastReadKey(uid));
    const arr: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

/** Marks broadcast ids read for this user (local only). Never throws. */
export async function addBroadcastReadIds(uid: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  try {
    const current = await getBroadcastReadIds(uid);
    for (const id of ids) current.add(id);
    await AsyncStorage.setItem(broadcastReadKey(uid), JSON.stringify([...current]));
  } catch {
    // Best-effort: a failed write just means the row re-appears unread next time.
  }
}

/** Single-id convenience wrapper around addBroadcastReadIds. */
export async function addBroadcastReadId(uid: string, id: string): Promise<void> {
  await addBroadcastReadIds(uid, [id]);
}

/**
 * Reads the shared broadcast feed and maps it into inbox rows for this user.
 * The query orders newest-first and caps the window so reads stay bounded; the
 * `kind` filter runs client-side because a `where` + `orderBy` on different
 * fields would otherwise require a composite index. `displayName` personalizes
 * the login copy — the stored template keeps the `{{name}}` placeholder so the
 * SAME doc can greet each reader by their own name.
 */
export async function fetchBroadcastNotifications(
  uid: string,
  displayName?: string,
  max = 30
): Promise<AppNotification[]> {
  const [rows, readIds] = await Promise.all([
    runQuery(Collections.appNotifications, {
      orderBy: [{ field: 'createdAt', direction: 'desc' }],
      limit: 60,
    }),
    getBroadcastReadIds(uid),
  ]);

  const broadcasts: AppNotification[] = [];
  for (const row of rows as Record<string, unknown>[]) {
    if (row.kind !== BROADCAST_KIND) continue;
    const id = `${BROADCAST_ID_PREFIX}${String(row.id)}`;
    const template = (row.bodyLogin as string) || (row.bodyAnon as string) || '';
    broadcasts.push({
      id,
      icon: (row.icon as string) || 'news',
      title: (row.title as string) || 'New notification',
      preview: personalizeName(template, displayName),
      read: readIds.has(id),
      createdAt: (row.createdAt as FirestoreTimestamp) ?? null,
      deepLink: (row.deepLink as string) || undefined,
      category: 'app',
      imageUrl: (row.imageUrl as string) ?? null,
      isBroadcast: true,
    });
    if (broadcasts.length >= max) break;
  }
  return broadcasts;
}

/**
 * The full inbox: this user's private notifications merged with the shared
 * broadcast feed, newest-first. A broadcast failure is swallowed so it can
 * never hide the private inbox, but a private-inbox failure still propagates so
 * the screen keeps showing its error state.
 */
export async function fetchInbox(uid: string, _displayName?: string, max = 50): Promise<AppNotification[]> {
  // Gorkhapatra announcements are tray-push only. Their delivery audit belongs
  // exclusively to Admin → Notification Manager → Gorkhapatra Details, so the
  // mobile Notification page intentionally returns only private inbox records.
  return fetchNotifications(uid, max);
}
