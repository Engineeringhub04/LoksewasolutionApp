// §12 Onboarding Service — Fetches, checks, and seeds the app_onboarding-settings collection.
// Supports hybrid image logic: local bundled assets + remote URLs with caching.
import { runQuery, commitWrites, setWrite, listDocuments } from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';

export interface OnboardingSlide {
  id: string;
  order: number;
  title: string;
  description: string;
  imageLink: string;
  backgroundColor: string;
  isLocal: boolean;
}

// --- Seed data matching user requirements exactly ---
const SEED_SLIDES: { id: string; data: Omit<OnboardingSlide, 'id'> }[] = [
  {
    id: 'slide-weekly-test',
    data: {
      order: 1,
      title: 'Weekly Mock Tests',
      description: 'Challenge yourself with timed mock tests every week and track your improvement over time.',
      imageLink: 'assets/images/ws-weeklytest.png',
      backgroundColor: '#3F51B5',
      isLocal: true,
    },
  },
  {
    id: 'slide-leaderboard-analytics',
    data: {
      order: 2,
      title: 'Leaderboard & Analytics',
      description: 'Track your progress, compete with thousands of students across Nepal, and rise to the top.',
      imageLink: 'assets/images/ws-leaderboard_analytics.png',
      backgroundColor: '#009688',
      isLocal: true,
    },
  },
  {
    id: 'slide-daily-practice',
    data: {
      order: 3,
      title: 'Daily Practice',
      description: 'Strengthen your preparation with fresh daily questions covering all Loksewa subjects.',
      imageLink: 'https://i.ibb.co/hN8gtSc/dailytest-wlc.png',
      backgroundColor: '#FF5722',
      isLocal: false,
    },
  },
  {
    id: 'slide-discussion-forum',
    data: {
      order: 4,
      title: 'Discussion Forum',
      description: 'Connect with fellow aspirants, discuss tricky questions, and learn together as a community.',
      imageLink: 'https://i.ibb.co/9HYXh3nr/discussion-wlc.png',
      backgroundColor: '#673AB7',
      isLocal: false,
    },
  },
];

/**
 * Fetches all onboarding slides from Firestore, ordered by `order` field.
 */
export async function fetchOnboardingSlides(): Promise<OnboardingSlide[]> {
  const docs = await runQuery(Collections.appOnboardingSettings, {
    orderBy: [{ field: 'order', direction: 'asc' }],
  });
  return docs as unknown as OnboardingSlide[];
}

/**
 * Checks if the app_onboarding-settings collection is empty (no documents).
 * Returns true if empty → means we should show the SEED button.
 */
export async function isOnboardingCollectionEmpty(): Promise<boolean> {
  const docs = await runQuery(Collections.appOnboardingSettings, { limit: 1 });
  return docs.length === 0;
}

/**
 * Seeds the 4 default onboarding slides into Firestore.
 * Uses batch commit for atomic write.
 */
export async function seedOnboardingSlides(): Promise<void> {
  const writes = SEED_SLIDES.map((slide) =>
    setWrite(`${Collections.appOnboardingSettings}/${slide.id}`, slide.data)
  );
  await commitWrites(writes);
}

/**
 * Returns the list of remote image URLs from seed data (for pre-caching on app start).
 */
export function getRemoteImageUrls(): string[] {
  return SEED_SLIDES.filter((s) => !s.data.isLocal).map((s) => s.data.imageLink);
}
