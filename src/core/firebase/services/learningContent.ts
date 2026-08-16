import {
  commitWrites,
  getDocument,
  listDocuments,
  runQuery,
  serverTimestamp,
  setWrite,
  type WriteSpec,
} from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';
import { civilSubEngineerLearningCatalog, type LearningChapterSeed } from '@/src/core/firebase/learningCatalog';
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
  text: string;
  textNe: string;
  options: string[];
  optionsNe: string[];
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
  isPublished: boolean;
  isPremium: boolean;
  price: number;
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

export interface LearningContentSeedResult {
  questionRecords: number;
  theoryRecords: number;
  totalRecords: number;
}

type Phase5QuestionTemplate = Omit<LearningQuestion, 'id' | 'sourceId' | 'courseId' | 'subcourseId' | 'subjectId' | 'unitId' | 'chapterId' | 'mode' | 'isPremium' | 'price'>;

const QUESTION_WRITE_CHUNK_SIZE = 400;
const SAMPLE_DIFFICULTIES: LearningDifficulty[] = ['easy', 'medium', 'hard'];

// User-provided Phase 5 testing questions. These same three verified records
// are intentionally reused for every catalog chapter and every learning scope;
// no AI-generated questions are used by the seed flow.
const phase5QuestionTemplates: Phase5QuestionTemplate[] = [
  {
    text: 'Which of the following is known as the “Light of Asia”?',
    textNe: 'तलका मध्ये “एसियाको ज्योति” भनेर कसलाई चिनिन्छ?',
    options: [
      'A) King Prithvi Narayan Shah',
      'B) Gautam Buddha',
      'C) Araniko',
      'D) Bhanubhakta Acharya',
    ],
    optionsNe: [
      'राजा पृथ्वीनारायण शाह',
      'गौतम बुद्ध',
      'अरनिको',
      'भानुभक्त आचार्य',
    ],
    correctIndex: 1,
    explanation: 'Gautam Buddha is widely known as the “Light of Asia” because his teachings on peace, compassion, non-violence, and the path to enlightenment had a profound influence across Asia and beyond. He was born in Lumbini, Nepal, which is recognized as his birthplace.',
    explanationNe: 'गौतम बुद्धलाई “एसियाको ज्योति” भनेर चिनिन्छ, किनभने उहाँले शान्ति, करुणा, अहिंसा तथा ज्ञानप्राप्तिको मार्गसम्बन्धी दिनुभएको शिक्षाले एसिया लगायत विश्वका विभिन्न क्षेत्रमा गहिरो प्रभाव पारेको छ। उहाँको जन्मस्थल नेपालको लुम्बिनी हो, जसलाई बुद्धको जन्मस्थलका रूपमा विश्वभर मान्यता प्राप्त छ।',
    difficulty: 'easy',
    isPublished: true,
  },
  {
    text: 'Which of the following best describes the main purpose of a feasibility study before implementing a development project?',
    textNe: 'कुनै विकास परियोजना कार्यान्वयन गर्नुअघि गरिने सम्भाव्यता अध्ययनको मुख्य उद्देश्य तलका मध्ये कुन हो?',
    options: [
      'A) To appoint the project staff immediately',
      'B) To determine whether the project is technically, financially, and practically viable',
      'C) To increase the estimated cost of the project',
      'D) To prepare the final completion report',
    ],
    optionsNe: [
      'परियोजनाका कर्मचारी तुरुन्त नियुक्त गर्नु',
      'परियोजना प्राविधिक, आर्थिक तथा व्यावहारिक रूपमा सम्भव छ कि छैन भन्ने निर्धारण गर्नु',
      'परियोजनाको अनुमानित लागत बढाउनु',
      'अन्तिम सम्पन्न प्रतिवेदन तयार गर्नु',
    ],
    correctIndex: 1,
    explanation: 'A feasibility study is conducted before major project implementation to assess whether the proposed project can realistically be carried out. It generally examines factors such as technical requirements, financial resources, economic benefits, available technology, risks, and practical constraints. Therefore, its main purpose is to determine the overall viability of the project before significant resources are committed.',
    explanationNe: 'सम्भाव्यता अध्ययन कुनै ठूलो परियोजना कार्यान्वयन गर्नुअघि उक्त परियोजना वास्तवमै सञ्चालन गर्न सम्भव छ कि छैन भन्ने मूल्याङ्कन गर्न गरिन्छ। यस क्रममा परियोजनाको प्राविधिक आवश्यकता, आर्थिक स्रोत, सम्भावित लाभ, उपलब्ध प्रविधि, जोखिम तथा व्यावहारिक कठिनाइहरू जस्ता पक्षहरूको अध्ययन गरिन्छ। त्यसैले परियोजनामा ठूलो स्रोत लगानी गर्नुअघि यसको समग्र सम्भाव्यता निर्धारण गर्नु नै सम्भाव्यता अध्ययनको मुख्य उद्देश्य हो।',
    difficulty: 'medium',
    isPublished: true,
  },
  {
    text: 'A local government plans to construct a public building. The project was originally estimated to cost NPR 50 million. During implementation, the cost of construction materials increased by 20%, while improved procurement management reduced other project costs by 10% of the original estimate. What is the revised estimated cost of the project?',
    textNe: 'एक स्थानीय तहले सार्वजनिक भवन निर्माण गर्ने योजना बनाएको छ। उक्त परियोजनाको प्रारम्भिक अनुमानित लागत ५ करोड रुपैयाँ थियो। परियोजना कार्यान्वयनका क्रममा निर्माण सामग्रीको लागत २०% ले वृद्धि भयो भने प्रभावकारी खरिद व्यवस्थापनका कारण अन्य परियोजना लागतमा प्रारम्भिक अनुमानको १०% बराबर बचत भयो। यस्तो अवस्थामा परियोजनाको संशोधित अनुमानित लागत कति हुनेछ?',
    options: [
      'A) NPR 50 million / ५ करोड रुपैयाँ',
      'B) NPR 55 million / ५ करोड ५० लाख रुपैयाँ',
      'C) NPR 60 million / ६ करोड रुपैयाँ',
      'D) NPR 65 million / ६ करोड ५० लाख रुपैयाँ',
    ],
    optionsNe: [
      '५ करोड रुपैयाँ',
      '५ करोड ५० लाख रुपैयाँ',
      '६ करोड रुपैयाँ',
      '६ करोड ५० लाख रुपैयाँ',
    ],
    correctIndex: 1,
    explanation: 'The original project estimate was NPR 50 million. A 20% increase in material costs adds NPR 10 million to the original estimate, while the improved procurement system saves NPR 5 million, which is 10% of the original estimate. Therefore, the net increase is NPR 5 million, making the revised estimated cost NPR 55 million. Hence, option B is correct.',
    explanationNe: 'परियोजनाको प्रारम्भिक अनुमानित लागत ५ करोड रुपैयाँ थियो। निर्माण सामग्रीको लागतमा २०% वृद्धि हुँदा प्रारम्भिक लागतमा १ करोड रुपैयाँ थपिन्छ भने प्रभावकारी खरिद व्यवस्थापनबाट प्रारम्भिक लागतको १०% अर्थात् ५० लाख रुपैयाँ बचत हुन्छ। त्यसैले कुल लागतमा भएको शुद्ध वृद्धि ५० लाख रुपैयाँ मात्र हुन्छ र संशोधित अनुमानित लागत ५ करोड ५० लाख रुपैयाँ पुग्छ। त्यसकारण सही उत्तर B) ५ करोड ५० लाख रुपैयाँ हो।',
    difficulty: 'hard',
    isPublished: true,
  },
];

