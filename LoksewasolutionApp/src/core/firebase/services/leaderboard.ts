import { runQuery } from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';

export interface LeaderboardEntry {
  id: string;
  name: string;
  photoURL?: string | null;
  score: number;
  scope: string;
}

export async function fetchLeaderboard(max = 50): Promise<LeaderboardEntry[]> {
  return (await runQuery(Collections.leaderboard, {
    orderBy: [{ field: 'score', direction: 'desc' }],
    limit: max,
  })) as unknown as LeaderboardEntry[];
}
