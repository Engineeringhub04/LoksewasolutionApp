// Course & Subcourse service — seeds course data to Firestore and provides query helpers.
import { commitWrites, setWrite, runQuery, getDocument, setDocument } from '@/src/core/firebase/firestoreRest';

const COURSES_COLLECTION = 'app_courses';
const SUBCOURSES_COLLECTION = 'app_subcourses';

export interface Course {
  id: string;
  name: string;
  order: number;
}

export interface Subcourse {
  id: string;
  courseId: string;
  name: string;
  level: string;
  order: number;
}

/**
 * Seeds all course and subcourse data to Firestore.
 * Courses: Civil Engineering, Geometric Engineering, Electrical Engineering
 * Subcourses: 3 subcourses per course with levels (4th, 5th, 7th)
 */
export async function seedCourseData(): Promise<void> {
  const courses = [
    { id: 'civil-engineering', data: { name: 'Civil Engineering', order: 1 } },
    { id: 'geometric-engineering', data: { name: 'Geometric Engineering', order: 2 } },
    { id: 'electrical-engineering', data: { name: 'Electrical Engineering', order: 3 } },
  ];

  const subcourses = [
    // Civil
    { id: 'civil-assistant-sub-engineer', data: { courseId: 'civil-engineering', name: 'Civil Assistance Sub Engineer', level: '4th level', order: 1 } },
    { id: 'civil-sub-engineer', data: { courseId: 'civil-engineering', name: 'Civil Sub Engineer', level: '5th level', order: 2 } },
    { id: 'civil-engineering-7th', data: { courseId: 'civil-engineering', name: 'Civil Engineering', level: '7th level', order: 3 } },
    // Geometric
    { id: 'amin', data: { courseId: 'geometric-engineering', name: 'Amin', level: '4th level', order: 1 } },
    { id: 'surveyor', data: { courseId: 'geometric-engineering', name: 'Surveyor', level: '5th level', order: 2 } },
    { id: 'geometric-engineering-7th', data: { courseId: 'geometric-engineering', name: 'Geometric Engineering', level: '7th level', order: 3 } },
    // Electrical
    { id: 'electrical-assistant-engineer', data: { courseId: 'electrical-engineering', name: 'Electrical Assistance Engineer', level: '4th level', order: 1 } },
    { id: 'sub-electrical-engineer', data: { courseId: 'electrical-engineering', name: 'Sub Electrical Engineer', level: '5th level', order: 2 } },
    { id: 'electrical-engineering-7th', data: { courseId: 'electrical-engineering', name: 'Electrical Engineering', level: '7th level', order: 3 } },
  ];

  const writes = [
    ...courses.map((c) => setWrite(`${COURSES_COLLECTION}/${c.id}`, c.data)),
    ...subcourses.map((s) => setWrite(`${SUBCOURSES_COLLECTION}/${s.id}`, s.data)),
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
 * Fetch subcourses for a given courseId, ordered by `order` field.
 */
export async function fetchSubcourses(courseId: string): Promise<Subcourse[]> {
  const docs = await runQuery(SUBCOURSES_COLLECTION, {
    where: [{ field: 'courseId', op: '==', value: courseId }],
    orderBy: [{ field: 'order', direction: 'asc' }],
  });
  return docs as unknown as Subcourse[];
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
