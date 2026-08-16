import {
  DEFAULT_LEARNING_COURSE_ID,
  DEFAULT_LEARNING_SUBCOURSE_ID,
  seedCivilSubEngineerLearningCatalog,
} from '@/src/core/firebase/services/learning';
import {
  seedLearningContentSlots,
  type LearningContentSeedResult,
} from '@/src/core/firebase/services/learningContent';
import { fetchCourses, fetchSubcourses } from '@/src/core/firebase/services/courses';

export interface LearningSeedResult {
  scopes: number;
  catalogRecords: number;
  contentRecords: number;
  totalRecords: number;
}

export interface Phase5SeedResult {
  scopes: number;
  questionRecords: number;
  theoryRecords: number;
  totalRecords: number;
}

export interface Phase5SeedProgress {
  scopeIndex: number;
  scopeTotal: number;
  questionRecords: number;
  theoryRecords: number;
  totalRecords: number;
}

interface LearningScope {
  courseId: string;
  subcourseId: string;
}

async function discoverLearningScopes(): Promise<LearningScope[]> {
  const scopes: LearningScope[] = [
    { courseId: DEFAULT_LEARNING_COURSE_ID, subcourseId: DEFAULT_LEARNING_SUBCOURSE_ID },
  ];

  try {
    const courses = await fetchCourses();
    for (const course of courses) {
      const subcourses = await fetchSubcourses(course.id);
      for (const subcourse of subcourses) {
        scopes.push({ courseId: course.id, subcourseId: subcourse.id });
      }
    }
  } catch {
    // Keep the default Civil Sub Engineer scope available if metadata is unavailable.
  }

  return Array.from(
    new Map(scopes.map((scope) => [`${scope.courseId}:${scope.subcourseId}`, scope])).values(),
  );
}

/**
 * Seeds the existing Subject page catalog and the Phase 5 content slots.
 * Re-running is safe because all IDs are deterministic and writes are merge-safe.
 */
export async function seedLearningPageData(): Promise<LearningSeedResult> {
  const scopes = await discoverLearningScopes();
  let catalogRecords = 0;
  let contentRecords = 0;

  for (const scope of scopes) {
    catalogRecords += await seedCivilSubEngineerLearningCatalog(scope);
    const contentResult = await seedLearningContentSlots(scope);
    contentRecords += contentResult.totalRecords;
  }

  return {
    scopes: scopes.length,
    catalogRecords,
    contentRecords,
    totalRecords: catalogRecords + contentRecords,
  };
}

/**
 * Phase 5 seed entry point. It writes only the new question and theory
 * collections, leaving the already-seeded Subject/Unit/Chapter catalog intact.
 */
export async function seedPhase5ContentData(
  onProgress?: (progress: Phase5SeedProgress) => void,
): Promise<Phase5SeedResult> {
  const scopes = await discoverLearningScopes();
  let questionRecords = 0;
  let theoryRecords = 0;

  for (let index = 0; index < scopes.length; index += 1) {
    const result: LearningContentSeedResult = await seedLearningContentSlots(scopes[index]);
    questionRecords += result.questionRecords;
    theoryRecords += result.theoryRecords;
    onProgress?.({
      scopeIndex: index + 1,
      scopeTotal: scopes.length,
      questionRecords,
      theoryRecords,
      totalRecords: questionRecords + theoryRecords,
    });
  }

  return {
    scopes: scopes.length,
    questionRecords,
    theoryRecords,
    totalRecords: questionRecords + theoryRecords,
  };
}
