import {
  commitWrites,
  getDocument,
  serverTimestamp,
  setWrite,
  type WriteSpec,
} from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';
import {
  civilSubEngineerLearningCatalog,
  type LearningChapterSeed,
  type LearningSubjectSeed,
  type LearningUnitSeed,
} from '@/src/core/firebase/learningCatalog';
import {
  DEFAULT_LEARNING_COURSE_ID,
  DEFAULT_LEARNING_SUBCOURSE_ID,
  type LearningSeedOptions,
} from '@/src/core/firebase/services/learning';

export type LearningQuestionMode = 'practice' | 'read';
export type LearningDifficulty = 'easy' | 'medium' | 'hard';

export const PHASE5_THEORY_PDF_URL = 'https://drive.google.com/file/d/1_mxKpq-WN6z3D6uj8CAFuCti6weGu8h8/view?usp=drivesdk';

export interface LearningQuestion {
  id: string;
  sourceId: string;
  courseId: string;
  subcourseId: string;
  subjectId: string;
  unitId: string | null;
  chapterId: string;
  mode: LearningQuestionMode;
  order: number;
  text: string;
  textNe: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  explanationNe: string;
  difficulty: LearningDifficulty;
  isPublished: boolean;
  isPremium: boolean;
  price: number;
}

export interface LearningTheoryNote {
  id: string;
  resourceId: string;
  scopeId: string;
  courseId: string;
  courseNameEn: string;
  courseNameNe: string;
  subcourseId: string;
  subcourseNameEn: string;
  subcourseNameNe: string;
  subjectId: string;
  subjectNameEn: string;
  subjectNameNe: string;
  unitId: string | null;
  unitNameEn: string | null;
  unitNameNe: string | null;
  chapterId: string;
  chapterNameEn: string;
  chapterNameNe: string;
  unitChapterId: string | null;
  unitOrder: number | null;
  chapterOrder: number;
  title: string;
  titleNe: string;
  pdfUrl: string | null;
  pdfProvider: string | null;
  isConfigured: boolean;
  isPublished: boolean;
  isPremium: boolean;
  price: number;
}

export interface LearningContentSeedResult {
  questionRecords: number;
  theoryRecords: number;
  totalRecords: number;
}

export interface LearningContentScopeNames {
  courseNameEn?: string;
  courseNameNe?: string;
  subcourseNameEn?: string;
  subcourseNameNe?: string;
}

type Phase5QuestionTemplate = {
  questionEn: string;
  questionNe: string;
  options: { id: string; textEn: string }[];
  correctOptionId: string;
  explanationEn: string;
  explanationNe: string;
  difficulty: LearningDifficulty;
};

const CONTENT_WRITE_CHUNK_SIZE = 400;
const SAMPLE_DIFFICULTIES: LearningDifficulty[] = ['easy', 'medium', 'hard'];

