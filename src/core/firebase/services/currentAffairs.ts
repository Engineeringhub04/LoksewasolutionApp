import AsyncStorage from '@react-native-async-storage/async-storage';
import { Collections } from '@/src/core/firebase/collections';
import {
  commitWrites,
  getDocument,
  runQuery,
  serverTimestamp,
  setWrite,
  type FirestoreTimestamp,
  type WriteSpec,
} from '@/src/core/firebase/firestoreRest';
import { CURRENT_AFFAIRS_SEED_ARTICLES, CURRENT_AFFAIRS_SEED_QUESTIONS, CURRENT_AFFAIRS_SEED_VERSION } from '@/src/core/firebase/currentAffairsSeedData';

export type CurrentAffairsCategory = 'सबै' | 'नेपाल' | 'राजनीति तथा शासन' | 'अर्थतन्त्र' | 'अन्तर्राष्ट्रिय' | 'विज्ञान तथा प्रविधि' | 'वातावरण' | 'नियुक्ति तथा पुरस्कार' | 'खेलकुद तथा संस्कृति' | 'प्रतिवेदन तथा सूचकांक' | 'महत्वपूर्ण दिवस';

export interface CurrentAffairsArticle {
  id: string;
  titleNp: string;
  summaryNp: string;
  contentNp: string;
  examRelevanceNp: string;
  keyFactsNp: string[];
  category: string;
  tags: string[];
  sourceName: string;
  sourceUrl: string;
  imageUrl?: string;
  publishedAt: Date | FirestoreTimestamp | null;
  updatedAt?: Date | FirestoreTimestamp | null;
  applicableCourses: string[];
  applicableSubcourses: string[];
  examTags: string[];
  status?: 'draft' | 'published';
  verified?: boolean;
  isSeed?: boolean;
  packIds?: string[];
}

export interface CurrentAffairsOption {
  id: string;
  text: string;
}

export interface CurrentAffairsQuestion {
  id: string;
  articleId: string;
  questionNp: string;
  optionsNp: CurrentAffairsOption[];
  correctOptionId: string;
  explanationNp: string;
  difficulty: string;
  category: string;
  applicableCourses: string[];
  applicableSubcourses: string[];
  publishedAt: Date | FirestoreTimestamp | null;
  status?: 'draft' | 'published';
  isSeed?: boolean;
}

export interface CurrentAffairsPack {
  id: string;
  packType: 'daily' | 'weekly' | 'monthly';
  packDate: string;
  monthKey: string;
  titleNp: string;
  articleIds: string[];
  questionIds: string[];
  articleCount: number;
  questionCount: number;
  isPublished: boolean;
  seedVersion?: string;
}

export interface CurrentAffairsProgress {
  id?: string;
  dateKey: string;
  readArticleIds: string[];
  completedPackIds: string[];
  attemptedQuestionIds: string[];
  correctQuestionIds: string[];
  wrongQuestionIds: string[];
  selectedAnswerIds: Record<string, string>;
  lastScore: number | null;
  quizCompleted: boolean;
  updatedAt?: FirestoreTimestamp | null;
}

const MAX_DAILY_QUESTIONS = 15;
const OFFLINE_KEY = 'current_affairs_offline_v1';
const PROGRESS_CACHE_PREFIX = 'current_affairs_progress_';

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateValue(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as FirestoreTimestamp).toDate();
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function normaliseArticle(raw: Record<string, unknown>): CurrentAffairsArticle {
  return {
    ...(raw as unknown as CurrentAffairsArticle),
    publishedAt: dateValue(raw.publishedAt ?? raw.date),
    updatedAt: dateValue(raw.updatedAt),
    titleNp: String(raw.titleNp ?? raw.headline ?? ''),
    summaryNp: String(raw.summaryNp ?? raw.summary ?? ''),
    contentNp: String(raw.contentNp ?? raw.summaryNp ?? raw.summary ?? ''),
    examRelevanceNp: String(raw.examRelevanceNp ?? ''),
    keyFactsNp: Array.isArray(raw.keyFactsNp) ? raw.keyFactsNp.map(String) : [],
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    examTags: Array.isArray(raw.examTags) ? raw.examTags.map(String) : [],
    applicableCourses: Array.isArray(raw.applicableCourses) ? raw.applicableCourses.map(String) : ['all'],
    applicableSubcourses: Array.isArray(raw.applicableSubcourses) ? raw.applicableSubcourses.map(String) : ['all'],
    category: String(raw.category ?? 'नेपाल'),
    sourceName: String(raw.sourceName ?? ''),
    sourceUrl: String(raw.sourceUrl ?? ''),
  };
}