// The canonical syllabus uses job-based-knowledge, while the Phase 1 subject
// catalog and Phase 4 routes expose the user-facing technical-subject ID.
function appSubjectId(subjectId: string): string {
  return subjectId === 'job-based-knowledge' ? 'technical-subject' : subjectId;
}

function normalizeLearningId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function sameLearningId(left: string, right: string): boolean {
  return normalizeLearningId(left) === normalizeLearningId(right);
}

function scopeMatches(document: Record<string, unknown>, courseId: string, subcourseId: string): boolean {
  const documentCourse = readString(document.courseId);
  const documentSubcourse = readString(document.subcourseId);
  return (sameLearningId(documentCourse, courseId)
    && sameLearningId(documentSubcourse, subcourseId));
}

function questionMatchesChapter(
  document: Record<string, unknown>,
  courseId: string,
  subcourseId: string,
  subjectId: string,
  chapterId: string,
): boolean {
  return scopeMatches(document, courseId, subcourseId)
    && sameLearningId(readString(document.subjectId), appSubjectId(subjectId))
    && sameLearningId(readString(document.chapterId), chapterId)
    && document.isPublished !== false;
}

function scopeOrChapterMatches(
  document: Record<string, unknown>,
  courseId: string,
  subcourseId: string,
  subjectId: string,
  chapterId: string,
): boolean {
  const exactScope = questionMatchesChapter(document, courseId, subcourseId, subjectId, chapterId);
  if (exactScope) return true;
  return sameLearningId(readString(document.subjectId), appSubjectId(subjectId))
    && sameLearningId(readString(document.chapterId), chapterId)
    && document.isPublished !== false;
}

function scopePrefix(courseId: string, subcourseId: string): string {
  return `${courseId}__${subcourseId}`;
}

