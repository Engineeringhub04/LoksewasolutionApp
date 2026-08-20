import AsyncStorage from '@react-native-async-storage/async-storage';

import { Collections } from '@/src/core/firebase/collections';
import { getDocument } from '@/src/core/firebase/firestoreRest';

export type AdditionalFeatureId = 'gk' | 'pm';

export type AdditionalFeatureQuestion = {
  questionId: string;
  order: number;
  difficulty: 'easy' | 'medium' | 'hard' | string;
  question: string;
  options: { id: string; text: string }[];
  correctOption: number;
  correctOptionId?: string;
  explanation: string;
};

export type AdditionalFeatureTopic = {
  topicId: string;
  slug?: string;
  order: number;
  titleEn: string;
  titleNp: string;
  questionCount: number;
  questionBankId?: string;
  questionBankUpdatedAt?: string;
  isPublished?: boolean;
};

export type AdditionalFeaturePage = {
  pageId?: string;
  featureId?: AdditionalFeatureId;
  titleEn?: string;
  titleNp?: string;
  topics?: AdditionalFeatureTopic[];
  updatedAt?: unknown;
  seedVersion?: string;
  cacheSchemaVersion?: number;
  answerMappingVersion?: number;
};

export type AdditionalFeatureQuestionBank = {
  bankId?: string;
  featureId?: AdditionalFeatureId;
  topicId?: string;
  topicTitleEn?: string;
  topicTitleNp?: string;
  questions?: AdditionalFeatureQuestion[];
  updatedAt?: unknown;
  seedVersion?: string;
  cacheSchemaVersion?: number;
  answerMappingVersion?: number;
};

export type AdditionalFeaturePracticeProgress = {
  featureId: AdditionalFeatureId;
  topicId: string;
  dailyDate: string;
  attemptedQuestionIds: string[];
  correctQuestionIds: string[];
  selectedAnswerIndexes: Record<string, number>;
  selectedAnswerIds: Record<string, string>;
};

const SCOPE_KEY = 'all__all';
const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const CACHE_SCHEMA_VERSION = 2;
const ANSWER_MAPPING_VERSION = 2;
const CACHE_MIGRATION_KEY = 'af_cache_schema_version';

function pageId(featureId: AdditionalFeatureId): string {
  return `${featureId}__${SCOPE_KEY}`;
}

export function questionBankId(featureId: AdditionalFeatureId, topicId: string): string {
  return `${featureId}__${SCOPE_KEY}__${topicId}`;
}

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function pageCacheKey(featureId: AdditionalFeatureId): string {
  return `af_cache_${featureId}_data`;
}

function pageCacheDateKey(featureId: AdditionalFeatureId): string {
  return `af_cache_${featureId}_date`;
}

function questionCacheKey(featureId: AdditionalFeatureId, topicId: string): string {
  return `af_qbank_${featureId}_${topicId}`;
}

function offlineCompleteKey(featureId: AdditionalFeatureId): string {
  return `af_offline_${featureId}_complete`;
}

function offlineDateKey(featureId: AdditionalFeatureId): string {
  return `af_offline_${featureId}_date`;
}

function practiceProgressKey(featureId: AdditionalFeatureId, topicId: string): string {
  return `af_practice_${featureId}_${topicId}`;
}

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const value = await AsyncStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A cache failure must never prevent remote data from opening.
  }
}

let cacheMigrationPromise: Promise<void> | null = null;

/**
 * Clears only GK/PM practice results created by the old answer-index mapping.
 * Question-bank data is retained because the new runtime maps answers by option id,
 * so already-downloaded banks remain usable while Offline Access is refreshed.
 */
