import { Collections } from '@/src/core/firebase/collections';
import { commitWrites, serverTimestamp, setWrite, type WriteSpec } from '@/src/core/firebase/firestoreRest';
import { ADDITIONAL_FEATURE_SEED_DATA, type AdditionalFeatureId, type AdditionalFeatureTopic } from '@/src/core/firebase/additionalFeatureSeedData';

const SCOPE_KEY = 'all__all';
const COURSE_ID = 'all';
const SUBCOURSE_ID = 'all';
const SEED_VERSION = 'gk-pm-corrected-2026-08-19';

const FEATURE_META: Record<AdditionalFeatureId, { titleEn: string; titleNp: string }> = {
  gk: { titleEn: 'General Knowledge', titleNp: 'सामान्य ज्ञान' },
  pm: { titleEn: 'Public Management', titleNp: 'सार्वजनिक व्यवस्थापन' },
};

function pageId(featureId: AdditionalFeatureId) {
  return `${featureId}__${SCOPE_KEY}`;
}

function bankId(featureId: AdditionalFeatureId, topicId: string) {
  return `${featureId}__${SCOPE_KEY}__${topicId}`;
}

function topicSummary(topic: AdditionalFeatureTopic, order: number) {
  return {
    topicId: topic.topicId,
    slug: topic.slug,
    order,
    titleEn: topic.titleEn,
    titleNp: topic.titleNp,
    questionCount: topic.questions.length,
    questionBankId: bankId(topic.featureId, topic.topicId),
    questionBankUpdatedAt: SEED_VERSION,
    isPublished: true,
  };
}

function pageWrite(featureId: AdditionalFeatureId, topics: AdditionalFeatureTopic[]): WriteSpec {
  const meta = FEATURE_META[featureId];
  return setWrite(`${Collections.additionalFeaturePages}/${pageId(featureId)}`, {
    pageId: pageId(featureId),
    featureId,
    pageKey: featureId,
    titleEn: meta.titleEn,
    titleNp: meta.titleNp,
    courseId: COURSE_ID,
    subcourseId: SUBCOURSE_ID,
    scopeKey: SCOPE_KEY,
    topicCount: topics.length,
    topics: topics.map((topic, index) => topicSummary(topic, index + 1)),
    seedVersion: SEED_VERSION,
    isPublished: true,
    isSeed: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

function questionBankWrite(topic: AdditionalFeatureTopic): WriteSpec {
  const id = bankId(topic.featureId, topic.topicId);
  return setWrite(`${Collections.additionalFeatureQuestionBanks}/${id}`, {
    bankId: id,
    featureId: topic.featureId,
    courseId: COURSE_ID,
    subcourseId: SUBCOURSE_ID,
    scopeKey: SCOPE_KEY,
    topicId: topic.topicId,
    topicTitleEn: topic.titleEn,
    topicTitleNp: topic.titleNp,
    questionCount: topic.questions.length,
    questions: topic.questions,
    seedVersion: SEED_VERSION,
    isPublished: true,
    isSeed: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Safe to re-run: deterministic document IDs replace the same corrected data,
 * without touching existing Subject, chapter, unit, or legacy question data.
 */
export async function seedAdditionalFeatures(): Promise<{ topicCount: number; questionCount: number }> {
  const writes: WriteSpec[] = [];
  let topicCount = 0;
  let questionCount = 0;

  for (const featureId of ['gk', 'pm'] as const) {
    const topics = ADDITIONAL_FEATURE_SEED_DATA[featureId];
    writes.push(pageWrite(featureId, topics));
    for (const topic of topics) {
      writes.push(questionBankWrite(topic));
      topicCount += 1;
      questionCount += topic.questions.length;
    }
  }

  await commitWrites(writes);
  return { topicCount, questionCount };
}
