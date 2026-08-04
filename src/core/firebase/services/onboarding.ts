// §12 Onboarding Service — Fetches slides from Firestore + seeds test data.
// Slides in Firestore are shown dynamically; hardcoded fallback in onboarding.tsx.
import { runQuery, commitWrites, setWrite } from '@/src/core/firebase/firestoreRest';
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

/**
 * Fetches all onboarding slides from Firestore, ordered by `order` field.
 * Returns empty array if collection has no documents.
 */
export async function fetchOnboardingSlides(): Promise<OnboardingSlide[]> {
  const docs = await runQuery(Collections.appOnboardingSettings, {
    orderBy: [{ field: 'order', direction: 'asc' }],
  });
  return docs as unknown as OnboardingSlide[];
}

/**
 * Seeds a SINGLE test document to app_onboarding-settings collection.
 * Purpose: Verify that Firestore connection and security rules are working.
 */
export async function seedSingleTestSlide(): Promise<void> {
  const testDoc = {
    order: 1,
    title: 'Weekly Mock Tests',
    description: 'Challenge yourself with timed mock tests every week.',
    imageLink: 'assets/images/ws-weeklytest.png',
    backgroundColor: '#1A237E',
    isLocal: true,
    seededAt: new Date().toISOString(),
  };

  await commitWrites([
    setWrite(`${Collections.appOnboardingSettings}/test-seed-slide`, testDoc),
  ]);
}

/**
 * Seeds all 4 onboarding slides to Firestore.
 */
export async function seedAllOnboardingSlides(): Promise<void> {
  const slides = [
    {
      id: 'slide-weekly-test',
      data: {
        order: 1,
        title: 'Weekly Mock Tests',
        description: 'Challenge yourself with timed mock tests every week and track your improvement over time.',
        imageLink: 'assets/images/ws-weeklytest.png',
        backgroundColor: '#1A237E',
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
        backgroundColor: '#004D40',
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
        backgroundColor: '#BF360C',
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
        backgroundColor: '#4A148C',
        isLocal: false,
      },
    },
  ];

  const writes = slides.map((s) =>
    setWrite(`${Collections.appOnboardingSettings}/${s.id}`, s.data)
  );
  await commitWrites(writes);
}

/**
 * Returns the list of remote image URLs (for pre-caching on app start).
 */
export function getRemoteImageUrls(): string[] {
  return [
    'https://i.ibb.co/hN8gtSc/dailytest-wlc.png',
    'https://i.ibb.co/9HYXh3nr/discussion-wlc.png',
  ];
}