export async function migrateAdditionalFeatureCache(): Promise<void> {
  if (!cacheMigrationPromise) {
    cacheMigrationPromise = (async () => {
      const currentVersion = await AsyncStorage.getItem(CACHE_MIGRATION_KEY);
      if (currentVersion === String(CACHE_SCHEMA_VERSION)) return;

      const keys = await AsyncStorage.getAllKeys();
      const legacyPracticeKeys = keys.filter((key) => key.startsWith('af_practice_gk_') || key.startsWith('af_practice_pm_'));
      const offlineStateKeys = keys.filter((key) => key === offlineCompleteKey('gk') || key === offlineDateKey('gk') || key === offlineCompleteKey('pm') || key === offlineDateKey('pm'));
      await AsyncStorage.multiRemove([...legacyPracticeKeys, ...offlineStateKeys]);
      await AsyncStorage.setItem(CACHE_MIGRATION_KEY, String(CACHE_SCHEMA_VERSION));
    })().catch(() => undefined);
  }
  await cacheMigrationPromise;
}

export async function getCachedAdditionalFeaturePage(featureId: AdditionalFeatureId): Promise<AdditionalFeaturePage | null> {
  return readJson<AdditionalFeaturePage>(pageCacheKey(featureId));
}

export async function getCachedQuestionBank(
  featureId: AdditionalFeatureId,
  topicId: string,
): Promise<AdditionalFeatureQuestionBank | null> {
  return readJson<AdditionalFeatureQuestionBank>(questionCacheKey(featureId, topicId));
}

function emptyPracticeProgress(featureId: AdditionalFeatureId, topicId: string): AdditionalFeaturePracticeProgress {
  return {
    featureId,
    topicId,
    dailyDate: localDateKey(),
    attemptedQuestionIds: [],
    correctQuestionIds: [],
    selectedAnswerIndexes: {},
    selectedAnswerIds: {},
  };
}

export async function getAdditionalFeaturePracticeProgress(
  featureId: AdditionalFeatureId,
  topicId: string,
): Promise<AdditionalFeaturePracticeProgress> {
  await migrateAdditionalFeatureCache();
  const cached = await readJson<AdditionalFeaturePracticeProgress>(practiceProgressKey(featureId, topicId));
  const today = localDateKey();
  if (!cached || cached.dailyDate !== today) return emptyPracticeProgress(featureId, topicId);
  return {
    ...emptyPracticeProgress(featureId, topicId),
    ...cached,
    dailyDate: today,
    attemptedQuestionIds: Array.isArray(cached.attemptedQuestionIds) ? cached.attemptedQuestionIds : [],
    correctQuestionIds: Array.isArray(cached.correctQuestionIds) ? cached.correctQuestionIds : [],
    selectedAnswerIndexes: cached.selectedAnswerIndexes ?? {},
    selectedAnswerIds: cached.selectedAnswerIds ?? {},
  };
}

export async function saveAdditionalFeaturePracticeProgress(progress: AdditionalFeaturePracticeProgress): Promise<void> {
  await writeJson(practiceProgressKey(progress.featureId, progress.topicId), progress);
}

export async function getAdditionalFeatureTopicProgress(
  featureId: AdditionalFeatureId,
  topicId: string,
  questionCount: number,
): Promise<number> {
  if (questionCount <= 0) return 0;
  const progress = await getAdditionalFeaturePracticeProgress(featureId, topicId);
  return Math.min(100, Math.round((progress.attemptedQuestionIds.length / questionCount) * 100));
}

export async function getOfflineAccessState(featureId: AdditionalFeatureId): Promise<{ complete: boolean; date: string | null }> {
  const [complete, date] = await Promise.all([
    AsyncStorage.getItem(offlineCompleteKey(featureId)),
    AsyncStorage.getItem(offlineDateKey(featureId)),
  ]);
  const today = localDateKey();
  const isCurrent = date === today;
  if (complete === 'true' && !isCurrent) {
    await AsyncStorage.multiRemove([offlineCompleteKey(featureId), offlineDateKey(featureId)]);
  }
  return { complete: complete === 'true' && isCurrent, date: isCurrent ? date : null };
}

async function markOfflineAccessComplete(featureId: AdditionalFeatureId): Promise<void> {
  await AsyncStorage.multiSet([
    [offlineCompleteKey(featureId), 'true'],
    [offlineDateKey(featureId), localDateKey()],
  ]);
}