function normaliseQuestion(raw: Record<string, unknown>): CurrentAffairsQuestion {
  const options = Array.isArray(raw.optionsNp)
    ? raw.optionsNp.map((option, index) => {
        const item = (option ?? {}) as Record<string, unknown>;
        return { id: String(item.id ?? `${String(raw.id ?? 'q')}-${index}`), text: String(item.text ?? '') };
      })
    : [];
  return {
    ...(raw as unknown as CurrentAffairsQuestion),
    publishedAt: dateValue(raw.publishedAt),
    questionNp: String(raw.questionNp ?? raw.question ?? ''),
    optionsNp: options,
    correctOptionId: String(raw.correctOptionId ?? ''),
    explanationNp: String(raw.explanationNp ?? raw.explanation ?? ''),
    difficulty: String(raw.difficulty ?? 'medium'),
    category: String(raw.category ?? 'नेपाल'),
    applicableCourses: Array.isArray(raw.applicableCourses) ? raw.applicableCourses.map(String) : ['all'],
    applicableSubcourses: Array.isArray(raw.applicableSubcourses) ? raw.applicableSubcourses.map(String) : ['all'],
  };
}

function publishedFilter() {
  return [{ field: 'status', op: '==' as const, value: 'published' }];
}

export async function fetchCurrentAffairs(options: {
  category?: string;
  courseId?: string | null;
  subcourseId?: string | null;
  limit?: number;
} = {}): Promise<CurrentAffairsArticle[]> {
  try {
    const docs = await runQuery(Collections.currentAffairsArticles, {
      where: publishedFilter(),
      orderBy: [{ field: 'publishedAt', direction: 'desc' }],
      limit: options.limit ?? 100,
    });
    return docs
      .map(normaliseArticle)
      .filter((article) => !options.category || options.category === 'सबै' || article.category === options.category)
      .filter((article) => !options.courseId || article.applicableCourses.includes('all') || article.applicableCourses.includes(options.courseId))
      .filter((article) => !options.subcourseId || article.applicableSubcourses.includes('all') || article.applicableSubcourses.includes(options.subcourseId));
  } catch {
    // Keep backward compatibility with the old collection if the new seed has not run yet.
    const legacy = await runQuery(Collections.currentAffairs, {
      orderBy: [{ field: 'date', direction: 'desc' }],
      limit: options.limit ?? 100,
    });
    return legacy.map(normaliseArticle);
  }
}

export async function fetchCurrentAffair(articleId: string): Promise<CurrentAffairsArticle | null> {
  const doc = await getDocument(`${Collections.currentAffairsArticles}/${articleId}`);
  if (doc) return normaliseArticle(doc);
  const legacy = await getDocument(`${Collections.currentAffairs}/${articleId}`);
  return legacy ? normaliseArticle(legacy) : null;
}

export async function fetchCurrentAffairsQuestions(options: { category?: string; limit?: number } = {}): Promise<CurrentAffairsQuestion[]> {
  const docs = await runQuery(Collections.currentAffairsQuestions, {
    where: publishedFilter(),
    orderBy: [{ field: 'publishedAt', direction: 'desc' }],
    limit: options.limit ?? 100,
  });
  return docs
    .map(normaliseQuestion)
    .filter((question) => !options.category || options.category === 'सबै' || question.category === options.category);
}

