// In-app notification inbox (PRD §47.7): list, mark-read, mark-all-read.
import { runQuery, updateDocument, commitWrites, setWrite, type FirestoreTimestamp } from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';

export interface AppNotification {
  id: string;
  icon: string;
  title: string;
  preview: string;
  read: boolean;
  createdAt: FirestoreTimestamp | null;
  deepLink?: string;
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