// These are the three user-provided verification questions. They are reused for
// every catalog chapter and every discovered course/subcourse scope. No AI
// generation is used by this seed flow.
const phase5QuestionTemplates: Phase5QuestionTemplate[] = [
  {
    questionEn: 'Which of the following is known as the “Light of Asia”?',
    questionNe: 'तलका मध्ये “एसियाको ज्योति” भनेर कसलाई चिनिन्छ?',
    options: [
      { id: 'A', textEn: 'King Prithvi Narayan Shah' },
      { id: 'B', textEn: 'Gautam Buddha' },
      { id: 'C', textEn: 'Araniko' },
      { id: 'D', textEn: 'Bhanubhakta Acharya' },
    ],
    correctOptionId: 'B',
    explanationEn: 'Gautam Buddha is widely known as the “Light of Asia” because his teachings on peace, compassion, non-violence, and the path to enlightenment had a profound influence across Asia and beyond. He was born in Lumbini, Nepal, which is recognized as his birthplace.',
    explanationNe: 'गौतम बुद्धलाई “एसियाको ज्योति” भनेर चिनिन्छ, किनभने उहाँले शान्ति, करुणा, अहिंसा तथा ज्ञानप्राप्तिको मार्गसम्बन्धी दिनुभएको शिक्षाले एसिया लगायत विश्वका विभिन्न क्षेत्रमा गहिरो प्रभाव पारेको छ। उहाँको जन्मस्थल नेपालको लुम्बिनी हो, जसलाई बुद्धको जन्मस्थलका रूपमा विश्वभर मान्यता प्राप्त छ।',
    difficulty: 'easy',
  },
  {
    questionEn: 'Which of the following best describes the main purpose of a feasibility study before implementing a development project?',
    questionNe: 'कुनै विकास परियोजना कार्यान्वयन गर्नुअघि गरिने सम्भाव्यता अध्ययनको मुख्य उद्देश्य तलका मध्ये कुन हो?',
    options: [
      { id: 'A', textEn: 'To appoint the project staff immediately' },
      { id: 'B', textEn: 'To determine whether the project is technically, financially, and practically viable' },
      { id: 'C', textEn: 'To increase the estimated cost of the project' },
      { id: 'D', textEn: 'To prepare the final completion report' },
    ],
    correctOptionId: 'B',
    explanationEn: 'A feasibility study is conducted before major project implementation to assess whether the proposed project can realistically be carried out. It generally examines factors such as technical requirements, financial resources, economic benefits, available technology, risks, and practical constraints. Therefore, its main purpose is to determine the overall viability of the project before significant resources are committed.',
    explanationNe: 'सम्भाव्यता अध्ययन कुनै ठूलो परियोजना कार्यान्वयन गर्नुअघि उक्त परियोजना वास्तवमै सञ्चालन गर्न सम्भव छ कि छैन भन्ने मूल्याङ्कन गर्न गरिन्छ। यस क्रममा परियोजनाको प्राविधिक आवश्यकता, आर्थिक स्रोत, सम्भावित लाभ, उपलब्ध प्रविधि, जोखिम तथा व्यावहारिक कठिनाइहरू जस्ता पक्षहरूको अध्ययन गरिन्छ। त्यसैले परियोजनामा ठूलो स्रोत लगानी गर्नुअघि यसको समग्र सम्भाव्यता निर्धारण गर्नु नै सम्भाव्यता अध्ययनको मुख्य उद्देश्य हो।',
    difficulty: 'medium',
  },
  {
    questionEn: 'A local government plans to construct a public building. The project was originally estimated to cost NPR 50 million. During implementation, the cost of construction materials increased by 20%, while improved procurement management reduced other project costs by 10% of the original estimate. What is the revised estimated cost of the project?',
    questionNe: 'एक स्थानीय तहले सार्वजनिक भवन निर्माण गर्ने योजना बनाएको छ। उक्त परियोजनाको प्रारम्भिक अनुमानित लागत ५ करोड रुपैयाँ थियो। परियोजना कार्यान्वयनका क्रममा निर्माण सामग्रीको लागत २०% ले वृद्धि भयो भने प्रभावकारी खरिद व्यवस्थापनका कारण अन्य परियोजना लागतमा प्रारम्भिक अनुमानको १०% बराबर बचत भयो। यस्तो अवस्थामा परियोजनाको संशोधित अनुमानित लागत कति हुनेछ?',
    options: [
      { id: 'A', textEn: 'NPR 50 million' },
      { id: 'B', textEn: 'NPR 55 million' },
      { id: 'C', textEn: 'NPR 60 million' },
      { id: 'D', textEn: 'NPR 65 million' },
    ],
    correctOptionId: 'B',
    explanationEn: 'The original project estimate was NPR 50 million. A 20% increase in material costs adds NPR 10 million to the original estimate, while the improved procurement system saves NPR 5 million, which is 10% of the original estimate. Therefore, the net increase is NPR 5 million, making the revised estimated cost NPR 55 million. Hence, option B is correct.',
    explanationNe: 'परियोजनाको प्रारम्भिक अनुमानित लागत ५ करोड रुपैयाँ थियो। निर्माण सामग्रीको लागतमा २०% वृद्धि हुँदा प्रारम्भिक लागतमा १ करोड रुपैयाँ थपिन्छ भने प्रभावकारी खरिद व्यवस्थापनबाट प्रारम्भिक लागतको १०% अर्थात् ५० लाख रुपैयाँ बचत हुन्छ। त्यसैले कुल लागतमा भएको शुद्ध वृद्धि ५० लाख रुपैयाँ मात्र हुन्छ र संशोधित अनुमानित लागत ५ करोड ५० लाख रुपैयाँ पुग्छ। त्यसकारण सही उत्तर B) ५ करोड ५० लाख रुपैयाँ हो।',
    difficulty: 'hard',
  },
];

