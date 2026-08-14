import {
  DEFAULT_LEARNING_COURSE_ID,
  DEFAULT_LEARNING_SUBCOURSE_ID,
  seedCivilSubEngineerLearningCatalog,
} from '@/src/core/firebase/services/learning';
import { seedLearningContentSlots } from '@/src/core/firebase/services/learningContent';
import { fetchCourses, fetchSubcourses } from '@/src/core/firebase/services/courses';

export interface LearningSeedResult {
  scopes: number;
  catalogRecords: number;
  contentRecords: number;
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
 * Seeds only the Subject page's learning data. Re-running is safe because all
 * catalog and content-slot IDs are deterministic and writes are merge-safe.
 */
export async function seedLearningPageData(): Promise<LearningSeedResult> {
  const scopes = await discoverLearningScopes();
  let catalogRecords = 0;
  let contentRecords = 0;

  for (const scope of scopes) {
    catalogRecords += await seedCivilSubEngineerLearningCatalog(scope);
    contentRecords += await seedLearningContentSlots(scope);
  }

  return {
    scopes: scopes.length,
    catalogRecords,
    contentRecords,
    totalRecords: catalogRecords + contentRecords,
  };
}
