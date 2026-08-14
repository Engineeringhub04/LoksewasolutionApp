import { Collections } from '@/src/core/firebase/collections';
import { commitWrites, getDocument, listDocuments, setWrite, type WriteSpec } from '@/src/core/firebase/firestoreRest';
import { civilSubEngineerLearningCatalog, type LearningChapterSeed } from '@/src/core/firebase/learningCatalog';
import {
  DEFAULT_LEARNING_COURSE_ID,
  DEFAULT_LEARNING_SUBCOURSE_ID,
  type LearningSeedOptions,
} from '@/src/core/firebase/services/learning';

export type LearningQuestionMode = 'practice' | 'read';
export type LearningDifficulty = 'easy' | 'medium' | 'hard';

export interface LearningQuestion {
  id: string;
  courseId: string;
  subcourseId: string;
  subjectId: string;
  unitId: string | null;
  chapterId: string;
  mode: LearningQuestionMode;
  text: string;
  textNe: string;
  options: string[];
  optionsNe: string[];
  correctIndex: number;
  explanation: string;
  explanationNe: string;
  difficulty: LearningDifficulty;
  isPublished: boolean;
}

export interface LearningTheoryNote {
  id: string;
  courseId: string;
  subcourseId: string;
  subjectId: string;
  unitId: string | null;
  chapterId: string;
  title: string;
  titleNe: string;
  notes: string | null;
  notesNe: string | null;
  pdfUrl: string | null;
  notesUrl: string | null;
  isConfigured: boolean;
}

export interface LearningQuestionBankMeta {
  id: string;
  courseId: string;
  subcourseId: string;
  subjectId: string;
  unitId: string | null;
  chapterId: string;
  practiceQuestionCount: number;
  readQuestionCount: number;
  isSeed: boolean;
}

export interface LearningScope {
  courseId: string;
  subcourseId: string;
}

function scopePrefix(courseId: string, subcourseId: string): string {
  return `${courseId}__${subcourseId}`;
}

export function learningContentId(courseId: string, subcourseId: string, subjectId: string, chapterId: string): string {
  return `${scopePrefix(courseId, subcourseId)}__${subjectId}__${chapterId}`;
}

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function readNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function readArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function questionFromDocument(document: Record<string, unknown>): LearningQuestion {
  const difficulty = document.difficulty === 'hard' || document.difficulty === 'medium' ? document.difficulty : 'easy';
  return {
    id: readString(document.id),
    courseId: readString(document.courseId, DEFAULT_LEARNING_COURSE_ID),
    subcourseId: readString(document.subcourseId, DEFAULT_LEARNING_SUBCOURSE_ID),
    subjectId: readString(document.subjectId),
    unitId: readNullableString(document.unitId),
    chapterId: readString(document.chapterId),
    mode: document.mode === 'read' ? 'read' : 'practice',
    text: readString(document.text),
    textNe: readString(document.textNe, readString(document.text)),
    options: readArray(document.options),
    optionsNe: readArray(document.optionsNe),
    correctIndex: typeof document.correctIndex === 'number' ? document.correctIndex : 0,
    explanation: readString(document.explanation),
    explanationNe: readString(document.explanationNe, readString(document.explanation)),
    difficulty,
    isPublished: document.isPublished !== false,
  };
}

function theoryFromDocument(document: Record<string, unknown>): LearningTheoryNote {
  return {
    id: readString(document.id),
    courseId: readString(document.courseId, DEFAULT_LEARNING_COURSE_ID),
    subcourseId: readString(document.subcourseId, DEFAULT_LEARNING_SUBCOURSE_ID),
    subjectId: readString(document.subjectId),
    unitId: readNullableString(document.unitId),
    chapterId: readString(document.chapterId),
    title: readString(document.title),
    titleNe: readString(document.titleNe, readString(document.title)),
    notes: readNullableString(document.notes),
    notesNe: readNullableString(document.notesNe),
    pdfUrl: readNullableString(document.pdfUrl),
    notesUrl: readNullableString(document.notesUrl),
    isConfigured: document.isConfigured === true,
  };
}

export async function fetchLearningQuestions(
  courseId: string,
  subcourseId: string,
  subjectId: string,
  chapterId: string,
): Promise<LearningQuestion[]> {
  const documents = await listDocuments(Collections.learningQuestions);
  return documents
    .filter((document) => document.courseId === courseId && document.subcourseId === subcourseId && document.subjectId === subjectId && document.chapterId === chapterId && document.isPublished !== false)
    .map(questionFromDocument)
    .sort((a, b) => a.id.localeCompare(b.id));
}

export async function fetchLearningTheory(
  courseId: string,
  subcourseId: string,
  subjectId: string,
  chapterId: string,
): Promise<LearningTheoryNote | null> {
  const document = await getDocument(`${Collections.learningTheory}/${learningContentId(courseId, subcourseId, subjectId, chapterId)}`);
  return document ? theoryFromDocument(document) : null;
}

function chapterEntries(): { subjectId: string; chapter: LearningChapterSeed; unitId: string | null }[] {
  return civilSubEngineerLearningCatalog.flatMap((subject) => [
    ...(subject.chapters ?? []).map((chapter) => ({ subjectId: subject.id, chapter, unitId: null })),
    ...(subject.units ?? []).flatMap((unit) => unit.chapters.map((chapter) => ({ subjectId: subject.id, chapter, unitId: unit.id }))),
  ]);
}

function buildContentSlotWrites(options: Required<LearningSeedOptions>): WriteSpec[] {
  return chapterEntries().flatMap(({ subjectId, chapter, unitId }) => {
    const id = learningContentId(options.courseId, options.subcourseId, subjectId, chapter.id);
    return [
      setWrite(`${Collections.learningTheory}/${id}`, {
        id,
        courseId: options.courseId,
        subcourseId: options.subcourseId,
        subjectId,
        unitId,
        chapterId: chapter.id,
        title: chapter.title,
        titleNe: chapter.titleNe,
        notes: null,
        notesNe: null,
        pdfUrl: null,
        notesUrl: null,
        isConfigured: false,
        isSeed: true,
      }, { merge: !options.overwriteCatalogFields }),
      setWrite(`${Collections.learningQuestionBanks}/${id}`, {
        id,
        courseId: options.courseId,
        subcourseId: options.subcourseId,
        subjectId,
        unitId,
        chapterId: chapter.id,
        practiceQuestionCount: 0,
        readQuestionCount: 0,
        isSeed: true,
      }, { merge: true }),
    ];
  });
}

export function buildLearningContentSlotWrites(options: LearningSeedOptions = {}): WriteSpec[] {
  return buildContentSlotWrites({
    courseId: options.courseId ?? DEFAULT_LEARNING_COURSE_ID,
    subcourseId: options.subcourseId ?? DEFAULT_LEARNING_SUBCOURSE_ID,
    overwriteCatalogFields: options.overwriteCatalogFields ?? false,
  });
}

export async function seedLearningContentSlots(options: LearningSeedOptions = {}): Promise<number> {
  const writes = buildLearningContentSlotWrites(options);
  await commitWrites(writes);
  return writes.length;
}