function appSubjectId(subjectId: string): string {
  return subjectId === 'job-based-knowledge' ? 'technical-subject' : subjectId;
}

function scopeId(courseId: string, subcourseId: string): string {
  return `${courseId}__${subcourseId}`;
}

function unitSegment(unitId: string | null): string {
  return unitId ?? 'no-unit';
}

export function learningQuestionSetId(
  courseId: string,
  subcourseId: string,
  subjectId: string,
  unitId: string | null,
  chapterId: string,
  mode: LearningQuestionMode,
): string {
  return `${scopeId(courseId, subcourseId)}__${appSubjectId(subjectId)}__${unitSegment(unitId)}__${chapterId}__${mode}`;
}

export function learningTheoryResourceId(
  courseId: string,
  subcourseId: string,
  subjectId: string,
  unitId: string | null,
  chapterId: string,
): string {
  return `${scopeId(courseId, subcourseId)}__${appSubjectId(subjectId)}__${unitSegment(unitId)}__${chapterId}__theory`;
}

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function readNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readOptions(value: unknown): { id: string; textEn: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((option, index) => {
    if (typeof option === 'string') return [{ id: String.fromCharCode(65 + index), textEn: option }];
    if (!option || typeof option !== 'object') return [];
    const record = option as Record<string, unknown>;
    return [{
      id: readString(record.id, String.fromCharCode(65 + index)),
      textEn: readString(record.textEn, readString(record.text)),
    }];
  });
}

function questionFromArrayItem(
  item: Record<string, unknown>,
  document: Record<string, unknown>,
  mode: LearningQuestionMode,
  index: number,
): LearningQuestion {
  const options = readOptions(item.options);
  const correctOptionId = readString(item.correctOptionId);
  const legacyCorrectIndex = readNumber(item.correctIndex, 0);
  const correctIndex = correctOptionId
    ? Math.max(0, options.findIndex((option) => option.id === correctOptionId))
    : legacyCorrectIndex;
  const questionId = readString(item.questionId, readString(item.id, `${readString(document.id)}__question-${index + 1}`));
  return {
    id: questionId,
    sourceId: questionId,
    courseId: readString(document.courseId, DEFAULT_LEARNING_COURSE_ID),
    subcourseId: readString(document.subcourseId, DEFAULT_LEARNING_SUBCOURSE_ID),
    subjectId: readString(document.subjectId),
    unitId: readNullableString(document.unitId),
    chapterId: readString(document.chapterId),
    mode,
    order: readNumber(item.order, index + 1),
    text: readString(item.questionEn, readString(item.text)),
    textNe: readString(item.questionNe, readString(item.textNe, readString(item.questionEn, readString(item.text)))),
    options: options.map((option) => option.textEn),
    correctIndex: correctIndex < 0 ? 0 : correctIndex,
    explanation: readString(item.explanationEn, readString(item.explanation)),
    explanationNe: readString(item.explanationNe, readString(item.explanationEn, readString(item.explanation))),
    difficulty: item.difficulty === 'hard' || item.difficulty === 'medium' ? item.difficulty : 'easy',
    isPublished: item.isActive !== false && document.isPublished !== false,
    isPremium: document.isPremium === true,
    price: readNumber(document.price),
  };
}

