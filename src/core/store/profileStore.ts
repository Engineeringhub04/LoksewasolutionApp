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
//
// 3. THE STATS CARD ARRIVING LAST — the card's aggregate used to be fetched by
//    the Profile screen on mount, so it showed a skeleton on every visit even
//    though the number barely moves within a session. It is warmed here now, and
//    anything that recomputes it (the daily snapshot, a Leaderboard or Analytics
//    publish) hands the result straight back via `setScore` rather than making
//    the card pay for another read.
import { create } from 'zustand';
import { fetchUserProfile, forgetUserStats, peekUserStats, type UserProfile } from '@/src/core/firebase/services/profile';
import { fetchUserCourseInfo, type UserCourseInfo } from '@/src/core/firebase/services/courses';
import {
  fetchMyMainLeaderboardScore,
  type MainLeaderboardScore,
} from '@/src/core/services/mainLeaderboard';

let profileInFlightUid: string | null = null;
let profileInFlight: Promise<void> | null = null;

/**
 * Bumped by every score request AND by every direct `setScore`, so a slow read
 * can never land on top of a newer value. Without it, the read started at app
 * open could overwrite the freshly recomputed score a publish just handed us —
 * which is precisely the number the user is waiting to see.
 */
let scoreRequestToken = 0;

interface ProfileState {
  profile: UserProfile | null;
  courseInfo: UserCourseInfo | null;
  /** True only for the very first load, so screens can skip their spinner on refetches. */
  loading: boolean;
  refreshing: boolean;
  error: boolean;
  /** uid the current data belongs to — guards against showing a previous user's data. */
  loadedUid: string | null;

  /**
   * The whole-app aggregate behind the Profile stats card — one stored document
   * (mainLeaderboard/{uid}/{subcourseId}), never a recompute.
   *
   * It lives here rather than in the Profile screen so it is already in memory by
   * the time the tab is opened. Fetching it on mount meant the card showed a
   * skeleton on every single visit, even though the value rarely changes within
   * a session.
   */
  score: MainLeaderboardScore | null;
  /**
   * Starts true: until the first attempt settles we genuinely do not know the
   * numbers, and a skeleton is more honest than a card full of zeroes that
   * silently becomes real data a moment later.
   */
  scoreLoading: boolean;

  load: (uid: string, opts?: { force?: boolean; refresh?: boolean }) => Promise<void>;
  /** Reads the stored aggregate. Pass a null subcourse for a user who has not enrolled. */
  loadScore: (uid: string, subcourseId: string | null) => Promise<void>;
  /**
   * Hand the store a score that was just recomputed elsewhere (the daily
   * snapshot, or a Leaderboard/Analytics publish) instead of re-reading it —
   * fresher than the stored copy and one read cheaper.
   */
  setScore: (score: MainLeaderboardScore | null) => void;
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
  score: null,
  scoreLoading: true,

  load: async (uid, opts) => {
    const state = get();
    const alreadyLoaded = state.loadedUid === uid && state.profile !== null;
    if (alreadyLoaded && !opts?.force && !opts?.refresh) return;

    // Root layout and Splash can request the same warm-up at nearly the same
    // time. Share the in-flight request so the app does not issue duplicate
    // profile/course reads during launch.
    if (profileInFlightUid === uid && profileInFlight) {
      await profileInFlight;
      return;
    }

    const request = (async () => {
      set(
        opts?.refresh
          ? { refreshing: true, error: false }
          : { loading: !alreadyLoaded, error: false }
      );

      try {
        // One user-document read only: `fetchUserProfile` performs the backfill
        // itself (see profile.ts), so a separate `ensureUserStats` read here
        // would double the cost of every app open.
        const [profile, courseInfo] = await Promise.all([
          fetchUserProfile(uid),
          fetchUserCourseInfo(uid).catch(() => null),
        ]);
        set({ profile, courseInfo, loadedUid: uid, loading: false, refreshing: false, error: false });

        // Deliberately NOT awaited, and deliberately after the set above: the
        // Home header only needs the profile, and making it wait on a stats-card
        // read would slow down the screen the user actually sees first. Started
        // here rather than from an effect because this is the exact moment the
        // enrolled subcourse becomes known — one trigger, no flicker between
        // "not enrolled" and the real course.
        void get().loadScore(uid, courseInfo?.subcourseId ?? null);
      } catch {
        set({ loading: false, refreshing: false, error: true });
      }
    })();

    profileInFlightUid = uid;
    profileInFlight = request;
    try {
      await request;
    } finally {
      if (profileInFlight === request) {
        profileInFlight = null;
        profileInFlightUid = null;
      }
    }
  },

  loadScore: async (uid, subcourseId) => {
    const token = ++scoreRequestToken;
    if (!uid || !subcourseId) {
      // Nothing to score yet. Settling on the empty state beats leaving the card
      // on a skeleton that would never resolve.
      set({ score: null, scoreLoading: false });
      return;
    }
    set({ scoreLoading: true });
    const score = await fetchMyMainLeaderboardScore(uid, subcourseId).catch(() => null);
    // Someone signed out, switched course, or published a fresher score while
    // this read was in flight — in every case our answer is now the stale one.
    if (token !== scoreRequestToken) return;
    set({ score, scoreLoading: false });
  },

  setScore: (score) => {
    scoreRequestToken += 1;
    // Publishing a score also refreshes users/{uid}.stats — recordAnalyticsSnapshot
    // mirrors points, tests and the streak while it still has them in hand, and it
    // runs before this callback. The stats map on the loaded profile is the copy
    // the card renders, so pull the freshly written numbers across; otherwise the
    // ring would update on this publish and the streak beside it would not, until
    // the next cold start.
    const { profile, loadedUid } = get();
    const stats = loadedUid ? peekUserStats(loadedUid) : null;
    set({
      score,
      scoreLoading: false,
      ...(profile && stats ? { profile: { ...profile, stats } } : {}),
    });
  },

  applyLocalPatch: (patch) => {
    const current = get().profile;
    if (!current) return;
    set({ profile: { ...current, ...patch } });
  },

  clear: () => {
    scoreRequestToken += 1;
    // The stats baseline is keyed by uid, but it is a mirror of one account's
    // numbers and has no business outliving the session that read it.
    forgetUserStats();
    set({
      profile: null,
      courseInfo: null,
      loadedUid: null,
      loading: false,
      refreshing: false,
      error: false,
      score: null,
      // Back to "not known yet", not "known to be empty" — the next account's
      // card should open on a skeleton, not on somebody else's blank slate.
      scoreLoading: true,
    });
  },
}));
