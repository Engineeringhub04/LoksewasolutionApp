import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Pressable, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import {
  DEFAULT_LEARNING_COURSE_ID,
  DEFAULT_LEARNING_SUBCOURSE_ID,
  fetchLearningChapters,
} from '@/src/core/firebase/services/learning';
import { fetchLearningTheory } from '@/src/core/firebase/services/learningContent';
import { fetchUserProfile } from '@/src/core/firebase/services/profile';
import { fetchQuestionsByChapter, type Question } from '@/src/core/firebase/services/questions';
import { fetchLearningProgress, saveLearningProgress, type LearningProgress } from '@/src/core/firebase/services/learningProgress';
import { addBookmark, removeBookmark } from '@/src/core/firebase/services/bookmarks';
import { fetchMyApprovedContentIds, fetchPendingContentPurchase } from '@/src/core/firebase/services/contentPurchases';
import { useAuthStore } from '@/src/core/store/authStore';
import { useProfileStore } from '@/src/core/store/profileStore';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { Text } from '@/src/components/misc/Text';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { ErrorState } from '@/src/components/feedback/ErrorState';
import { Skeleton } from '@/src/components/feedback/Skeleton';
import { Card } from '@/src/components/cards/Card';
import { showToast } from '@/src/core/store/toastStore';

 type ChapterMode = 'practice' | 'read' | 'theory';

function OptionButton({
  label,
  active,
  correct,
  incorrect,
  onPress,
}: {
  label: string;
  active: boolean;
  correct: boolean;
  incorrect: boolean;
  onPress: () => void;
}) {
  const { colors, spacing, radius } = useTheme();
  const backgroundColor = correct ? '#DCFCE7' : incorrect ? '#FEE2E2' : active ? colors.surfaceAlt : colors.surface;
  const borderColor = correct ? '#22C55E' : incorrect ? '#EF4444' : active ? colors.primary : colors.border;
  return (
    <Pressable onPress={onPress} style={{ borderWidth: 1, borderColor, backgroundColor, borderRadius: radius.md, padding: spacing.sm }}>
      <Text variant="body">{label}</Text>
    </Pressable>
  );
}

