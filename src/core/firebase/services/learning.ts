import { commitWrites, getDocument, listDocuments, setWrite, serverTimestamp, type WriteSpec } from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';
import {
  civilSubEngineerLearningCatalog,
  countLearningChapters,
  countLearningUnits,
  type LearningChapterSeed,
  type LearningSubjectSeed,
  type LearningUnitSeed,
} from '@/src/core/firebase/learningCatalog';

export type LearningHierarchy = 'direct-chapters' | 'unit-chapters';

export interface LearningSubject {
  id: string;
  order: number;
  title: string;
  titleNe: string;
  icon: string;
  hierarchy: LearningHierarchy;
  unitCount: number;
  chapterCount: number;
  questionCount: number;
  isPremium: boolean;
  price: number;
  courseId: string | null;
  subcourseId: string | null;
}

export interface LearningUnit {
  id: string;
  subjectId: string;
  order: number;
  title: string;
  titleNe: string;
  icon: string;
  chapterCount: number;
  questionCount: number;
  isPremium: boolean;
  price: number;
  courseId: string | null;
  subcourseId: string | null;
}

export interface LearningChapter {
  id: string;
  subjectId: string;
  unitId: string | null;
  order: number;
  title: string;
  titleNe: string;
  questionCount: number;
  isPremium: boolean;
  price: number;
  courseId: string | null;
  subcourseId: string | null;
}

export interface LearningSeedOptions {
  courseId?: string;
  subcourseId?: string;
  overwriteCatalogFields?: boolean;
}

export const DEFAULT_LEARNING_COURSE_ID = 'civil-engineering';
export const DEFAULT_LEARNING_SUBCOURSE_ID = 'civil-assistant-sub-engineer';

function catalogDocumentId(subjectId: string, courseId = DEFAULT_LEARNING_COURSE_ID, subcourseId = DEFAULT_LEARNING_SUBCOURSE_ID): string {
  return courseId === DEFAULT_LEARNING_COURSE_ID && subcourseId === DEFAULT_LEARNING_SUBCOURSE_ID
    ? subjectId
    : `${courseId}__${subcourseId}__${subjectId}`;
}

