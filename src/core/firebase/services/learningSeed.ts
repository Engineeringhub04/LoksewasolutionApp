import {
  DEFAULT_LEARNING_COURSE_ID,
  DEFAULT_LEARNING_SUBCOURSE_ID,
  seedCivilSubEngineerLearningCatalog,
} from '@/src/core/firebase/services/learning';
import {
  seedLearningContentSlots,
  type LearningContentScopeNames,
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

interface LearningScope extends LearningContentScopeNames {
  courseId: string;
  subcourseId: string;
}

async function discoverLearningScopes(): Promise<LearningScope[]> {
  const scopes: LearningScope[] = [
    {
      courseId: DEFAULT_LEARNING_COURSE_ID,
      subcourseId: DEFAULT_LEARNING_SUBCOURSE_ID,
      courseNameEn: 'Civil Engineering',
      courseNameNe: 'Civil Engineering',
      subcourseNameEn: 'Civil Assistance Sub Engineer',
      subcourseNameNe: 'Civil Assistance Sub Engineer',
    },
  ];

  try {
    const courses = await fetchCourses();
    for (const course of courses) {
      const subcourses = await fetchSubcourses(course.id);
      for (const subcourse of subcourses) {
        scopes.push({
          courseId: course.id,
          subcourseId: subcourse.id,
          courseNameEn: course.name,
          courseNameNe: course.name,
          subcourseNameEn: subcourse.name,
          subcourseNameNe: subcourse.name,
        });
      }
    }
  } catch {
    // Keep the default Civil Sub Engineer scope available if catalogue metadata is unavailable.
  }

  return Array.from(
    new Map(scopes.map((scope) => [`${scope.courseId}:${scope.subcourseId}`, scope])).values(),
  );
}

/**
 * Seeds the existing Subject/Unit/Chapter catalogue and the new learning
 * content sets. Re-running is safe because every content ID is deterministic
 * and every write is merge-safe.
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
 * Phase 5 entry point. Each scope writes 164 question-set documents (82
 * chapters x 2 modes) and 82 theory documents. No full collection reads or
 * legacy deletes are performed by this function.
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
