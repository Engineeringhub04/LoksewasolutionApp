// Unified notification inbox: private per-user notifications plus one-copy global
// announcements. Global rows avoid fan-out writes and keep read state locally per
// account; personal rows keep their durable Firestore read state.
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { runQuery, updateDocument, commitWrites, setWrite, type FirestoreTimestamp } from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';

export type NotificationSource = 'personal' | 'global';

export interface AppNotification {
  id: string;
  icon: string;
  title: string;
  preview: string;
  read: boolean;
  createdAt: FirestoreTimestamp | null;
  deepLink?: string;
  category?: string;
  imageUrl?: string | null;
  source?: NotificationSource;
  updatedNotice?: boolean;
}

function notificationsPath(uid: string): string {
  return `${Collections.users}/${uid}/notifications`;
}

const GLOBAL_COLLECTION = 'app_global_notification';
const GLOBAL_PREFIX = 'global:';

function globalReadKey(uid: string): string {
  return `loksewa:globalNotificationReadIds:${uid}`;
}

async function getGlobalReadIds(uid: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(globalReadKey(uid));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []);
  } catch {
    return new Set();
  }
}

export async function addGlobalReadIds(uid: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  try {
    const current = await getGlobalReadIds(uid);
    for (const id of ids) current.add(id);
    await AsyncStorage.setItem(globalReadKey(uid), JSON.stringify([...current]));
  } catch {
    // Local read-state is best effort; a failed write only leaves the row unread.
  }
}

export async function addGlobalReadId(uid: string, id: string): Promise<void> {
  await addGlobalReadIds(uid, [id]);
}

export async function fetchNotifications(uid: string, max?: number): Promise<AppNotification[]> {
  // Do not order on createdAt at the server: Firestore excludes legacy documents
  // that do not contain the ordered field. Read the inbox, then sort after merge.
  const rows = await runQuery(notificationsPath(uid), max ? { limit: max } : {});
  return rows.map((row) => ({
    ...(row as unknown as AppNotification),
    source: 'personal' as const,
    category: normalizeLegacyCategory(row.category),
  }));
}

export async function fetchGlobalNotifications(uid: string, max?: number): Promise<AppNotification[]> {
  const [rows, readIds] = await Promise.all([
    runQuery(GLOBAL_COLLECTION, max ? { limit: max } : {}),
    getGlobalReadIds(uid),
  ]);
  return rows
    // A Not-login-only campaign is tray-push only; signed-in users must not see
    // its shared audit record in their in-app notification inbox.
    .filter((row) => row.segment !== 'nonlogin')
    .map((row) => {
    const id = `${GLOBAL_PREFIX}${String(row.id)}`;
    return {
      id,
      icon: String(row.icon || 'notifications'),
      title: String(row.title || 'Notification'),
      preview: String(row.preview || row.bodyLogin || row.body || ''),
      read: readIds.has(id),
      createdAt: (row.createdAt as FirestoreTimestamp) ?? null,
      deepLink: typeof row.deepLink === 'string' ? row.deepLink : undefined,
      category: normalizeLegacyCategory(row.category),
      imageUrl: typeof row.imageUrl === 'string' ? row.imageUrl : null,
      source: 'global',
      updatedNotice: row.updatedNotice === true,
    } satisfies AppNotification;
  });
}

export async function fetchInbox(uid: string, _displayName?: string, max?: number): Promise<AppNotification[]> {
  const [personal, global] = await Promise.all([
    fetchNotifications(uid, max),
    fetchGlobalNotifications(uid, max).catch(() => [] as AppNotification[]),
  ]);
  const merged = [...personal, ...global]
    .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
  return max ? merged.slice(0, max) : merged;
}

export async function markNotificationRead(uid: string, id: string): Promise<void> {
  await updateDocument(`${notificationsPath(uid)}/${id}`, { read: true });
}

export async function markAllNotificationsRead(uid: string): Promise<void> {
  const rows = await runQuery(notificationsPath(uid));
  const writes = rows.map((row) => setWrite(`${notificationsPath(uid)}/${row.id}`, { read: true }, { merge: true }));
  for (let index = 0; index < writes.length; index += 400) {
    await commitWrites(writes.slice(index, index + 400));
  }
}

export function categoryIcon(category?: string): keyof typeof Ionicons.glyphMap {
  const value = (category || '').toLowerCase();
  if (value.includes('course') || value.includes('class')) return 'school-outline';
  if (value.includes('mcq') || value.includes('test') || value.includes('exam')) return 'clipboard-outline';
  if (value.includes('update') || value.includes('version')) return 'cloud-download-outline';
  if (value.includes('problem') || value.includes('maintenance')) return 'construct-outline';
  if (value.includes('result') || value.includes('achievement')) return 'trophy-outline';
  if (value.includes('user') || value.includes('personal')) return 'person-outline';
  return 'notifications-outline';
}

function normalizeLegacyCategory(value: unknown): string {
  if (value === 'app') return 'App Notice';
  if (value === 'user') return 'User / Personal';
  if (value === 'other') return 'Other';
  return typeof value === 'string' && value.trim() ? value.trim() : 'App Notice';
}
