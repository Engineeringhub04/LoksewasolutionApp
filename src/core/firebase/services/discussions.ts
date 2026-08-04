// Discussion / Community services (PRD §47.5).
import {
  runQuery,
  getDocument,
  createDocument,
  deleteDocument,
  updateDocument,
  serverTimestamp,
  increment,
  type FirestoreTimestamp,
} from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';

export interface DiscussionPost {
  id: string;
  title: string;
  body: string;
  category?: string;
  authorName: string;
  authorPhoto?: string | null;
  authorId?: string;
  likeCount: number;
  commentCount: number;
  createdAt: FirestoreTimestamp | null;
}

export interface Comment {
  id: string;
  body: string;
  authorName: string;
  authorPhoto?: string | null;
  authorId?: string;
  createdAt: FirestoreTimestamp | null;
}

export async function fetchDiscussions(max = 30): Promise<DiscussionPost[]> {
  return (await runQuery(Collections.discussions, {
    orderBy: [{ field: 'createdAt', direction: 'desc' }],
    limit: max,
  })) as unknown as DiscussionPost[];
}

export async function fetchDiscussion(id: string): Promise<DiscussionPost | null> {
  return (await getDocument(`${Collections.discussions}/${id}`)) as DiscussionPost | null;
}

export async function createDiscussion(input: {
  title: string;
  body: string;
  category?: string;
  authorName: string;
  authorPhoto?: string | null;
  authorId: string;
}): Promise<string> {
  const { id } = await createDocument(Collections.discussions, {
    ...input,
    likeCount: 0,
    commentCount: 0,
    createdAt: serverTimestamp(),
  });
  return id;
}

export async function deleteDiscussion(id: string): Promise<void> {
  await deleteDocument(`${Collections.discussions}/${id}`);
}

export async function toggleLikeDiscussion(id: string, liked: boolean): Promise<void> {
  await updateDocument(`${Collections.discussions}/${id}`, { likeCount: increment(liked ? 1 : -1) });
}

export async function fetchComments(discussionId: string): Promise<Comment[]> {
  return (await runQuery(Collections.comments(discussionId), {
    orderBy: [{ field: 'createdAt', direction: 'asc' }],
  })) as unknown as Comment[];
}

export async function addComment(
  discussionId: string,
  input: { body: string; authorName: string; authorPhoto?: string | null; authorId: string }
): Promise<string> {
  const { id } = await createDocument(Collections.comments(discussionId), {
    ...input,
    createdAt: serverTimestamp(),
  });
  await updateDocument(`${Collections.discussions}/${discussionId}`, { commentCount: increment(1) });
  return id;
}

export async function deleteComment(discussionId: string, commentId: string): Promise<void> {
  await deleteDocument(`${Collections.comments(discussionId)}/${commentId}`);
  await updateDocument(`${Collections.discussions}/${discussionId}`, { commentCount: increment(-1) });
}

export async function reportContent(targetType: 'post' | 'comment', targetId: string, reason: string): Promise<void> {
  await createDocument(Collections.reports, {
    targetType,
    targetId,
    reason,
    createdAt: serverTimestamp(),
    status: 'open',
  });
}
