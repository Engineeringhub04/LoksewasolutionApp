import {
  runQuery,
  getDocument,
  createDocument,
  deleteDocument,
  updateDocument,
  setDocument,
  serverTimestamp,
  increment,
  type FirestoreTimestamp,
} from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';
import { getCurrentUid } from '@/src/core/firebase/session';
import { submitToGoogleForm } from '@/src/core/messaging/googleForm';
import { createReportHistory } from '@/src/core/firebase/services/reportHistory';

export interface DiscussionPost {
  id: string;
  title: string;
  body: string;
  category?: string;
  authorName: string;
  authorPhoto?: string | null;
  authorId?: string;
  courseId?: string | null;
  subcourseId?: string | null;
  courseName?: string | null;
  subcourseName?: string | null;
  imageUrl?: string | null;
  linkUrl?: string | null;
  isAdmin?: boolean;
  isSeed?: boolean;
  editedAt?: FirestoreTimestamp | null;
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
  editedAt?: FirestoreTimestamp | null;
  createdAt: FirestoreTimestamp | null;
}

export interface Reply extends Comment {
  parentCommentId: string;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function numberOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function asTimestamp(value: unknown): FirestoreTimestamp | null {
  return (value as FirestoreTimestamp | null | undefined) ?? null;
}

function parsePost(doc: Record<string, unknown>): DiscussionPost {
  return {
    id: typeof doc.id === 'string' ? doc.id : '',
    title: stringOrNull(doc.title) ?? '',
    body: stringOrNull(doc.body) ?? '',
    category: stringOrNull(doc.category) ?? undefined,
    authorName: stringOrNull(doc.authorName) ?? 'Anonymous',
    authorPhoto: stringOrNull(doc.authorPhoto),
    authorId: stringOrNull(doc.authorId) ?? undefined,
    courseId: stringOrNull(doc.courseId),
    subcourseId: stringOrNull(doc.subcourseId),
    courseName: stringOrNull(doc.courseName),
    subcourseName: stringOrNull(doc.subcourseName),
    imageUrl: stringOrNull(doc.imageUrl),
    linkUrl: stringOrNull(doc.linkUrl),
    isAdmin: doc.isAdmin === true,
    isSeed: doc.isSeed === true,
    editedAt: asTimestamp(doc.editedAt),
    likeCount: numberOrZero(doc.likeCount),
    commentCount: numberOrZero(doc.commentCount),
    createdAt: asTimestamp(doc.createdAt),
  };
}

function parseComment(doc: Record<string, unknown>): Comment {
  return {
    id: typeof doc.id === 'string' ? doc.id : '',
    body: stringOrNull(doc.body) ?? '',
    authorName: stringOrNull(doc.authorName) ?? 'Anonymous',
    authorPhoto: stringOrNull(doc.authorPhoto),
    authorId: stringOrNull(doc.authorId) ?? undefined,
    editedAt: asTimestamp(doc.editedAt),
    createdAt: asTimestamp(doc.createdAt),
  };
}

export async function fetchDiscussions(max = 30): Promise<DiscussionPost[]> {
  const docs = await runQuery(Collections.discussions, {
    orderBy: [{ field: 'createdAt', direction: 'desc' }],
    limit: max,
  });
  return docs.map(parsePost);
}

export async function fetchDiscussion(id: string): Promise<DiscussionPost | null> {
  const doc = await getDocument(`${Collections.discussions}/${id}`);
  return doc ? parsePost(doc) : null;
}

export async function createDiscussion(input: {
  title: string;
  body: string;
  category?: string;
  authorName: string;
  authorPhoto?: string | null;
  authorId: string;
  courseId?: string | null;
  subcourseId?: string | null;
  courseName?: string | null;
  subcourseName?: string | null;
  imageUrl?: string | null;
  linkUrl?: string | null;
  isAdmin?: boolean;
  isSeed?: boolean;
}): Promise<string> {
  const { id } = await createDocument(Collections.discussions, {
    ...input,
    isAdmin: input.isAdmin === true,
    isSeed: input.isSeed === true,
    likeCount: 0,
    commentCount: 0,
    createdAt: serverTimestamp(),
    editedAt: null,
  });
  return id;
}

export async function updateDiscussion(id: string, input: { title?: string; body?: string; category?: string; imageUrl?: string | null; linkUrl?: string | null }): Promise<void> {
  await updateDocument(`${Collections.discussions}/${id}`, { ...input, editedAt: serverTimestamp() });
}

export async function deleteDiscussion(id: string): Promise<void> {
  await deleteDocument(`${Collections.discussions}/${id}`);
}

/**
 * Maintains the legacy count while storing a deterministic per-user reaction.
 * The reaction path makes repeated taps idempotent at the data-model level.
 */
export async function isDiscussionLiked(id: string): Promise<boolean> {
  const uid = await getCurrentUid();
  if (!uid) return false;
  const reaction = await getDocument(`${Collections.discussionReactions(id)}/${uid}`);
  return Boolean(reaction);
}

export async function toggleLikeDiscussion(id: string, liked: boolean): Promise<void> {
  const uid = await getCurrentUid();
  if (!uid) throw new Error('AUTH_REQUIRED');
  const reactionPath = `${Collections.discussionReactions(id)}/${uid}`;
  if (liked) {
    await setDocument(reactionPath, { uid, createdAt: serverTimestamp() }, { merge: true });
    await updateDocument(`${Collections.discussions}/${id}`, { likeCount: increment(1) });
  } else {
    await deleteDocument(reactionPath);
    await updateDocument(`${Collections.discussions}/${id}`, { likeCount: increment(-1) });
  }
}

export async function fetchComments(discussionId: string): Promise<Comment[]> {
  const docs = await runQuery(Collections.comments(discussionId), {
    orderBy: [{ field: 'createdAt', direction: 'asc' }],
  });
  return docs.map(parseComment);
}

export async function addComment(
  discussionId: string,
  input: { body: string; authorName: string; authorPhoto?: string | null; authorId: string }
): Promise<string> {
  const { id } = await createDocument(Collections.comments(discussionId), {
    ...input,
    createdAt: serverTimestamp(),
    editedAt: null,
  });
  await updateDocument(`${Collections.discussions}/${discussionId}`, { commentCount: increment(1) });
  return id;
}

export async function updateComment(discussionId: string, commentId: string, body: string): Promise<void> {
  await updateDocument(`${Collections.comments(discussionId)}/${commentId}`, { body, editedAt: serverTimestamp() });
}

export async function deleteComment(discussionId: string, commentId: string): Promise<void> {
  await deleteDocument(`${Collections.comments(discussionId)}/${commentId}`);
  await updateDocument(`${Collections.discussions}/${discussionId}`, { commentCount: increment(-1) });
}

export async function fetchReplies(discussionId: string, commentId: string): Promise<Reply[]> {
  const docs = await runQuery(Collections.replies(discussionId, commentId), {
    orderBy: [{ field: 'createdAt', direction: 'asc' }],
  });
  return docs.map((doc) => ({ ...parseComment(doc), parentCommentId: commentId }));
}

export async function addReply(
  discussionId: string,
  commentId: string,
  input: { body: string; authorName: string; authorPhoto?: string | null; authorId: string }
): Promise<string> {
  const { id } = await createDocument(Collections.replies(discussionId, commentId), {
    ...input,
    parentCommentId: commentId,
    createdAt: serverTimestamp(),
    editedAt: null,
  });
  return id;
}

export async function deleteReply(discussionId: string, commentId: string, replyId: string): Promise<void> {
  await deleteDocument(`${Collections.replies(discussionId, commentId)}/${replyId}`);
}

/**
 * Keeps the existing Google Form → Apps Script → Discord notification path and
 * creates a private Firestore history copy for the new in-app report history.
 */
export async function reportContent(
  targetType: 'post' | 'comment',
  targetId: string,
  reason: string,
  context?: { title?: string | null; preview?: string | null; authorName?: string | null; authorPhoto?: string | null }
): Promise<void> {
  await Promise.all([
    submitToGoogleForm({
      type: 'report',
      issueCategory: `discussion / ${targetType}`,
      questionReference: targetId,
      message: reason,
    }),
    createReportHistory({
      source: targetType === 'post' ? 'discussion' : 'comment',
      targetType,
      targetId,
      targetTitle: context?.title,
      targetPreview: context?.preview,
      targetAuthorName: context?.authorName,
      targetAuthorPhoto: context?.authorPhoto,
      reason,
    }),
  ]);
}
