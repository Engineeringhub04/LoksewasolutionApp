import { seedExamHub, type SeedProgress } from '@/src/core/firebase/seedExamHub';
import { seedDiscussionGuidelines } from '@/src/core/firebase/services/discussionGuidelines';
import { seedCivilSubEngineerLearningCatalog } from '@/src/core/firebase/services/learning';

export interface AppSeedProgress {
  phase: 'learning' | 'exam' | 'guidelines';
  written: number;
  total: number;
}

export interface AppSeedResult {
  learningRecords: number;
  examRecords: number;
  guidelineRecords: number;
  totalRecords: number;
}

/**
 * Seeds only the static, admin-owned baseline data required by the app.
 *
 * User-generated collections such as subscriptions, purchases, progress,
 * bookmarks, discussions, comments and reports are intentionally excluded.
 * Re-running this function is safe: each underlying seeder uses deterministic
 * document IDs and merge-safe writes where appropriate.
 */
export async function seedAppBaseline(
  onProgress?: (progress: AppSeedProgress) => void,
): Promise<AppSeedResult> {
  onProgress?.({ phase: 'learning', written: 0, total: 1 });
  const learningRecords = await seedCivilSubEngineerLearningCatalog();
  onProgress?.({ phase: 'learning', written: 1, total: 1 });

  const examProgress = await seedExamHub((progress: SeedProgress) => {
    onProgress?.({ phase: 'exam', written: progress.written, total: progress.total });
  });

  onProgress?.({ phase: 'guidelines', written: 0, total: 1 });
  await seedDiscussionGuidelines();
  onProgress?.({ phase: 'guidelines', written: 1, total: 1 });

  return {
    learningRecords,
    examRecords: examProgress.written,
    guidelineRecords: 1,
    totalRecords: learningRecords + examProgress.written + 1,
  };
}

export const seedAllAppData = seedAppBaseline;
