// Course & Subcourse service — subcourses are stored as SUB-COLLECTIONS under each course.
// Path: app_courses/{courseId}/subcourses/{subcourseId}
import { commitWrites, setWrite, runQuery, getDocument, setDocument, listDocuments } from '@/src/core/firebase/firestoreRest';

const COURSES_COLLECTION = 'app_courses';

export interface Course {
  id: string;
  name: string;
  order: number;
}

export interface Subcourse {
  id: string;
  name: string;
  level: string;
  order: number;
}

/**
 * Seeds all course and subcourse data to Firestore.
 * Courses go to: app_courses/{id}
 * Subcourses go to: app_courses/{courseId}/subcourses/{subcourseId}
 */
export async function seedCourseData(): Promise<void> {
  const writes = [
    // --- Courses ---
    setWrite(`${COURSES_COLLECTION}/civil-engineering`, { name: 'Civil Engineering', order: 1 }),
    setWrite(`${COURSES_COLLECTION}/geometric-engineering`, { name: 'Geometric Engineering', order: 2 }),
    setWrite(`${COURSES_COLLECTION}/electrical-engineering`, { name: 'Electrical Engineering', order: 3 }),

    // --- Civil Engineering subcourses ---
    setWrite(`${COURSES_COLLECTION}/civil-engineering/subcourses/civil-assistant-sub-engineer`, { name: 'Civil Assistance Sub Engineer', level: '4th level', order: 1 }),
    setWrite(`${COURSES_COLLECTION}/civil-engineering/subcourses/civil-sub-engineer`, { name: 'Civil Sub Engineer', level: '5th level', order: 2 }),
    setWrite(`${COURSES_COLLECTION}/civil-engineering/subcourses/civil-engineering-7th`, { name: 'Civil Engineering', level: '7th level', order: 3 }),

    // --- Geometric Engineering subcourses ---
    setWrite(`${COURSES_COLLECTION}/geometric-engineering/subcourses/amin`, { name: 'Amin', level: '4th level', order: 1 }),
    setWrite(`${COURSES_COLLECTION}/geometric-engineering/subcourses/surveyor`, { name: 'Surveyor', level: '5th level', order: 2 }),
    setWrite(`${COURSES_COLLECTION}/geometric-engineering/subcourses/geometric-engineering-7th`, { name: 'Geometric Engineering', level: '7th level', order: 3 }),

    // --- Electrical Engineering subcourses ---
    setWrite(`${COURSES_COLLECTION}/electrical-engineering/subcourses/electrical-assistant-engineer`, { name: 'Electrical Assistance Engineer', level: '4th level', order: 1 }),
    setWrite(`${COURSES_COLLECTION}/electrical-engineering/subcourses/sub-electrical-engineer`, { name: 'Sub Electrical Engineer', level: '5th level', order: 2 }),
    setWrite(`${COURSES_COLLECTION}/electrical-engineering/subcourses/electrical-engineering-7th`, { name: 'Electrical Engineering', level: '7th level', order: 3 }),
  ];

  await commitWrites(writes);
}

/**
 * Fetch all courses ordered by `order` field.
 */
export async function fetchCourses(): Promise<Course[]> {
  const docs = await runQuery(COURSES_COLLECTION, { orderBy: [{ field: 'order', direction: 'asc' }] });
  return docs as unknown as Course[];
}

/**
 * Fetch subcourses for a given courseId from sub-collection.
 * Path: app_courses/{courseId}/subcourses
 */
export async function fetchSubcourses(courseId: string): Promise<Subcourse[]> {
  const path = `${COURSES_COLLECTION}/${courseId}/subcourses`;
  const docs = await listDocuments(path);
  // Sort by order field
  return (docs as unknown as Subcourse[]).sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
}

/**
 * Save user's selected course setup to their user document.
 */
export async function saveUserCourseSetup(uid: string, courseId: string, subcourseId: string): Promise<void> {
  await setDocument(`users/${uid}`, { courseId, subcourseId, courseSetupComplete: true }, { merge: true });
}

/**
 * Check if user has completed course setup.
 */
export async function hasUserCourseSetup(uid: string): Promise<boolean> {
  const doc = await getDocument(`users/${uid}`);
  return doc?.courseSetupComplete === true;
}
