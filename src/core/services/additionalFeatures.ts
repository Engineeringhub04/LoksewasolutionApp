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
};

const SCOPE_KEY = 'all__all';
const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

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

export async function getCachedAdditionalFeaturePage(featureId: AdditionalFeatureId): Promise<AdditionalFeaturePage | null> {
  return readJson<AdditionalFeaturePage>(pageCacheKey(featureId));
}

export async function getCachedQuestionBank(
  featureId: AdditionalFeatureId,
  topicId: string,
): Promise<AdditionalFeatureQuestionBank | null> {
  return readJson<AdditionalFeatureQuestionBank>(questionCacheKey(featureId, topicId));
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
  const cached = await getCachedQuestionBank(featureId, topicId);
  if (cached && !options.forceRemote) return { bank: cached, fromCache: true };

  const id = bankId || questionBankId(featureId, topicId);
  try {
    const remote = await getDocument(`${Collections.additionalFeatureQuestionBanks}/${id}`) as AdditionalFeatureQuestionBank | null;
    if (remote) await writeJson(questionCacheKey(featureId, topicId), remote);
    return { bank: remote ?? cached, fromCache: !remote };
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