/**
 * Reads the local page immediately and checks Firebase at most once per local day.
 * This keeps normal navigation cache-first while still allowing new topics to appear after midnight.
 */
export async function loadAdditionalFeaturePage(
  featureId: AdditionalFeatureId,
  options: { forceRemote?: boolean } = {},
): Promise<{ page: AdditionalFeaturePage | null; fromCache: boolean; remoteChecked: boolean }> {
  await migrateAdditionalFeatureCache();
  const cached = await getCachedAdditionalFeaturePage(featureId);
  const cachedDate = await AsyncStorage.getItem(pageCacheDateKey(featureId));
  const today = localDateKey();
  const shouldCheckRemote = options.forceRemote === true || !cached || cachedDate !== today;

  if (!shouldCheckRemote && cached) return { page: cached, fromCache: true, remoteChecked: false };

  try {
    const remote = await getDocument(`${Collections.additionalFeaturePages}/${pageId(featureId)}`) as AdditionalFeaturePage | null;
    if (remote) {
      await writeJson(pageCacheKey(featureId), remote);
      await AsyncStorage.setItem(pageCacheDateKey(featureId), today);
    }
    return { page: remote ?? cached, fromCache: !remote, remoteChecked: true };
  } catch (error) {
    if (cached) return { page: cached, fromCache: true, remoteChecked: true };
    throw error;
  }
}

/** Returns cached data first and falls back to Firebase when the topic is not cached. */
export async function loadAdditionalFeatureQuestionBank(
  featureId: AdditionalFeatureId,
  topicId: string,
  bankId?: string,
  options: { forceRemote?: boolean } = {},
): Promise<{ bank: AdditionalFeatureQuestionBank | null; fromCache: boolean }> {
  await migrateAdditionalFeatureCache();
  const cached = await getCachedQuestionBank(featureId, topicId);
  if (cached && !options.forceRemote) {
    if (cached.answerMappingVersion !== ANSWER_MAPPING_VERSION || cached.cacheSchemaVersion !== CACHE_SCHEMA_VERSION) {
      const migrated = { ...cached, cacheSchemaVersion: CACHE_SCHEMA_VERSION, answerMappingVersion: ANSWER_MAPPING_VERSION };
      await writeJson(questionCacheKey(featureId, topicId), migrated);
      return { bank: migrated, fromCache: true };
    }
    return { bank: cached, fromCache: true };
  }

  const id = bankId || questionBankId(featureId, topicId);
  try {
    const remote = await getDocument(`${Collections.additionalFeatureQuestionBanks}/${id}`) as AdditionalFeatureQuestionBank | null;
    const versionedRemote = remote ? { ...remote, cacheSchemaVersion: CACHE_SCHEMA_VERSION, answerMappingVersion: ANSWER_MAPPING_VERSION } : null;
    if (versionedRemote) await writeJson(questionCacheKey(featureId, topicId), versionedRemote);
    return { bank: versionedRemote ?? cached, fromCache: !versionedRemote };
  } catch (error) {
    if (cached) return { bank: cached, fromCache: true };
    throw error;
  }
}

export async function downloadAllAdditionalFeatureQuestionBanks(
  featureId: AdditionalFeatureId,
  topics: AdditionalFeatureTopic[],
): Promise<void> {
  await Promise.all(topics.map(async (topic) => {
    const result = await loadAdditionalFeatureQuestionBank(featureId, topic.topicId, topic.questionBankId, { forceRemote: true });
    if (!result.bank) throw new Error(`Question bank not found: ${topic.topicId}`);
  }));
  await markOfflineAccessComplete(featureId);
}

/** Invalidates the daily page marker so a manual pull-to-refresh can fetch immediately. */
export async function invalidateAdditionalFeatureDailyCheck(featureId: AdditionalFeatureId): Promise<void> {
  await AsyncStorage.removeItem(pageCacheDateKey(featureId));
}

export const additionalFeatureCache = {
  UPDATE_CHECK_INTERVAL_MS,
  localDateKey,
};
