// §12 Onboarding Service — Seeds test data to app_onboarding-settings collection.
// The 4 slides are now hardcoded in onboarding.tsx (always shown from code).
// This service provides seedSingleTestSlide() for testing Firebase connectivity.
import { commitWrites, setWrite } from '@/src/core/firebase/firestoreRest';
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
 * Seeds a SINGLE test document to app_onboarding-settings collection.
 * Purpose: Verify that Firestore connection and security rules are working.
 * Only uploads 1 document so user can easily check Firebase Console.
 */
export async function seedSingleTestSlide(): Promise<void> {
  const testDoc = {
    order: 1,
    title: 'Weekly Mock Tests',
    description: 'Challenge yourself with timed mock tests every week.',
    imageLink: 'assets/images/ws-weeklytest.png',
    backgroundColor: '#3F51B5',
    isLocal: true,
    seededAt: new Date().toISOString(),
  };

  await commitWrites([
    setWrite(`${Collections.appOnboardingSettings}/test-seed-slide`, testDoc),
  ]);
}

/**
 * Seeds all 4 onboarding slides to Firestore (for full data setup).
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
