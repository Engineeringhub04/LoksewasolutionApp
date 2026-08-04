// Achievements (PRD §41, §47.4): global catalog + per-user unlock status.
import { listDocuments, getDocument } from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export interface AchievementStatus extends Achievement {
  unlocked: boolean;
  unlockedAt: string | null;
}

export async function fetchAchievements(uid: string): Promise<AchievementStatus[]> {
  const [catalog, userDoc] = await Promise.all([
    listDocuments(Collections.achievements),
    getDocument(`${Collections.users}/${uid}`),
  ]);

  const unlockedMap: Record<string, string> = (userDoc?.unlockedAchievements as Record<string, string>) ?? {};

  return (catalog as unknown as Achievement[]).map((achievement) => ({
    ...achievement,
    unlocked: !!unlockedMap[achievement.id],
    unlockedAt: unlockedMap[achievement.id] ?? null,
  }));
}