export function learningContentId(courseId: string, subcourseId: string, subjectId: string, chapterId: string): string {
  return `${scopePrefix(courseId, subcourseId)}__${subjectId}__${chapterId}`;
}

function learningQuestionId(courseId: string, subcourseId: string, sourceId: string): string {
  return `${scopePrefix(courseId, subcourseId)}__${sourceId}`;
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

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function questionFromDocument(document: Record<string, unknown>): LearningQuestion {
  const difficulty = document.difficulty === 'hard' || document.difficulty === 'medium' ? document.difficulty : 'easy';
  return {
    id: readString(document.id),
    sourceId: readString(document.sourceId, readString(document.id)),
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
    correctIndex: readNumber(document.correctIndex),
    explanation: readString(document.explanation),
    explanationNe: readString(document.explanationNe, readString(document.explanation)),
    difficulty,
    isPublished: document.isPublished !== false,
    isPremium: document.isPremium === true,
    price: readNumber(document.price),
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
    isPublished: document.isPublished !== false,
    isPremium: document.isPremium === true,
    price: readNumber(document.price),
  };
}

export async function fetchLearningQuestions(
  courseId: string,
  subcourseId: string,
  subjectId: string,
  chapterId: string,
): Promise<LearningQuestion[]> {
  let documents: Record<string, unknown>[] = [];
  try {
    documents = await runQuery(Collections.subjectCucqDataAllMode, {
      where: [
        { field: 'courseId', op: '==', value: courseId },
        { field: 'subcourseId', op: '==', value: subcourseId },
        { field: 'subjectId', op: '==', value: appSubjectId(subjectId) },
        { field: 'chapterId', op: '==', value: chapterId },
        { field: 'isPublished', op: '==', value: true },
      ],
      limit: 200,
    });
  } catch {
    // The fallback scan below also supports older rules/index deployments.
  }

  if (documents.length === 0) {
    const allDocuments = await listDocuments(Collections.subjectCucqDataAllMode);
    const scopedDocuments = allDocuments.filter((document) => (
      questionMatchesChapter(document, courseId, subcourseId, subjectId, chapterId)
    ));
    documents = scopedDocuments.length > 0
      ? scopedDocuments
      : allDocuments.filter((document) => scopeOrChapterMatches(document, courseId, subcourseId, subjectId, chapterId));
  }

  return documents.map(questionFromDocument).sort((a, b) => {
    if (a.mode !== b.mode) return a.mode.localeCompare(b.mode);
    if (a.difficulty !== b.difficulty) return a.difficulty.localeCompare(b.difficulty);
    return a.id.localeCompare(b.id);
  });
}

export async function fetchLearningTheory(
  courseId: string,
  subcourseId: string,
  subjectId: string,
  chapterId: string,
): Promise<LearningTheoryNote | null> {
  let document: Record<string, unknown> | null = null;
  try {
    document = await getDocument(`${Collections.subjectTheoryResources}/${learningContentId(courseId, subcourseId, subjectId, chapterId)}`);
  } catch {
    // Continue with the normalized fallback scan below.
  }
  if (document) return theoryFromDocument(document);

  try {
    const allDocuments = await listDocuments(Collections.subjectTheoryResources);
    const matched = allDocuments.find((candidate) => {
      if (candidate.isPublished === false) return false;
      const sameChapter = sameLearningId(readString(candidate.chapterId), chapterId);
      const sameSubject = sameLearningId(readString(candidate.subjectId), appSubjectId(subjectId));
      if (!sameChapter || !sameSubject) return false;
      return scopeMatches(candidate, courseId, subcourseId)
        || (!readString(candidate.courseId) && !readString(candidate.subcourseId));
    });
    return matched ? theoryFromDocument(matched) : null;
  } catch {
    return null;
  }
}

function chapterEntries(): { subjectId: string; chapter: LearningChapterSeed; unitId: string | null }[] {
  return civilSubEngineerLearningCatalog.flatMap((subject) => [
    ...(subject.chapters ?? []).map((chapter) => ({ subjectId: subject.id, chapter, unitId: null })),
    ...(subject.units ?? []).flatMap((unit) => unit.chapters.map((chapter) => ({ subjectId: subject.id, chapter, unitId: unit.id }))),
  ]);
}

function sampleQuestionRecords(): LearningQuestion[] {
  const selected: LearningQuestion[] = [];
  for (const { subjectId, chapter, unitId } of chapterEntries()) {
    for (const template of phase5QuestionTemplates) {
      const baseSourceId = `${subjectId}__${chapter.id}__phase5-${template.difficulty}`;
      const baseRecord = {
        ...template,
        subjectId,
        unitId,
        chapterId: chapter.id,
      };
      selected.push({
        ...baseRecord,
        id: baseSourceId,
        sourceId: baseSourceId,
        courseId: '',
        subcourseId: '',
        mode: 'practice',
        isPremium: false,
        price: 0,
      });
      selected.push({
        ...baseRecord,
        id: `${baseSourceId}__read`,
        sourceId: `${baseSourceId}__read`,
        courseId: '',
        subcourseId: '',
        mode: 'read',
        isPremium: false,
        price: 0,
      });
    }
  }
  return selected;
}

const phase5SampleQuestions = sampleQuestionRecords();

function buildTheoryWrites(options: Required<LearningSeedOptions>): WriteSpec[] {
  return chapterEntries().map(({ subjectId, chapter, unitId }) => {
    const resolvedSubjectId = appSubjectId(subjectId);
    const id = learningContentId(options.courseId, options.subcourseId, resolvedSubjectId, chapter.id);
    return setWrite(`${Collections.subjectTheoryResources}/${id}`, {
      id,
      courseId: options.courseId,
      subcourseId: options.subcourseId,
      subjectId: resolvedSubjectId,
      unitId,
      chapterId: chapter.id,
      title: `${chapter.title} Theory`,
      titleNe: `${chapter.titleNe} सिद्धान्त`,
      resourceType: 'pdf',
      notes: null,
      notesNe: null,
      pdfUrl: PHASE5_THEORY_PDF_URL,
      notesUrl: null,
      isConfigured: true,
      isPublished: true,
      isPremium: false,
      price: 0,
      isSeed: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  });
}

function buildQuestionWrites(options: Required<LearningSeedOptions>): WriteSpec[] {
  return phase5SampleQuestions.map((question) => {
    const id = learningQuestionId(options.courseId, options.subcourseId, question.sourceId);
    return setWrite(`${Collections.subjectCucqDataAllMode}/${id}`, {
      id,
      sourceId: question.sourceId,
      courseId: options.courseId,
      subcourseId: options.subcourseId,
      subjectId: appSubjectId(question.subjectId),
      unitId: question.unitId,
      chapterId: question.chapterId,
      mode: question.mode,
      order: SAMPLE_DIFFICULTIES.indexOf(question.difficulty) + 1,
      difficulty: question.difficulty,
      text: question.text,
      textNe: question.textNe,
      options: question.options,
      optionsNe: question.optionsNe,
      correctIndex: question.correctIndex,
      explanation: question.explanation,
      explanationNe: question.explanationNe,
      isPublished: question.isPublished,
      isPremium: false,
      price: 0,
      isSeed: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  });
}

export function buildLearningContentSlotWrites(options: LearningSeedOptions = {}): WriteSpec[] {
  const normalizedOptions = {
    courseId: options.courseId ?? DEFAULT_LEARNING_COURSE_ID,
    subcourseId: options.subcourseId ?? DEFAULT_LEARNING_SUBCOURSE_ID,
    overwriteCatalogFields: options.overwriteCatalogFields ?? false,
  };
  return [...buildTheoryWrites(normalizedOptions), ...buildQuestionWrites(normalizedOptions)];
}

export function buildLearningQuestionWrites(options: LearningSeedOptions = {}): WriteSpec[] {
  const normalizedOptions = {
    courseId: options.courseId ?? DEFAULT_LEARNING_COURSE_ID,
    subcourseId: options.subcourseId ?? DEFAULT_LEARNING_SUBCOURSE_ID,
    overwriteCatalogFields: options.overwriteCatalogFields ?? false,
  };
  return buildQuestionWrites(normalizedOptions);
}

export function getPhase5SeedCounts(): { questionRecords: number; theoryRecords: number; totalRecords: number } {
  const theoryRecords = chapterEntries().length;
  const questionRecords = phase5SampleQuestions.length;
  return { questionRecords, theoryRecords, totalRecords: questionRecords + theoryRecords };
}

export async function seedLearningContentSlots(options: LearningSeedOptions = {}): Promise<LearningContentSeedResult> {
  const normalizedOptions = {
    courseId: options.courseId ?? DEFAULT_LEARNING_COURSE_ID,
    subcourseId: options.subcourseId ?? DEFAULT_LEARNING_SUBCOURSE_ID,
    overwriteCatalogFields: options.overwriteCatalogFields ?? false,
  };
  const theoryWrites = buildTheoryWrites(normalizedOptions);
  const questionWrites = buildQuestionWrites(normalizedOptions);
  const writes = [...theoryWrites, ...questionWrites];
  for (let index = 0; index < writes.length; index += QUESTION_WRITE_CHUNK_SIZE) {
    await commitWrites(writes.slice(index, index + QUESTION_WRITE_CHUNK_SIZE));
  }
  return {
    questionRecords: questionWrites.length,
    theoryRecords: theoryWrites.length,
    totalRecords: writes.length,
  };
}