export function selectDailyQuestions(questions: CurrentAffairsQuestion[], date = new Date()): CurrentAffairsQuestion[] {
  const dateKey = localDateKey(date);
  return [...questions]
    .sort((a, b) => `${a.id}-${dateKey}`.localeCompare(`${b.id}-${dateKey}`))
    .slice(0, Math.min(MAX_DAILY_QUESTIONS, questions.length));
}

export function dailyQuestionLimit(total: number): number {
  return Math.min(MAX_DAILY_QUESTIONS, Math.max(0, total));
}

export async function fetchCurrentAffairsPacks(): Promise<CurrentAffairsPack[]> {
  const docs = await runQuery(Collections.currentAffairsPacks, {
    where: [{ field: 'isPublished', op: '==' as const, value: true }],
    orderBy: [{ field: 'packDate', direction: 'desc' }],
    limit: 100,
  });
  return docs as unknown as CurrentAffairsPack[];
}

function emptyProgress(dateKey = localDateKey()): CurrentAffairsProgress {
  return {
    dateKey,
    readArticleIds: [],
    completedPackIds: [],
    attemptedQuestionIds: [],
    correctQuestionIds: [],
    wrongQuestionIds: [],
    selectedAnswerIds: {},
    lastScore: null,
    quizCompleted: false,
  };
}

function progressPath(uid: string, dateKey: string): string {
  return `${Collections.currentAffairsProgress(uid)}/${dateKey}`;
}

export async function fetchCurrentAffairsProgress(uid: string, dateKey = localDateKey()): Promise<CurrentAffairsProgress> {
  const cached = await AsyncStorage.getItem(`${PROGRESS_CACHE_PREFIX}${uid}_${dateKey}`);
  const remote = await getDocument(progressPath(uid, dateKey)).catch(() => null);
  const value = remote ?? (cached ? JSON.parse(cached) as Record<string, unknown> : null);
  if (!value) return emptyProgress(dateKey);
  return {
    ...emptyProgress(dateKey),
    ...(value as unknown as CurrentAffairsProgress),
    id: String(value.id ?? dateKey),
    dateKey,
    readArticleIds: Array.isArray(value.readArticleIds) ? value.readArticleIds.map(String) : [],
    completedPackIds: Array.isArray(value.completedPackIds) ? value.completedPackIds.map(String) : [],
    attemptedQuestionIds: Array.isArray(value.attemptedQuestionIds) ? value.attemptedQuestionIds.map(String) : [],
    correctQuestionIds: Array.isArray(value.correctQuestionIds) ? value.correctQuestionIds.map(String) : [],
    wrongQuestionIds: Array.isArray(value.wrongQuestionIds) ? value.wrongQuestionIds.map(String) : [],
    selectedAnswerIds: (value.selectedAnswerIds ?? {}) as Record<string, string>,
  };
}

export async function saveCurrentAffairsProgress(uid: string, progress: CurrentAffairsProgress): Promise<void> {
  const next = { ...progress, updatedAt: serverTimestamp() };
  await AsyncStorage.setItem(`${PROGRESS_CACHE_PREFIX}${uid}_${progress.dateKey}`, JSON.stringify({ ...next, updatedAt: undefined }));
  await commitWrites([{ type: 'merge', path: progressPath(uid, progress.dateKey), data: next }]);
}

export async function markArticleRead(uid: string, articleId: string): Promise<CurrentAffairsProgress> {
  const progress = await fetchCurrentAffairsProgress(uid);
  if (!progress.readArticleIds.includes(articleId)) progress.readArticleIds.push(articleId);
  await saveCurrentAffairsProgress(uid, progress);
  return progress;
}

