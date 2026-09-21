// Bookmarks (PRD §47.4): generic across content type, user-scoped.
//
// DESIGN — self-contained snapshots. A bookmark stores a COPY of the content it
// points at (`payload`), not just a reference. That is deliberate: the bookmark
// details page must render the saved item in place and must NOT bounce the user
// back into the exam / subject / GK flow it came from. A snapshot also survives
// the source question being edited or unpublished, and costs zero extra reads.
//
// 'currentAffairs' was dropped on 2026-09-13 with the Current Affairs feature.
// Any legacy docs still carrying that type simply match no tab and stay hidden.
import { runQuery, setDocument, deleteDocument, serverTimestamp, type FirestoreTimestamp } from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';

/** Broad shape of the saved item — drives the tab grouping on the bookmarks page. */
export type BookmarkKind = 'question' | 'read' | 'discussion' | 'note';

/** Exactly WHERE in the app the item was saved from — drives the filter chips + badge. */
export type BookmarkContext =
  | 'exam'
  | 'read'
  | 'practice'
  | 'daily-test'
  | 'qotd'
  | 'quiz'
  | 'discussion'
  | 'article'
  | 'note'
  | 'chapter'
  | 'other';

/** Legacy field kept for older docs written before contexts existed. */
export type BookmarkType = 'note' | 'question' | 'discussion' | 'chapter';

/** The saved copy of the content. Every field is optional — contexts differ wildly. */
export interface BookmarkPayload {
  /** Question text (question-kind bookmarks). */
  question?: string;
  /** Answer choices in display order. */
  options?: string[];
  /** Index into `options` of the correct choice, or -1/undefined when unknown. */
  answerIndex?: number;
  /** Why the answer is right. */
  explanation?: string;
  /** Long-form reading content (read-mode / notes / articles). */
  body?: string;
  /** Extra labelled context rows shown on the details page, e.g. Subject / Chapter / Set. */
  meta?: { label: string; value: string }[];
}

export interface Bookmark {
  id: string;
  kind: BookmarkKind;
  context: BookmarkContext;
  refId: string;
  title: string;
  preview?: string | null;
  /**
   * Human-readable origin shown on the card badge, e.g. "GK · Read Mode" or
   * "Mathematics · Practice". Stored rather than derived so a bookmark keeps its
   * label even if the subject is later renamed or the feature is retired.
   */
  sourceLabel?: string | null;
  /** Course scope at save time — the 15-per-sub-course limit is counted on this. */
  courseId?: string | null;
  subcourseId?: string | null;
  payload?: BookmarkPayload | null;
  createdAt: FirestoreTimestamp | null;
  /** Only present on pre-context documents. */
  type?: BookmarkType;
}

/** Free-tier cap: 15 bookmarks per sub-course. Premium users are uncapped. */
export const BOOKMARK_LIMIT_PER_SUBCOURSE = 15;

function bookmarksPath(uid: string): string {
  return `${Collections.users}/${uid}/bookmarks`;
}

/**
 * Firestore document ids may not contain '/' and must stay short. Question refs
 * are often composite paths ("subjects/math/questions/q1"), so flatten them.
 */
function safeSegment(value: string): string {
  return value
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'item';
}

/** Stable, collision-free id so the same item can never be saved twice. */
export function bookmarkDocId(context: BookmarkContext, refId: string): string {
  return `${context}__${safeSegment(refId)}`;
}

/** Older documents were keyed `${type}_${refId}` — used only when reconciling. */
function legacyDocId(kind: BookmarkKind, refId: string): string {
  return `${kind}_${refId}`;
}

/** Legacy `type` values predate contexts — map them onto the closest one. */
const LEGACY_CONTEXT: Record<BookmarkType, BookmarkContext> = {
  note: 'note',
  question: 'practice',
  discussion: 'discussion',
  chapter: 'chapter',
};

/** Normalises a raw Firestore doc (new or legacy) into a Bookmark. */
function toBookmark(raw: Record<string, unknown>): Bookmark {
  const legacyType = raw.type as BookmarkType | undefined;
  const kind = (raw.kind as BookmarkKind | undefined) ?? (legacyType === 'chapter' ? 'read' : legacyType) ?? 'question';
  const context = (raw.context as BookmarkContext | undefined) ?? (legacyType ? LEGACY_CONTEXT[legacyType] : undefined) ?? 'other';
  return {
    id: String(raw.id ?? ''),
    kind,
    context,
    refId: String(raw.refId ?? ''),
    title: String(raw.title ?? ''),
    preview: (raw.preview as string | null | undefined) ?? null,
    sourceLabel: (raw.sourceLabel as string | null | undefined) ?? null,
    courseId: (raw.courseId as string | null | undefined) ?? null,
    subcourseId: (raw.subcourseId as string | null | undefined) ?? null,
    payload: (raw.payload as BookmarkPayload | null | undefined) ?? null,
    createdAt: (raw.createdAt as FirestoreTimestamp | null | undefined) ?? null,
    type: legacyType,
  };
}

export async function fetchBookmarks(uid: string): Promise<Bookmark[]> {
  const rows = await runQuery(bookmarksPath(uid), {
    orderBy: [{ field: 'createdAt', direction: 'desc' }],
  });
  return rows.map(toBookmark);
}

export interface AddBookmarkInput {
  kind: BookmarkKind;
  context: BookmarkContext;
  refId: string;
  title: string;
  preview?: string;
  sourceLabel?: string;
  courseId?: string | null;
  subcourseId?: string | null;
  payload?: BookmarkPayload;
}

/**
 * Writes (or overwrites) one bookmark and returns the document id.
 * `merge: true` matters: re-saving an item that already exists issues an UPDATE,
 * and a full `set` on an existing doc would be rejected by the security rules.
 */
export async function addBookmark(uid: string, input: AddBookmarkInput): Promise<string> {
  const docId = bookmarkDocId(input.context, input.refId);
  await setDocument(
    `${bookmarksPath(uid)}/${docId}`,
    {
      kind: input.kind,
      context: input.context,
      // Kept so anything still reading the old field keeps working.
      type: input.kind === 'read' ? 'chapter' : input.kind,
      refId: input.refId,
      title: input.title,
      preview: input.preview ?? null,
      sourceLabel: input.sourceLabel ?? null,
      courseId: input.courseId ?? null,
      subcourseId: input.subcourseId ?? null,
      payload: input.payload ?? null,
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
  return docId;
}

export async function removeBookmark(uid: string, bookmarkId: string): Promise<void> {
  await deleteDocument(`${bookmarksPath(uid)}/${bookmarkId}`);
}

/** Deletes a bookmark addressed by its content instead of its doc id. */
export async function removeBookmarkByRef(uid: string, context: BookmarkContext, refId: string, kind?: BookmarkKind): Promise<void> {
  await removeBookmark(uid, bookmarkDocId(context, refId));
  if (kind) {
    // Best-effort cleanup of a pre-context duplicate; a 404 here is expected.
    try {
      await removeBookmark(uid, legacyDocId(kind, refId));
    } catch {
      // ignore
    }
  }
}