function questionsFromDocument(document: Record<string, unknown>, mode: LearningQuestionMode): LearningQuestion[] {
  if (!Array.isArray(document.questions)) return [];
  return document.questions
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item, index) => questionFromArrayItem(item, document, mode, index))
    .filter((question) => question.isPublished)
    .sort((a, b) => a.order - b.order);
}

function theoryFromDocument(document: Record<string, unknown>): LearningTheoryNote {
  const pdfUrl = readNullableString(document.pdfUrl);
  return {
    id: readString(document.id, readString(document.resourceId)),
    resourceId: readString(document.resourceId, readString(document.id)),
    scopeId: readString(document.scopeId),
    courseId: readString(document.courseId, DEFAULT_LEARNING_COURSE_ID),
    courseNameEn: readString(document.courseNameEn, readString(document.courseId)),
    courseNameNe: readString(document.courseNameNe, readString(document.courseNameEn, readString(document.courseId))),
    subcourseId: readString(document.subcourseId, DEFAULT_LEARNING_SUBCOURSE_ID),
    subcourseNameEn: readString(document.subcourseNameEn, readString(document.subcourseId)),
    subcourseNameNe: readString(document.subcourseNameNe, readString(document.subcourseNameEn, readString(document.subcourseId))),
    subjectId: readString(document.subjectId),
    subjectNameEn: readString(document.subjectNameEn, readString(document.subjectId)),
    subjectNameNe: readString(document.subjectNameNe, readString(document.subjectNameEn, readString(document.subjectId))),
    unitId: readNullableString(document.unitId),
    unitNameEn: readNullableString(document.unitNameEn),
    unitNameNe: readNullableString(document.unitNameNe),
    chapterId: readString(document.chapterId),
    chapterNameEn: readString(document.chapterNameEn),
    chapterNameNe: readString(document.chapterNameNe, readString(document.chapterNameEn)),
    unitChapterId: readNullableString(document.unitChapterId),
    unitOrder: readNullableNumber(document.unitOrder),
    chapterOrder: readNumber(document.chapterOrder),
    title: readString(document.titleEn, readString(document.title, readString(document.chapterNameEn))),
    titleNe: readString(document.titleNe, readString(document.chapterNameNe, readString(document.titleEn, readString(document.title)))),
    pdfUrl,
    pdfProvider: readNullableString(document.pdfProvider),
    isConfigured: Boolean(pdfUrl),
    isPublished: document.isPublished !== false,
    isPremium: document.isPremium === true,
    price: readNumber(document.price),
  };
}

const questionSetFetches = new Map<string, Promise<LearningQuestion[]>>();
const learningTheoryFetches = new Map<string, Promise<LearningTheoryNote | null>>();

export interface LearningQuestionSetParams {
  courseId: string;
  subcourseId: string;
  subjectId: string;
  unitId?: string | null;
  chapterId: string;
  mode: LearningQuestionMode;
}

export interface LearningTheoryParams {
  courseId: string;
  subcourseId: string;
  subjectId: string;
  unitId?: string | null;
  chapterId: string;
}

export function fetchLearningQuestionSet(params: LearningQuestionSetParams): Promise<LearningQuestion[]> {
  const normalizedSubjectId = appSubjectId(params.subjectId);
  const normalizedUnitId = params.unitId || null;
  const documentId = learningQuestionSetId(params.courseId, params.subcourseId, normalizedSubjectId, normalizedUnitId, params.chapterId, params.mode);
  const key = `${Collections.subjectCucqDataAllMode}/${documentId}`;
  const cached = questionSetFetches.get(key);
  if (cached) return cached;

  const request = getDocument(`${Collections.subjectCucqDataAllMode}/${documentId}`)
    .then((document) => {
      if (!document) {
        // Unseeded or deleted content must not be cached as empty, otherwise
        // pages stay blank in the same session after the seed finally runs.
        questionSetFetches.delete(key);
        return [];
      }
      return questionsFromDocument(document, params.mode);
    })
    .catch((error) => {
      questionSetFetches.delete(key);
      throw error;
    });
  questionSetFetches.set(key, request);
  return request;
}