export default function ChapterTopicsScreen() {
  const { id, chapterId, unitId } = useLocalSearchParams<{ id: string; chapterId: string; unitId?: string }>();
  const { colors, spacing, radius } = useTheme();
  const { t, language } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { courseInfo } = useProfileStore();
  const courseId = courseInfo?.courseId ?? DEFAULT_LEARNING_COURSE_ID;
  const subcourseId = courseInfo?.subcourseId ?? DEFAULT_LEARNING_SUBCOURSE_ID;
  const [mode, setMode] = useState<ChapterMode>('practice');
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [progress, setProgress] = useState<LearningProgress | null>(null);
  const [progressSaving, setProgressSaving] = useState(false);
  const [dailyQuestionIds, setDailyQuestionIds] = useState<string[]>([]);

  const learningChapters = useAsyncData(
    () => fetchLearningChapters(id, typeof unitId === 'string' ? unitId : null, courseId, subcourseId),
    [id, unitId, courseId, subcourseId]
  );
  const questions = useAsyncData(() => fetchQuestionsByChapter(id, chapterId, 100, courseId, subcourseId), [id, chapterId, courseId, subcourseId]);
  const theory = useAsyncData(
    () => fetchLearningTheory(courseId, subcourseId, id, chapterId),
    [courseId, subcourseId, id, chapterId],
  );
  const profile = useAsyncData(
    () => (user?.uid ? fetchUserProfile(user.uid) : Promise.resolve(null)),
    [user?.uid],
  );
  const approvedContent = useAsyncData(
    () => (user?.uid ? fetchMyApprovedContentIds(user.uid) : Promise.resolve([])),
    [user?.uid],
    { enabled: !!user?.uid },
  );
  const pendingContent = useAsyncData(
    () => (user?.uid && chapterId ? fetchPendingContentPurchase(user.uid, 'chapter', chapterId) : Promise.resolve(null)),
    [user?.uid, chapterId],
    { enabled: !!user?.uid && !!chapterId },
  );
  const chapter = useMemo(
    () => (learningChapters.data ?? []).find((item) => item.id === chapterId) ?? null,
    [chapterId, learningChapters.data]
  );
  const title = chapter ? (language === 'ne' ? chapter.titleNe : chapter.title) : t('learning.chapter');
  const allQuestionItems = useMemo<Question[]>(() => questions.data ?? [], [questions.data]);
  const questionItems = useMemo(
    () => allQuestionItems.filter((question) => !question.mode || question.mode === 'practice'),
    [allQuestionItems],
  );
  const readQuestionItems = useMemo(
    () => allQuestionItems.filter((question) => question.mode === 'read'),
    [allQuestionItems],
  );
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const attemptedIds = useMemo(() => Object.keys(answers), [answers]);
  const dailyQuestionItems = useMemo(() => {
    const byId = new Map(questionItems.map((question) => [question.id, question]));
    const selected = dailyQuestionIds.map((questionId) => byId.get(questionId)).filter((question): question is Question => Boolean(question));
    return selected.length > 0 ? selected : questionItems.slice(0, 30);
  }, [dailyQuestionIds, questionItems]);
  const correctIds = useMemo(
    () => questionItems.filter((question) => answers[question.id] === question.correctIndex).map((question) => question.id),
    [answers, questionItems],
  );
  const attemptedPercent = questionItems.length === 0 ? 0 : Math.round((attemptedIds.length / questionItems.length) * 100);
  const premiumExpiry = profile.data?.premiumExpiryDate ? new Date(profile.data.premiumExpiryDate).getTime() : null;
  const hasActiveSubscription = Boolean(
    profile.data?.isPremium && (premiumExpiry === null || premiumExpiry > Date.now()),
  );
  const hasApprovedContentPurchase = Boolean(chapter && approvedContent.data?.includes(chapter.id));
  const chapterIsLocked = Boolean(chapter?.isPremium && !hasActiveSubscription && !hasApprovedContentPurchase);


  useEffect(() => {
    let active = true;
    if (!user?.uid || !id || !chapterId) {
      setProgress(null);
      return () => {
        active = false;
      };
    }
    void fetchLearningProgress(user.uid, id, chapterId)
      .then((saved) => {
        if (!active || !saved) return;
        setProgress(saved);
        setAnswers(
          Object.fromEntries(saved.attemptedQuestionIds.map((questionId) => [questionId, -1])),
        );
        if (saved.lastMode) setMode(saved.lastMode);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [chapterId, id, user?.uid]);

  useEffect(() => {
    if (!user?.uid || !id || !chapterId || questionItems.length === 0) return;
    const savedDailyIds = progress?.dailyDate === todayKey ? (progress.dailyQuestionIds ?? []) : [];
    const validSavedIds = savedDailyIds.filter((questionId) => questionItems.some((question) => question.id === questionId));
    const nextIds = validSavedIds.length > 0
      ? validSavedIds.slice(0, 30)
      : [...questionItems].sort(() => Math.random() - 0.5).slice(0, 30).map((question) => question.id);
    setDailyQuestionIds(nextIds);
    const needsPersist = progress?.dailyDate !== todayKey
      || JSON.stringify(progress.dailyQuestionIds ?? []) !== JSON.stringify(nextIds);
    if (needsPersist) {
      void saveLearningProgress(user.uid, {
        subjectId: id,
        unitId: typeof unitId === 'string' ? unitId : null,
        chapterId,
        dailyDate: todayKey,
        dailyQuestionIds: nextIds,
        dailyAttemptedQuestionIds: [],
        dailyCorrectQuestionIds: [],
      }).then(() => setProgress((previous) => ({
        id: previous?.id ?? `${id}__${chapterId}`,
        subjectId: id,
        unitId: typeof unitId === 'string' ? unitId : null,
        chapterId,
        attemptedQuestionIds: previous?.attemptedQuestionIds ?? [],
        correctQuestionIds: previous?.correctQuestionIds ?? [],
        bookmarked: previous?.bookmarked ?? false,
        completed: previous?.completed ?? false,
        lastMode: previous?.lastMode ?? mode,
        dailyDate: todayKey,
        dailyQuestionIds: nextIds,
        dailyAttemptedQuestionIds: [],
        dailyCorrectQuestionIds: [],
      }))).catch(() => undefined);
    }
  }, [chapterId, id, mode, progress?.dailyDate, progress?.dailyQuestionIds, questionItems, todayKey, unitId, user?.uid]);

  const persistProgress = (nextAnswers: Record<string, number>, nextMode: ChapterMode = mode, nextBookmarked = progress?.bookmarked ?? false, dailyState?: { attempted: string[]; correct: string[] }) => {
    if (!user?.uid || !id || !chapterId) return;
    const nextAttemptedIds = Object.keys(nextAnswers);
    const nextCorrectIds = questionItems
      .filter((question) => nextAnswers[question.id] === question.correctIndex)
      .map((question) => question.id);
    const nextDailyQuestionIds = dailyQuestionIds.length > 0
      ? dailyQuestionIds
      : questionItems.slice(0, 30).map((question) => question.id);
    const nextDailyAttemptedQuestionIds = dailyState?.attempted ?? (progress?.dailyDate === todayKey ? progress.dailyAttemptedQuestionIds ?? [] : []);
    const nextDailyCorrectQuestionIds = dailyState?.correct ?? (progress?.dailyDate === todayKey ? progress.dailyCorrectQuestionIds ?? [] : []);
    const nextCompleted = questionItems.length > 0 && nextAttemptedIds.length === questionItems.length;
    setProgressSaving(true);
    void saveLearningProgress(user.uid, {
      subjectId: id,
      unitId: typeof unitId === 'string' ? unitId : null,
      chapterId,
      attemptedQuestionIds: nextAttemptedIds,
      correctQuestionIds: nextCorrectIds,
      bookmarked: nextBookmarked,
      completed: nextCompleted,
      lastMode: nextMode,
      dailyDate: todayKey,
      dailyQuestionIds: nextDailyQuestionIds,
      dailyAttemptedQuestionIds: nextDailyAttemptedQuestionIds,
      dailyCorrectQuestionIds: nextDailyCorrectQuestionIds,
    })
      .then(() => setProgress({
        id: progress?.id ?? `${id}__${chapterId}`,
        subjectId: id,
        unitId: typeof unitId === 'string' ? unitId : null,
        chapterId,
        attemptedQuestionIds: nextAttemptedIds,
        correctQuestionIds: nextCorrectIds,
        bookmarked: nextBookmarked,
        completed: nextCompleted,
        lastMode: nextMode,
        dailyDate: todayKey,
        dailyQuestionIds: nextDailyQuestionIds,
        dailyAttemptedQuestionIds: nextDailyAttemptedQuestionIds,
        dailyCorrectQuestionIds: nextDailyCorrectQuestionIds,
      }))
      .catch(() => undefined)
      .finally(() => setProgressSaving(false));
  };

  const handleAnswer = (question: Question, optionIndex: number) => {
    const nextAnswers = { ...answers, [question.id]: optionIndex };
    const previousDailyAttempted = progress?.dailyDate === todayKey ? progress.dailyAttemptedQuestionIds ?? [] : [];
    const previousDailyCorrect = progress?.dailyDate === todayKey ? progress.dailyCorrectQuestionIds ?? [] : [];
    const nextDailyAttempted = Array.from(new Set([...previousDailyAttempted, question.id]));
    const nextDailyCorrect = optionIndex === question.correctIndex
      ? Array.from(new Set([...previousDailyCorrect, question.id]))
      : previousDailyCorrect.filter((questionId) => questionId !== question.id);
    setAnswers(nextAnswers);
    persistProgress(nextAnswers, mode, progress?.bookmarked ?? false, { attempted: nextDailyAttempted, correct: nextDailyCorrect });
  };

  const handleModeChange = (nextMode: ChapterMode) => {
    setMode(nextMode);
    persistProgress(answers, nextMode);
  };

  const handleToggleBookmark = async () => {
    if (!user?.uid || !id || !chapterId || !chapter) return;
    const nextBookmarked = !(progress?.bookmarked ?? false);
    const bookmarkRef = `${id}__${typeof unitId === 'string' ? unitId : 'root'}__${chapterId}`;
    setProgressSaving(true);
    try {
      if (nextBookmarked) {
        await addBookmark(user.uid, 'chapter', bookmarkRef, title, chapter.title);
      } else {
        await removeBookmark(user.uid, `chapter_${bookmarkRef}`);
      }
      await saveLearningProgress(user.uid, {
        subjectId: id,
        unitId: typeof unitId === 'string' ? unitId : null,
        chapterId,
        attemptedQuestionIds: Object.keys(answers),
        correctQuestionIds: correctIds,
        bookmarked: nextBookmarked,
        completed: progress?.completed ?? false,
        lastMode: mode,
      });
      setProgress((previous) => ({
        id: previous?.id ?? `${id}__${chapterId}`,
        subjectId: id,
        unitId: typeof unitId === 'string' ? unitId : null,
        chapterId,
        attemptedQuestionIds: Object.keys(answers),
        correctQuestionIds: correctIds,
        bookmarked: nextBookmarked,
        completed: previous?.completed ?? false,
        lastMode: mode,
      }));
      showToast(nextBookmarked ? t('subjects.addedToBookmarks') : t('bookmarks.removed'), 'success');
    } catch {
      showToast(t('common.somethingWentWrong'), 'error');
    } finally {
      setProgressSaving(false);
    }
  };

  const modes: { id: ChapterMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: 'practice', label: t('learning.practice'), icon: 'checkmark-circle-outline' },
    { id: 'read', label: t('learning.read'), icon: 'book-outline' },
    { id: 'theory', label: t('learning.theory'), icon: 'school-outline' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TopAppBar
        title={title}
        actions={(
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Pressable
              onPress={() => router.push({ pathname: '/report-question', params: { questionRef: `${id}/${chapterId}` } })}
              accessibilityLabel={t('profile.reportQuestion')}
            >
              <Ionicons name="flag-outline" size={22} color={colors.onPrimary} />
            </Pressable>
            <Pressable onPress={() => void handleToggleBookmark()} disabled={progressSaving} accessibilityLabel={progress?.bookmarked ? t('bookmarks.removed') : t('subjects.addedToBookmarks')}>
              <Ionicons name={progress?.bookmarked ? 'bookmark' : 'bookmark-outline'} size={22} color={colors.onPrimary} />
            </Pressable>
          </View>
        )}
      />
      <ScrollView contentContainerStyle={{ padding: spacing.screenPadding, gap: spacing.md, paddingBottom: spacing.xl }}>
        {learningChapters.loading ? (
          <><Skeleton height={120} /><Skeleton height={56} /><Skeleton height={180} /></>
        ) : learningChapters.error ? (
          <ErrorState onRetry={learningChapters.refetch} />
        ) : (
          <>
            <Card style={{ backgroundColor: colors.primary, borderRadius: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View style={{ width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' }}>
                  <Ionicons name="book-outline" size={28} color={colors.onPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="h3" weight="bold" style={{ color: colors.onPrimary }} numberOfLines={3}>{title}</Text>
                  <Text variant="bodySmall" style={{ color: colors.onPrimary, opacity: 0.8 }}>
                    {chapter?.questionCount ?? questionItems.length} {t('subscription.questions')}
                  </Text>
                </View>
              </View>
            </Card>

            <Card style={{ gap: spacing.sm, borderColor: '#D8DFFF', backgroundColor: '#F7F8FF' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <Ionicons name="analytics-outline" size={20} color="#344A86" />
                  <Text variant="bodyLarge" weight="bold">{t('learning.progress')}</Text>
                </View>
                <Text variant="bodyLarge" weight="bold" style={{ color: '#344A86' }}>{attemptedPercent}%</Text>
              </View>
              <View style={{ height: 8, borderRadius: 8, backgroundColor: '#E5E9FF', overflow: 'hidden' }}>
                <View style={{ width: `${attemptedPercent}%`, height: '100%', borderRadius: 8, backgroundColor: '#7186D6' }} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="bodySmall" secondary>{t('learning.dailyQuestions')}: {(progress?.dailyDate === todayKey ? progress.dailyAttemptedQuestionIds?.length ?? 0 : 0)} / {dailyQuestionItems.length}</Text>
                <Text variant="bodySmall" secondary>{correctIds.length} {t('learning.questionsCorrect')}</Text>
              </View>
              <Text variant="caption" secondary>{t('learning.dailyLimit')} · {t('learning.dailyReset')}</Text>
              {progressSaving ? <Text variant="caption" secondary>{t('learning.savingProgress')}</Text> : null}
              {!progressSaving && progress ? <Text variant="caption" style={{ color: '#344A86' }}>{t('learning.progressSaved')}</Text> : null}
            </Card>

            {chapterIsLocked ? (
              <Card style={{ gap: spacing.sm, borderColor: '#7186D6', backgroundColor: '#EEF2FF' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <View style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DDE5FF' }}>
                    <Ionicons name="lock-closed-outline" size={22} color="#344A86" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyLarge" weight="bold" style={{ color: '#1E2A5A' }}>{t('learning.premiumChapter')}</Text>
                    <Text variant="bodySmall" secondary>{t('learning.premiumChapterHint')}</Text>
                  </View>
                </View>
                {chapter?.price ? <Text variant="bodySmall" secondary>{t('learning.chapterPrice')}: NPR {chapter.price}</Text> : null}
                <Pressable
                  onPress={() => {
                    if (pendingContent.data) {
                      router.push({ pathname: '/purchase-details/content/[id]', params: { id: pendingContent.data.id, source: 'chapter' } } as never);
                      return;
                    }
                    router.push({
                      pathname: '/subscription/checkout',
                      params: {
                        contentId: chapter?.id ?? chapterId,
                        contentType: 'chapter',
                        contentSubjectId: id,
                        ...(typeof unitId === 'string' ? { contentUnitId: unitId } : {}),
                      },
                    } as never);
                  }}
                  style={{ minHeight: 46, borderRadius: radius.md, backgroundColor: pendingContent.data ? '#B45309' : '#344A86', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text variant="body" weight="bold" style={{ color: '#FFFFFF' }}>{pendingContent.data ? t('learning.purchasePending') : t('learning.purchaseChapter')}</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push('/subscription')}
                  style={{ minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: '#7186D6', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text variant="bodySmall" weight="bold" style={{ color: '#344A86' }}>{t('learning.viewSubscriptionPlans')}</Text>
                </Pressable>
              </Card>
            ) : null}

            <View style={{ flexDirection: 'row', gap: spacing.xs }}>
              {modes.map((item) => {
                const selected = mode === item.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => handleModeChange(item.id)}
                    style={{ flex: 1, minHeight: 48, borderRadius: radius.lg, backgroundColor: selected ? colors.primary : colors.surface, borderWidth: 1, borderColor: selected ? colors.primary : colors.border, alignItems: 'center', justifyContent: 'center', gap: 2 }}
                  >
                    <Ionicons name={item.icon} size={18} color={selected ? colors.onPrimary : colors.textSecondary} />
                    <Text variant="caption" weight="semiBold" style={{ color: selected ? colors.onPrimary : colors.textSecondary }}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {chapterIsLocked ? (
              <Card style={{ alignItems: 'center', gap: spacing.sm, borderColor: '#D8DFFF', backgroundColor: '#F7F8FF' }}>
                <Ionicons name="shield-checkmark-outline" size={30} color="#7186D6" />
                <Text variant="body" secondary style={{ textAlign: 'center' }}>{t('learning.premiumChapterHint')}</Text>
              </Card>
            ) : mode === 'practice' ? (
              questions.loading ? (
                <><Skeleton height={180} /><Skeleton height={180} /></>
              ) : questions.error ? (
                <ErrorState onRetry={questions.refetch} />
              ) : questionItems.length === 0 ? (
                <EmptyState title={t('learning.noQuestions')} />
              ) : (
                dailyQuestionItems.map((question, index) => {
                  const selectedIndex = answers[question.id];
                  const answered = selectedIndex !== undefined && selectedIndex >= 0;
                  return (
                    <Card key={question.id} style={{ gap: spacing.sm }}>
                      <Text variant="bodyLarge" weight="semiBold">{index + 1}. {question.text}</Text>
                      <View style={{ gap: spacing.xs }}>
                        {question.options.map((option, optionIndex) => (
                          <OptionButton
                            key={`${question.id}-${optionIndex}`}
                            label={`${String.fromCharCode(65 + optionIndex)}. ${option}`}
                            active={selectedIndex === optionIndex}
                            correct={answered && optionIndex === question.correctIndex}
                            incorrect={answered && selectedIndex === optionIndex && optionIndex !== question.correctIndex}
                            onPress={() => handleAnswer(question, optionIndex)}
                          />
                        ))}
                      </View>
                      {answered ? (
                        <View style={{ borderRadius: radius.md, padding: spacing.sm, backgroundColor: selectedIndex === question.correctIndex ? '#ECFDF5' : '#FFF7ED' }}>
                          <Text variant="bodySmall">{question.explanation || t('learning.answerExplanationComingSoon')}</Text>
                        </View>
                      ) : null}
                    </Card>
                  );
                })
              )
            ) : mode === 'read' ? (
              readQuestionItems.length === 0 ? (
                <EmptyState title={t('learning.noReadQuestions')} />
              ) : (
                <View style={{ gap: spacing.md }}>
                  {readQuestionItems.map((question, index) => {
                    const questionText = language === 'ne' ? question.textNe ?? question.text : question.text;
                    const options = language === 'ne' ? question.optionsNe ?? question.options : question.options;
                    const explanation = language === 'ne' ? question.explanationNe ?? question.explanation : question.explanation;
                    return (
                      <Card key={question.id} style={{ gap: spacing.sm }}>
                        <Text variant="bodyLarge" weight="semiBold">{index + 1}. {questionText}</Text>
                        <View style={{ gap: spacing.xs }}>
                          {options.map((option, optionIndex) => (
                            <Text key={`${question.id}-${optionIndex}`} variant="body">{String.fromCharCode(65 + optionIndex)}. {option}</Text>
                          ))}
                        </View>
                        {explanation ? <Text variant="bodySmall" secondary>{explanation}</Text> : null}
                      </Card>
                    );
                  })}
                </View>
              )
            ) : (
              <Card style={{ gap: spacing.sm, borderColor: '#7186D6', backgroundColor: '#EEF2FF' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Ionicons name="school-outline" size={24} color="#344A86" />
                  <Text variant="h3" weight="bold">{t('learning.theoryNotes')}</Text>
                </View>
                {theory.loading ? (
                  <Skeleton height={72} />
                ) : theory.error ? (
                  <ErrorState onRetry={theory.refetch} />
                ) : theory.data ? (
                  <>
                    {theory.data.notes ? <Text variant="body" secondary>{language === 'ne' ? theory.data.notesNe ?? theory.data.notes : theory.data.notes}</Text> : null}
                    {theory.data.pdfUrl ? (
                      <Pressable
                        onPress={() => Linking.openURL(theory.data?.pdfUrl ?? '').catch(() => showToast(t('learning.theoryLinkError'), 'error'))}
                        style={{ minHeight: 46, borderRadius: radius.md, backgroundColor: '#344A86', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Text variant="body" weight="bold" style={{ color: '#FFFFFF' }}>{t('learning.openTheoryPdf')}</Text>
                      </Pressable>
                    ) : (
                      <Text variant="body" secondary>{t('learning.theoryComingSoon')}</Text>
                    )}
                  </>
                ) : (
                  <Text variant="body" secondary>{t('learning.theoryComingSoon')}</Text>
                )}
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
