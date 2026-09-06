// Bookmarks (PRD §47.4): generic across content type, user-scoped.
import { runQuery, setDocument, deleteDocument, serverTimestamp, type FirestoreTimestamp } from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';

export type BookmarkType = 'note' | 'currentAffairs' | 'question' | 'discussion';

export interface Bookmark {
  id: string;
  type: BookmarkType;
  refId: string;
  title: string;
  preview?: string;
  createdAt: FirestoreTimestamp | null;
}

function bookmarksPath(uid: string): string {
  return `${Collections.users}/${uid}/bookmarks`;
}

export async function fetchBookmarks(uid: string): Promise<Bookmark[]> {
  return (await runQuery(bookmarksPath(uid), {
    orderBy: [{ field: 'createdAt', direction: 'desc' }],
  })) as unknown as Bookmark[];
}

export async function addBookmark(uid: string, type: BookmarkType, refId: string, title: string, preview?: string): Promise<void> {
  await setDocument(`${bookmarksPath(uid)}/${type}_${refId}`, {
    type,
    refId,
    title,
    preview: preview ?? null,
    createdAt: serverTimestamp(),
  });
}

export async function removeBookmark(uid: string, bookmarkId: string): Promise<void> {
  await deleteDocument(`${bookmarksPath(uid)}/${bookmarkId}`);
}
