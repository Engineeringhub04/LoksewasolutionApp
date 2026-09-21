// Bookmark session state — the single source of truth for "is this saved?".
//
// WHY a store: the bookmark icon lives on a dozen screens (exam quiz, subject
// read/practice, GK & PM read/practice, daily test, QOTD, articles…). Each one
// needs to know instantly whether the current item is already saved and whether
// the free-tier cap has been hit. Re-querying Firestore per icon would be both
// slow and expensive, so the whole (small, ≤15-per-sub-course) list is loaded
// once per session and mutated optimistically from then on.
import { create } from 'zustand';
import {
  addBookmark,
  bookmarkDocId,
  fetchBookmarks,
  removeBookmark,
  BOOKMARK_LIMIT_PER_SUBCOURSE,
  type AddBookmarkInput,
  type Bookmark,
  type BookmarkContext,
} from '@/src/core/firebase/services/bookmarks';

/** What actually happened, so the caller can pick the right toast. */
export type BookmarkToggleResult = 'added' | 'removed' | 'limit' | 'error' | 'signin';

interface BookmarkState {
  items: Bookmark[];
  loadedUid: string | null;
  loading: boolean;
  error: boolean;
  /** Doc ids currently mid-write — used to disable the icon while it settles. */
  pending: string[];
  load: (uid: string, force?: boolean) => Promise<void>;
  isSaved: (context: BookmarkContext, refId: string) => boolean;
  isPending: (context: BookmarkContext, refId: string) => boolean;
  /** How many bookmarks the user holds inside one sub-course. */
  countFor: (subcourseId: string | null | undefined) => number;
  /** True when this sub-course has reached the free-tier cap. */
  isLimitReached: (subcourseId: string | null | undefined, premium: boolean) => boolean;
  toggle: (uid: string | null, input: AddBookmarkInput, premium: boolean) => Promise<BookmarkToggleResult>;
  remove: (uid: string, bookmarkId: string) => Promise<boolean>;
  clear: () => void;
}

export const useBookmarkStore = create<BookmarkState>((set, get) => ({
  items: [],
  loadedUid: null,
  loading: false,
  error: false,
  pending: [],

  load: async (uid, force = false) => {
    const state = get();
    if (!uid) return;
    if (!force && state.loadedUid === uid && !state.error) return;
    if (state.loading) return;
    set({ loading: true, error: false });
    try {
      const items = await fetchBookmarks(uid);
      set({ items, loadedUid: uid, loading: false, error: false });
    } catch {
      set({ loading: false, error: true });
    }
  },

  isSaved: (context, refId) => {
    const id = bookmarkDocId(context, refId);
    return get().items.some((item) => item.id === id);
  },

  isPending: (context, refId) => get().pending.includes(bookmarkDocId(context, refId)),

  countFor: (subcourseId) => {
    const items = get().items;
    if (!subcourseId) return items.length;
    // Legacy docs carry no sub-course; count them everywhere rather than letting
    // them slip past the cap entirely.
    return items.filter((item) => !item.subcourseId || item.subcourseId === subcourseId).length;
  },

  isLimitReached: (subcourseId, premium) => {
    if (premium) return false;
    return get().countFor(subcourseId) >= BOOKMARK_LIMIT_PER_SUBCOURSE;
  },

  toggle: async (uid, input, premium) => {
    if (!uid) return 'signin';
    const docId = bookmarkDocId(input.context, input.refId);
    if (get().pending.includes(docId)) return 'error';
    const existing = get().items.find((item) => item.id === docId);

    if (existing) {
      set((s) => ({ items: s.items.filter((item) => item.id !== docId), pending: [...s.pending, docId] }));
      try {
        await removeBookmark(uid, docId);
        return 'removed';
      } catch {
        // Put it back — the icon must never lie about what the server holds.
        set((s) => ({ items: [existing, ...s.items] }));
        return 'error';
      } finally {
        set((s) => ({ pending: s.pending.filter((id) => id !== docId) }));
      }
    }

    if (get().isLimitReached(input.subcourseId, premium)) return 'limit';

    const optimistic: Bookmark = {
      id: docId,
      kind: input.kind,
      context: input.context,
      refId: input.refId,
      title: input.title,
      preview: input.preview ?? null,
      sourceLabel: input.sourceLabel ?? null,
      courseId: input.courseId ?? null,
      subcourseId: input.subcourseId ?? null,
      payload: input.payload ?? null,
      createdAt: { toDate: () => new Date(), toMillis: () => Date.now() },
    };
    set((s) => ({ items: [optimistic, ...s.items], pending: [...s.pending, docId] }));
    try {
      await addBookmark(uid, input);
      return 'added';
    } catch {
      set((s) => ({ items: s.items.filter((item) => item.id !== docId) }));
      return 'error';
    } finally {
      set((s) => ({ pending: s.pending.filter((id) => id !== docId) }));
    }
  },

  remove: async (uid, bookmarkId) => {
    const existing = get().items.find((item) => item.id === bookmarkId);
    if (!existing) return false;
    set((s) => ({ items: s.items.filter((item) => item.id !== bookmarkId) }));
    try {
      await removeBookmark(uid, bookmarkId);
      return true;
    } catch {
      set((s) => ({ items: [existing, ...s.items] }));
      return false;
    }
  },

  clear: () => set({ items: [], loadedUid: null, loading: false, error: false, pending: [] }),
}));
