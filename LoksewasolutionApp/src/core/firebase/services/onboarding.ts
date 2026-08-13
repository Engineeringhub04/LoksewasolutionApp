// §12 Onboarding Service — Fetches slides from Firestore + seeds test data.
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

export async function fetchOnboardingSlides(): Promise<OnboardingSlide[]> {
  const docs = await runQuery(Collections.appOnboardingSettings, {
    orderBy: [{ field: 'order', direction: 'asc' }],
  });
  return docs as unknown as OnboardingSlide[];
}

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

export function getRemoteImageUrls(): string[] {
  return [
    'https://i.ibb.co/hN8gtSc/dailytest-wlc.png',
    'https://i.ibb.co/9HYXh3nr/discussion-wlc.png',
  ];
}
