// In-memory record of Daily Test models finished during THIS app session.
//
// Why it exists: Firestore is the source of truth for "already attempted", but
// re-reading it is a read we do not want to spend twice in ten seconds. When the
// user submits a quiz and walks back to the Daily Test landing screen, the card
// must already say "View Result" — not "Start Test" until a pull-to-refresh.
// So the quiz writes its fresh result here on submit, and the landing screen
// merges this map over whatever its last fetch returned. Zero extra reads, and
// the flip is instant because it is a plain store subscription.
//
// Deliberately NOT persisted. It is a cache in front of the server, never a
// substitute for it: on a cold start the landing screen's own query supplies the
// full picture, including models completed on a different phone. Persisting this
// would risk a stale local "completed" hiding a test the account can still take.
import { create } from 'zustand';
import type { DailyTestResult } from '@/src/core/firebase/services/dailyTest';

interface DailyTestCompletionState {
  /** uid → modelId → the result saved this session. */
  byUser: Record<string, Record<string, DailyTestResult>>;
  /** Called right after a successful submit. */
  markCompleted: (uid: string, result: DailyTestResult) => void;
  /** Everything known for a user this session. Stable empty object when nothing. */
  completionsFor: (uid: string | null | undefined) => Record<string, DailyTestResult>;
  /** Drops a user's entries — used on sign-out so the next account starts clean. */
  clearUser: (uid: string) => void;
}

/** Shared frozen empty map, so `completionsFor` never returns a fresh object. */
const EMPTY: Record<string, DailyTestResult> = {};

export const useDailyTestCompletionStore = create<DailyTestCompletionState>((set, get) => ({
  byUser: {},

  markCompleted: (uid, result) => {
    if (!uid || !result.modelId) return;
    set((state) => ({
      byUser: {
        ...state.byUser,
        [uid]: { ...(state.byUser[uid] ?? {}), [result.modelId]: result },
      },
    }));
  },

  completionsFor: (uid) => (uid ? get().byUser[uid] ?? EMPTY : EMPTY),

  clearUser: (uid) =>
    set((state) => {
      if (!state.byUser[uid]) return state;
      const next = { ...state.byUser };
      delete next[uid];
      return { byUser: next };
    }),
}));

/** Imperative helper for non-React callers (the quiz's submit handler). */
export const markDailyTestCompleted = (uid: string, result: DailyTestResult) =>
  useDailyTestCompletionStore.getState().markCompleted(uid, result);