function scopedSubjectPath(subjectId: string, courseId?: string, subcourseId?: string): string {
  return `${Collections.learningSubjects}/${catalogDocumentId(subjectId, courseId, subcourseId)}`;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function booleanValue(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function subjectFromDocument(document: Record<string, unknown>): LearningSubject {
  return {
    id: String(document.subjectId ?? document.id ?? ''),
    order: numberValue(document.order),
    title: String(document.title ?? document.name ?? ''),
    titleNe: String(document.titleNe ?? document.title ?? document.name ?? ''),
    icon: String(document.icon ?? 'book-outline'),
    hierarchy: document.hierarchy === 'unit-chapters' ? 'unit-chapters' : 'direct-chapters',
    unitCount: numberValue(document.unitCount),
    chapterCount: numberValue(document.chapterCount ?? document.topicCount),
    questionCount: numberValue(document.questionCount),
    isPremium: booleanValue(document.isPremium),
    price: numberValue(document.price),
    courseId: stringValue(document.courseId),
    subcourseId: stringValue(document.subcourseId),
  };
}

function unitFromDocument(document: Record<string, unknown>, subjectId: string): LearningUnit {
  return {
    id: String(document.id ?? ''),
    subjectId,
    order: numberValue(document.order),
    title: String(document.title ?? document.name ?? ''),
    titleNe: String(document.titleNe ?? document.title ?? document.name ?? ''),
    icon: String(document.icon ?? 'book-outline'),
    chapterCount: numberValue(document.chapterCount ?? document.topicCount),
    questionCount: numberValue(document.questionCount),
    isPremium: booleanValue(document.isPremium),
    price: numberValue(document.price),
    courseId: stringValue(document.courseId),
    subcourseId: stringValue(document.subcourseId),
  };
}

function chapterFromDocument(document: Record<string, unknown>, subjectId: string, unitId: string | null): LearningChapter {
  return {
    id: String(document.id ?? ''),
    subjectId,
    unitId,
    order: numberValue(document.order),
    title: String(document.title ?? ''),
    titleNe: String(document.titleNe ?? document.title ?? ''),
    questionCount: numberValue(document.questionCount ?? document.topicCount),
    isPremium: booleanValue(document.isPremium),
    price: numberValue(document.price),
    courseId: stringValue(document.courseId),
    subcourseId: stringValue(document.subcourseId),
  };
}

export async function fetchLearningSubjects(
  courseId = DEFAULT_LEARNING_COURSE_ID,
  subcourseId = DEFAULT_LEARNING_SUBCOURSE_ID,
): Promise<LearningSubject[]> {
  const documents = await listDocuments(Collections.learningSubjects);
  return documents
    .filter((document) => (document.courseId ?? DEFAULT_LEARNING_COURSE_ID) === courseId && (document.subcourseId ?? DEFAULT_LEARNING_SUBCOURSE_ID) === subcourseId)
    .map(subjectFromDocument)
    .sort((a, b) => a.order - b.order);
}

export async function fetchLearningSubject(
  subjectId: string,
  courseId = DEFAULT_LEARNING_COURSE_ID,
  subcourseId = DEFAULT_LEARNING_SUBCOURSE_ID,
): Promise<LearningSubject | null> {
  const document = await getDocument(scopedSubjectPath(subjectId, courseId, subcourseId));
  return document ? subjectFromDocument(document) : null;
}

export async function fetchLearningUnit(
  subjectId: string,
  unitId: string,
  courseId = DEFAULT_LEARNING_COURSE_ID,
  subcourseId = DEFAULT_LEARNING_SUBCOURSE_ID,
): Promise<LearningUnit | null> {
  const scopedId = catalogDocumentId(subjectId, courseId, subcourseId);
  const document = await getDocument(`${Collections.learningUnits(scopedId)}/${unitId}`);
  return document ? unitFromDocument(document, subjectId) : null;
}

export async function fetchLearningChapter(
  subjectId: string,
  chapterId: string,
  unitId?: string | null,
  courseId = DEFAULT_LEARNING_COURSE_ID,
  subcourseId = DEFAULT_LEARNING_SUBCOURSE_ID,
): Promise<LearningChapter | null> {
  const scopedId = catalogDocumentId(subjectId, courseId, subcourseId);
  const document = await getDocument(
    unitId
      ? `${Collections.learningUnitChapters(scopedId, unitId)}/${chapterId}`
      : `${Collections.learningChapters(scopedId)}/${chapterId}`,
  );
  return document ? chapterFromDocument(document, subjectId, unitId ?? null) : null;
}

export async function fetchLearningUnits(
  subjectId: string,
  courseId = DEFAULT_LEARNING_COURSE_ID,
  subcourseId = DEFAULT_LEARNING_SUBCOURSE_ID,
): Promise<LearningUnit[]> {
  const scopedId = catalogDocumentId(subjectId, courseId, subcourseId);
  const flatDocuments = (await listDocuments(Collections.learningUnitRecords)).filter(
    (document) => document.subjectId === subjectId && (document.courseId ?? DEFAULT_LEARNING_COURSE_ID) === courseId && (document.subcourseId ?? DEFAULT_LEARNING_SUBCOURSE_ID) === subcourseId,
  );
  if (flatDocuments.length > 0) {
    return flatDocuments.map((document) => unitFromDocument(document, subjectId)).sort((a, b) => a.order - b.order);
  }
  const documents = await listDocuments(Collections.learningUnits(scopedId));
  return documents.map((document) => unitFromDocument(document, subjectId)).sort((a, b) => a.order - b.order);
}

export async function fetchLearningChapters(
  subjectId: string,
  unitId?: string | null,
  courseId = DEFAULT_LEARNING_COURSE_ID,
  subcourseId = DEFAULT_LEARNING_SUBCOURSE_ID,
): Promise<LearningChapter[]> {
  const scopedId = catalogDocumentId(subjectId, courseId, subcourseId);
  const flatCollection = unitId ? Collections.learningUnitChapterRecords : Collections.learningChapterRecords;
  const flatDocuments = (await listDocuments(flatCollection)).filter(
    (document) => document.subjectId === subjectId
      && (document.unitId ?? null) === (unitId ?? null)
      && (document.courseId ?? DEFAULT_LEARNING_COURSE_ID) === courseId
      && (document.subcourseId ?? DEFAULT_LEARNING_SUBCOURSE_ID) === subcourseId,
  );
  if (flatDocuments.length > 0) {
    return flatDocuments.map((document) => chapterFromDocument(document, subjectId, unitId ?? null)).sort((a, b) => a.order - b.order);
  }
  const documents = await listDocuments(unitId ? Collections.learningUnitChapters(scopedId, unitId) : Collections.learningChapters(scopedId));
  return documents.map((document) => chapterFromDocument(document, subjectId, unitId ?? null)).sort((a, b) => a.order - b.order);
}

function subjectWrite(subject: LearningSubjectSeed, options: Required<LearningSeedOptions>): WriteSpec {
  const chapterCount = countLearningChapters(subject);
  const scopedId = catalogDocumentId(subject.id, options.courseId, options.subcourseId);
  return setWrite(`${Collections.learningSubjects}/${scopedId}`, {
    subjectId: subject.id,
    name: subject.title,
    title: subject.title,
    titleNe: subject.titleNe,
    icon: subject.icon,
    order: subject.order,
    hierarchy: subject.hierarchy,
    courseId: options.courseId,
    subcourseId: options.subcourseId,
    unitCount: countLearningUnits(subject),
    chapterCount,
    questionCount: 0,
    isPremium: true,
    price: 50,
    isPublished: true,
    isSeed: true,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  }, { merge: !options.overwriteCatalogFields });
}

function unitWrite(subject: LearningSubjectSeed, currentUnit: LearningUnitSeed, options: Required<LearningSeedOptions>): WriteSpec[] {
  const scopedId = catalogDocumentId(subject.id, options.courseId, options.subcourseId);
  const fields = {
    id: currentUnit.id,
    subjectId: subject.id,
    title: currentUnit.title,
    titleNe: currentUnit.titleNe,
    icon: currentUnit.icon,
    order: currentUnit.order,
    courseId: options.courseId,
    subcourseId: options.subcourseId,
    chapterCount: currentUnit.chapters.length,
    questionCount: 0,
    isPremium: true,
    price: 50,
    isPublished: true,
    isSeed: true,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  };
  return [
    setWrite(`${Collections.learningUnits(scopedId)}/${currentUnit.id}`, fields, { merge: !options.overwriteCatalogFields }),
    setWrite(`${Collections.learningUnitRecords}/${scopedId}__${currentUnit.id}`, fields, { merge: !options.overwriteCatalogFields }),
  ];
}

function chapterWrite(
  subject: LearningSubjectSeed,
  currentChapter: LearningChapterSeed,
  options: Required<LearningSeedOptions>,
  unitId: string | null
): WriteSpec[] {
  const scopedId = catalogDocumentId(subject.id, options.courseId, options.subcourseId);
  const path = unitId
    ? `${Collections.learningUnitChapters(scopedId, unitId)}/${currentChapter.id}`
    : `${Collections.learningChapters(scopedId)}/${currentChapter.id}`;
  const fields = {
    id: currentChapter.id,
    subjectId: subject.id,
    unitId,
    title: currentChapter.title,
    titleNe: currentChapter.titleNe,
    order: currentChapter.order,
    courseId: options.courseId,
    subcourseId: options.subcourseId,
    questionCount: 0,
    isPremium: true,
    price: 50,
    isPublished: true,
    isSeed: true,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  };
  const flatPath = unitId
    ? `${Collections.learningUnitChapterRecords}/${scopedId}__${unitId}__${currentChapter.id}`
    : `${Collections.learningChapterRecords}/${scopedId}__${currentChapter.id}`;
  return [
    setWrite(path, fields, { merge: !options.overwriteCatalogFields }),
    setWrite(flatPath, fields, { merge: !options.overwriteCatalogFields }),
  ];
}

export function buildCivilSubEngineerCatalogWrites(options: LearningSeedOptions = {}): WriteSpec[] {
  const resolvedOptions: Required<LearningSeedOptions> = {
    courseId: options.courseId ?? DEFAULT_LEARNING_COURSE_ID,
    subcourseId: options.subcourseId ?? DEFAULT_LEARNING_SUBCOURSE_ID,
    overwriteCatalogFields: options.overwriteCatalogFields ?? false,
  };
  const writes: WriteSpec[] = [];

  for (const subject of civilSubEngineerLearningCatalog) {
    writes.push(subjectWrite(subject, resolvedOptions));
    for (const currentChapter of subject.chapters ?? []) {
      writes.push(...chapterWrite(subject, currentChapter, resolvedOptions, null));
    }
    for (const currentUnit of subject.units ?? []) {
      writes.push(...unitWrite(subject, currentUnit, resolvedOptions));
      for (const currentChapter of currentUnit.chapters) {
        writes.push(...chapterWrite(subject, currentChapter, resolvedOptions, currentUnit.id));
      }
    }
  }
  return writes;
}

export async function seedCivilSubEngineerLearningCatalog(options: LearningSeedOptions = {}): Promise<number> {
  const writes = buildCivilSubEngineerCatalogWrites(options);
  await commitWrites(writes);
  return writes.length;
}
