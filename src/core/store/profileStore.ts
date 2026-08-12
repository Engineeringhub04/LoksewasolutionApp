// Shared user-profile state.
//
// Two problems this solves:
//
// 1. COLD START — the Profile tab used to fetch on mount, so opening it always
//    showed a loader first. The root layout now warms this store in the
//    background as soon as a session exists, so by the time the user taps
//    Profile the real data is already there.
//
// 2. CROSS-SCREEN STALENESS — Home and Profile each fetched their own copy, so
//    changing your photo in Edit Profile left the Home header showing the old
//    one until a manual refresh. Every screen now reads this single store and
//    Edit Profile pushes its saved values straight into it, so all screens
//    update together the moment a save succeeds.
import { create } from 'zustand';
import { fetchUserProfile, ensureUserStats, type UserProfile } from '@/src/core/firebase/services/profile';
import { fetchUserCourseInfo, type UserCourseInfo } from '@/src/core/firebase/services/courses';

interface ProfileState {
  profile: UserProfile | null;
  courseInfo: UserCourseInfo | null;
  /** True only for the very first load, so screens can skip their spinner on refetches. */
  loading: boolean;
  refreshing: boolean;
  error: boolean;
  /** uid the current data belongs to — guards against showing a previous user's data. */
  loadedUid: string | null;

  load: (uid: string, opts?: { force?: boolean; refresh?: boolean }) => Promise<void>;
  /** Merge locally-known changes so every screen re-renders immediately. */
  applyLocalPatch: (patch: Partial<UserProfile>) => void;
  clear: () => void;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  courseInfo: null,
  loading: false,
  refreshing: false,
  error: false,
  loadedUid: null,

  load: async (uid, opts) => {
    const state = get();
    const alreadyLoaded = state.loadedUid === uid && state.profile !== null;
    if (alreadyLoaded && !opts?.force && !opts?.refresh) return;

    set(
      opts?.refresh
        ? { refreshing: true, error: false }
        : { loading: !alreadyLoaded, error: false }
    );

    try {
      // Backfills the stats map for accounts created before it existed.
      await ensureUserStats(uid).catch(() => {});
      const [profile, courseInfo] = await Promise.all([
        fetchUserProfile(uid),
        fetchUserCourseInfo(uid).catch(() => null),
      ]);
      set({ profile, courseInfo, loadedUid: uid, loading: false, refreshing: false, error: false });
    } catch {
      set({ loading: false, refreshing: false, error: true });
    }
  },

  applyLocalPatch: (patch) => {
    const current = get().profile;
    if (!current) return;
    set({ profile: { ...current, ...patch } });
  },

  clear: () => set({ profile: null, courseInfo: null, loadedUid: null, loading: false, refreshing: false, error: false }),
}));