export function fetchPracticeQuestionSet(params: Omit<LearningQuestionSetParams, 'mode'>): Promise<LearningQuestion[]> {
  return fetchLearningQuestionSet({ ...params, mode: 'practice' });
}

export function fetchReadQuestionSet(params: Omit<LearningQuestionSetParams, 'mode'>): Promise<LearningQuestion[]> {
  return fetchLearningQuestionSet({ ...params, mode: 'read' });
}

export async function fetchLearningQuestionsBySubject(params: {
  courseId: string;
  subcourseId: string;
  subjectId: string;
  mode?: LearningQuestionMode;
  max?: number;
}): Promise<LearningQuestion[]> {
  const normalizedSubjectId = appSubjectId(params.subjectId);
  const mode = params.mode ?? 'practice';
  const entries = chapterEntries().filter((entry) => appSubjectId(entry.subject.id) === normalizedSubjectId);
  const chapterQuestions = await Promise.all(entries.map((entry) => fetchLearningQuestionSet({
    courseId: params.courseId,
    subcourseId: params.subcourseId,
    subjectId: normalizedSubjectId,
    unitId: entry.unit?.id ?? null,
    chapterId: entry.chapter.id,
    mode,
  })));
  return chapterQuestions.flat().slice(0, params.max ?? 200);
}

// Kept as a small compatibility wrapper for any existing learning-mode caller.
export function fetchLearningQuestions(
  courseId: string,
  subcourseId: string,
  subjectId: string,
  chapterId: string,
  unitId: string | null = null,
  mode: LearningQuestionMode = 'practice',
): Promise<LearningQuestion[]> {
  return fetchLearningQuestionSet({ courseId, subcourseId, subjectId, chapterId, unitId, mode });
}

export function fetchTheoryResource(params: LearningTheoryParams): Promise<LearningTheoryNote | null> {
  const normalizedSubjectId = appSubjectId(params.subjectId);
  const normalizedUnitId = params.unitId || null;
  const documentId = learningTheoryResourceId(params.courseId, params.subcourseId, normalizedSubjectId, normalizedUnitId, params.chapterId);
  const key = `${Collections.subjectTheoryResources}/${documentId}`;
  const cached = learningTheoryFetches.get(key);
  if (cached) return cached;

  const request = getDocument(`${Collections.subjectTheoryResources}/${documentId}`)
    .then((document) => {
      if (!document) {
        // Unseeded or deleted resources must not be cached as null, otherwise
        // pages stay blank in the same session after the seed finally runs.
        learningTheoryFetches.delete(key);
        return null;
      }
      return theoryFromDocument(document);
    })
    .catch((error) => {
      learningTheoryFetches.delete(key);
      throw error;
    });
  learningTheoryFetches.set(key, request);
  return request;
}

export function fetchLearningTheory(
  courseId: string,
  subcourseId: string,
  subjectId: string,
  chapterId: string,
  unitId: string | null = null,
): Promise<LearningTheoryNote | null> {
  return fetchTheoryResource({ courseId, subcourseId, subjectId, chapterId, unitId });
}

interface ChapterEntry {
  subject: LearningSubjectSeed;
  unit: LearningUnitSeed | null;
  chapter: LearningChapterSeed;
}

function chapterEntries(): ChapterEntry[] {
  return civilSubEngineerLearningCatalog.flatMap((subject) => [
    ...(subject.chapters ?? []).map((chapter) => ({ subject, unit: null, chapter })),
    ...(subject.units ?? []).flatMap((unit) => unit.chapters.map((chapter) => ({ subject, unit, chapter }))),
  ]);
}

