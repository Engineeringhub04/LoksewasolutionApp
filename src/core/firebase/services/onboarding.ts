// Onboarding welcome slides (Firestore-driven). Each doc has an `order` field for
// sort position and `isLocal` to pick a bundled asset vs. a remote `imageLink`.
import { runQuery, commitWrites, setWrite } from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';

export interface OnboardingSlide {
  id: string;
  order: number;
  title: string;
  text: string;
  imageLink: string;
  backgroundColor: string;
  isLocal: boolean;
}

const SEED_SLIDES: { id: string; data: Omit<OnboardingSlide, 'id'> }[] = [
  {
    id: 'weekly-test',
    data: { order: 1, title: 'Weekly Test', text: 'Join our weekly grand tests.', imageLink: 'assets/images/ws-weeklytest.png', backgroundColor: '#4A148C', isLocal: true },
  },
  {
    id: 'leaderboard-analytics',
    data: { order: 2, title: 'Leaderboard & Analytics', text: 'Track your rank in Nepal.', imageLink: 'assets/images/ws-leaderboard_analytics.png', backgroundColor: '#1A237E', isLocal: true },
  },
  {
    id: 'daily-test',
    data: { order: 3, title: 'Daily Test', text: 'Practice daily.', imageLink: 'https://i.ibb.co/hN8gtSc/dailytest-wlc.png', backgroundColor: '#004D40', isLocal: false },
  },
  {
    id: 'discussion-group',
    data: { order: 4, title: 'Discussion Group', text: 'Connect with students.', imageLink: 'https://i.ibb.co/9HYXh3nr/discussion-wlc.png', backgroundColor: '#3E2723', isLocal: false },
  },
];

export async function fetchOnboardingSlides(): Promise<OnboardingSlide[]> {
  const docs = await runQuery(Collections.appOnboardingSettings, {
    orderBy: [{ field: 'order', direction: 'asc' }],
  });
  return docs as unknown as OnboardingSlide[];
}

export async function seedOnboardingSlides(): Promise<void> {
  await commitWrites(SEED_SLIDES.map((s) => setWrite(`${Collections.appOnboardingSettings}/${s.id}`, s.data)));
}