export async function saveQuizProgress(uid: string, input: {
  attemptedQuestionIds: string[];
  correctQuestionIds: string[];
  wrongQuestionIds: string[];
  selectedAnswerIds: Record<string, string>;
  score: number;
  completed: boolean;
}): Promise<CurrentAffairsProgress> {
  const progress = await fetchCurrentAffairsProgress(uid);
  const next = { ...progress, ...input, lastScore: input.score, quizCompleted: input.completed };
  await saveCurrentAffairsProgress(uid, next);
  return next;
}

export async function cacheCurrentAffairsOffline(articles: CurrentAffairsArticle[], questions: CurrentAffairsQuestion[]): Promise<void> {
  await AsyncStorage.setItem(OFFLINE_KEY, JSON.stringify({ articles, questions, savedAt: new Date().toISOString() }));
}

export async function getOfflineCurrentAffairs(): Promise<{ articles: CurrentAffairsArticle[]; questions: CurrentAffairsQuestion[]; savedAt: string | null } | null> {
  const raw = await AsyncStorage.getItem(OFFLINE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { articles?: CurrentAffairsArticle[]; questions?: CurrentAffairsQuestion[]; savedAt?: string };
    return { articles: parsed.articles ?? [], questions: parsed.questions ?? [], savedAt: parsed.savedAt ?? null };
  } catch {
    return null;
  }
}

export async function seedCurrentAffairs(): Promise<{ articleCount: number; questionCount: number; packCount: number }> {
  const writes: WriteSpec[] = [];
  const articleIds = CURRENT_AFFAIRS_SEED_ARTICLES.map((article) => article.id);
  const questionIds = CURRENT_AFFAIRS_SEED_QUESTIONS.map((question) => question.id);

  for (const article of CURRENT_AFFAIRS_SEED_ARTICLES) {
    writes.push(setWrite(`${Collections.currentAffairsArticles}/${article.id}`, {
      ...article,
      status: 'published',
      verified: true,
      isSeed: true,
      seedVersion: CURRENT_AFFAIRS_SEED_VERSION,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
  }
  for (const question of CURRENT_AFFAIRS_SEED_QUESTIONS) {
    writes.push(setWrite(`${Collections.currentAffairsQuestions}/${question.id}`, {
      ...question,
      status: 'published',
      verified: true,
      isSeed: true,
      seedVersion: CURRENT_AFFAIRS_SEED_VERSION,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
  }

  const packs = [
    { id: 'ca-pack-daily-2026-08-22', packType: 'daily', packDate: '2026-08-22', monthKey: '2026-08', titleNp: 'आजका समसामयिक विषय', articleIds, questionIds, articleCount: articleIds.length, questionCount: questionIds.length },
    { id: 'ca-pack-weekly-2026-08-22', packType: 'weekly', packDate: '2026-08-22', monthKey: '2026-08', titleNp: 'यो हप्ताका समसामयिक विषय', articleIds, questionIds, articleCount: articleIds.length, questionCount: questionIds.length },
    { id: 'ca-pack-monthly-2026-08', packType: 'monthly', packDate: '2026-08-01', monthKey: '2026-08', titleNp: 'अगस्ट २०२६ समसामयिक संग्रह', articleIds, questionIds, articleCount: articleIds.length, questionCount: questionIds.length },
  ] as const;
  for (const pack of packs) {
    writes.push(setWrite(`${Collections.currentAffairsPacks}/${pack.id}`, {
      ...pack,
      isPublished: true,
      isSeed: true,
      seedVersion: CURRENT_AFFAIRS_SEED_VERSION,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
  }

  writes.push(setWrite(`${Collections.meta}/currentAffairsSeed`, {
    seedVersion: CURRENT_AFFAIRS_SEED_VERSION,
    articleCount: articleIds.length,
    questionCount: questionIds.length,
    seededAt: serverTimestamp(),
  }));

  await commitWrites(writes);
  return { articleCount: articleIds.length, questionCount: questionIds.length, packCount: packs.length };
}

export const currentAffairsConfig = {
  maxDailyQuestions: MAX_DAILY_QUESTIONS,
  offlineKey: OFFLINE_KEY,
  localDateKey,
};