function normalizeOptions(options: LearningContentScopeNames): Required<LearningContentScopeNames> {
  return {
    courseNameEn: options.courseNameEn ?? 'Civil Engineering',
    courseNameNe: options.courseNameNe ?? options.courseNameEn ?? 'Civil Engineering',
    subcourseNameEn: options.subcourseNameEn ?? 'Civil Assistance Sub Engineer',
    subcourseNameNe: options.subcourseNameNe ?? options.subcourseNameEn ?? 'Civil Assistance Sub Engineer',
  };
}

function questionSetFields(
  options: Required<LearningSeedOptions> & LearningContentScopeNames,
  entry: ChapterEntry,
  mode: LearningQuestionMode,
): Record<string, unknown> {
  const subjectId = appSubjectId(entry.subject.id);
  const unitId = entry.unit?.id ?? null;
  const id = learningQuestionSetId(options.courseId, options.subcourseId, subjectId, unitId, entry.chapter.id, mode);
  const names = normalizeOptions(options);
  const timestamp = new Date().toISOString();
  const questions = phase5QuestionTemplates.map((template, index) => ({
    questionId: `${entry.chapter.id}__${template.difficulty}`,
    order: index + 1,
    difficulty: template.difficulty,
    questionEn: template.questionEn,
    questionNe: template.questionNe,
    options: template.options,
    correctOptionId: template.correctOptionId,
    explanationEn: template.explanationEn,
    explanationNe: template.explanationNe,
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
  return {
    contentSetId: id,
    scopeId: scopeId(options.courseId, options.subcourseId),
    courseId: options.courseId,
    courseNameEn: names.courseNameEn,
    courseNameNe: names.courseNameNe,
    subcourseId: options.subcourseId,
    subcourseNameEn: names.subcourseNameEn,
    subcourseNameNe: names.subcourseNameNe,
    subjectId,
    subjectNameEn: entry.subject.title,
    subjectNameNe: entry.subject.titleNe,
    unitId,
    unitNameEn: entry.unit?.title ?? null,
    unitNameNe: entry.unit?.titleNe ?? null,
    chapterId: entry.chapter.id,
    chapterNameEn: entry.chapter.title,
    chapterNameNe: entry.chapter.titleNe,
    unitChapterId: entry.unit ? entry.chapter.id : null,
    unitChapterNameEn: entry.unit ? entry.chapter.title : null,
    unitChapterNameNe: entry.unit ? entry.chapter.titleNe : null,
    unitOrder: entry.unit?.order ?? null,
    chapterOrder: entry.chapter.order,
    mode,
    questionCount: questions.length,
    questions,
    isPublished: true,
    isPremium: false,
    price: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function theoryFields(
  options: Required<LearningSeedOptions> & LearningContentScopeNames,
  entry: ChapterEntry,
): Record<string, unknown> {
  const subjectId = appSubjectId(entry.subject.id);
  const unitId = entry.unit?.id ?? null;
  const id = learningTheoryResourceId(options.courseId, options.subcourseId, subjectId, unitId, entry.chapter.id);
  const names = normalizeOptions(options);
  return {
    resourceId: id,
    scopeId: scopeId(options.courseId, options.subcourseId),
    courseId: options.courseId,
    courseNameEn: names.courseNameEn,
    courseNameNe: names.courseNameNe,
    subcourseId: options.subcourseId,
    subcourseNameEn: names.subcourseNameEn,
    subcourseNameNe: names.subcourseNameNe,
    subjectId,
    subjectNameEn: entry.subject.title,
    subjectNameNe: entry.subject.titleNe,
    unitId,
    unitNameEn: entry.unit?.title ?? null,
    unitNameNe: entry.unit?.titleNe ?? null,
    chapterId: entry.chapter.id,
    chapterNameEn: entry.chapter.title,
    chapterNameNe: entry.chapter.titleNe,
    unitChapterId: entry.unit ? entry.chapter.id : null,
    unitOrder: entry.unit?.order ?? null,
    chapterOrder: entry.chapter.order,
    resourceType: 'pdf',
    titleEn: `${entry.chapter.title} Theory`,
    titleNe: `${entry.chapter.titleNe} सिद्धान्त`,
    pdfUrl: PHASE5_THEORY_PDF_URL,
    pdfProvider: 'google-drive',
    isPublished: true,
    isPremium: false,
    price: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

export function buildQuestionSetWrites(options: LearningSeedOptions & LearningContentScopeNames = {}): WriteSpec[] {
  const normalizedOptions = {
    courseId: options.courseId ?? DEFAULT_LEARNING_COURSE_ID,
    subcourseId: options.subcourseId ?? DEFAULT_LEARNING_SUBCOURSE_ID,
    overwriteCatalogFields: options.overwriteCatalogFields ?? false,
    courseNameEn: options.courseNameEn,
    courseNameNe: options.courseNameNe,
    subcourseNameEn: options.subcourseNameEn,
    subcourseNameNe: options.subcourseNameNe,
  };
  return chapterEntries().flatMap((entry) => (['practice', 'read'] as LearningQuestionMode[]).map((mode) => {
    const subjectId = appSubjectId(entry.subject.id);
    const unitId = entry.unit?.id ?? null;
    const id = learningQuestionSetId(normalizedOptions.courseId, normalizedOptions.subcourseId, subjectId, unitId, entry.chapter.id, mode);
    return setWrite(`${Collections.subjectCucqDataAllMode}/${id}`, questionSetFields(normalizedOptions, entry, mode), { merge: true });
  }));
}

export function buildTheorySetWrites(options: LearningSeedOptions & LearningContentScopeNames = {}): WriteSpec[] {
  const normalizedOptions = {
    courseId: options.courseId ?? DEFAULT_LEARNING_COURSE_ID,
    subcourseId: options.subcourseId ?? DEFAULT_LEARNING_SUBCOURSE_ID,
    overwriteCatalogFields: options.overwriteCatalogFields ?? false,
    courseNameEn: options.courseNameEn,
    courseNameNe: options.courseNameNe,
    subcourseNameEn: options.subcourseNameEn,
    subcourseNameNe: options.subcourseNameNe,
  };
  return chapterEntries().map((entry) => {
    const subjectId = appSubjectId(entry.subject.id);
    const unitId = entry.unit?.id ?? null;
    const id = learningTheoryResourceId(normalizedOptions.courseId, normalizedOptions.subcourseId, subjectId, unitId, entry.chapter.id);
    return setWrite(`${Collections.subjectTheoryResources}/${id}`, theoryFields(normalizedOptions, entry), { merge: true });
  });
}

export function buildLearningContentSlotWrites(options: LearningSeedOptions & LearningContentScopeNames = {}): WriteSpec[] {
  return [...buildQuestionSetWrites(options), ...buildTheorySetWrites(options)];
}

export function buildLearningQuestionWrites(options: LearningSeedOptions & LearningContentScopeNames = {}): WriteSpec[] {
  return buildQuestionSetWrites(options);
}

export function getPhase5SeedCounts(): { questionRecords: number; theoryRecords: number; totalRecords: number } {
  const theoryRecords = chapterEntries().length;
  const questionRecords = theoryRecords * 2;
  return { questionRecords, theoryRecords, totalRecords: questionRecords + theoryRecords };
}

export async function seedLearningContentSlots(options: LearningSeedOptions & LearningContentScopeNames = {}): Promise<LearningContentSeedResult> {
  const questionWrites = buildQuestionSetWrites(options);
  const theoryWrites = buildTheorySetWrites(options);
  const writes = [...questionWrites, ...theoryWrites];
  for (let index = 0; index < writes.length; index += CONTENT_WRITE_CHUNK_SIZE) {
    await commitWrites(writes.slice(index, index + CONTENT_WRITE_CHUNK_SIZE));
  }
  return {
    questionRecords: questionWrites.length,
    theoryRecords: theoryWrites.length,
    totalRecords: writes.length,
  };
}

export function getLearningChapterCount(): number {
  return chapterEntries().length;
}

export function getLearningQuestionTemplateCount(): number {
  return SAMPLE_DIFFICULTIES.length;
}
