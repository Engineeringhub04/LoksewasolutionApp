import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { useProfileStore } from '@/src/core/store/profileStore';
import { showToast } from '@/src/core/store/toastStore';
import { fetchPracticeQuestionSet, type LearningQuestion } from '@/src/core/firebase/services/learningContent';
import { fetchLearningProgress, saveLearningProgress, type LearningProgress } from '@/src/core/firebase/services/learningProgress';
import { fetchMyContentPurchases } from '@/src/core/firebase/services/contentPurchases';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { ConfirmDialog } from '@/src/components/feedback/ConfirmDialog';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';

function valueOf(value: string | string[] | undefined, fallback = ''): string {
  return Array.isArray(value) ? value[0] ?? fallback : value ?? fallback;
}

function dayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function bilingual(english: string, nepali: string): string {
  const ne = nepali.trim();
  return ne && ne !== english.trim() ? `${english} | ${ne}` : english;
}

function shuffleQuestions(questions: LearningQuestion[]): LearningQuestion[] {
  const shuffled = [...questions];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}

function isActivePremium(profile: ReturnType<typeof useProfileStore.getState>['profile']): boolean {
  if (!profile?.isPremium) return false;
  if (!profile.premiumExpiryDate) return true;
  return new Date(profile.premiumExpiryDate).getTime() > Date.now();
}

export default function PracticeModeScreen() {
  const params = useLocalSearchParams<{
    courseId?: string;
    subcourseId?: string;
    subjectId?: string;
    chapterId?: string;
    unitId?: string;
    subjectName?: string;
    chapterName?: string;
    subjectPro?: string;
    chapterPro?: string;
  }>();
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const profile = useProfileStore((state) => state.profile);
  const [questions, setQuestions] = useState<LearningQuestion[]>([]);
  const [progress, setProgress] = useState<LearningProgress | null>(null);
  const progressRef = useRef<LearningProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [current, setCurrent] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const scrollRef = useRef<ScrollView | null>(null);
  const scrollYRef = useRef(0);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const explanationY = useRef(0);
  const [showLimit, setShowLimit] = useState(false);
  const [showWaiting, setShowWaiting] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [hasSpecificAccess, setHasSpecificAccess] = useState(false);

  const courseId = valueOf(params.courseId);
  const subcourseId = valueOf(params.subcourseId);
  const subjectId = valueOf(params.subjectId);
  const chapterId = valueOf(params.chapterId);
  const unitId = valueOf(params.unitId) || null;
  const premiumContent = valueOf(params.subjectPro) === 'true' || valueOf(params.chapterPro) === 'true';
  const profilePremium = isActivePremium(profile);
  const premium = profilePremium || hasSpecificAccess;
  const proSubjectActive = profilePremium && premiumContent;

  const load = useCallback(async () => {
    if (!user?.uid || !subjectId || !chapterId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(false);
    try {
      const [allQuestions, storedProgress, purchases] = await Promise.all([
        fetchPracticeQuestionSet({ courseId, subcourseId, subjectId, unitId, chapterId }),
        fetchLearningProgress(user.uid, subjectId, chapterId),
        fetchMyContentPurchases(user.uid).catch(() => []),
      ]);
      const specificAccess = purchases.some((purchase) => purchase.status === 'active' && (
        (purchase.contentType === 'chapter' && purchase.contentId === chapterId)
        || (purchase.contentType === 'subject' && purchase.contentId === subjectId)
      ));
      const premiumForLoad = profilePremium || specificAccess;
      const practiceQuestions = shuffleQuestions(allQuestions.slice(0, premiumForLoad ? 100 : undefined));
      setHasSpecificAccess(specificAccess);
      const today = dayKey();
      const nextProgress: LearningProgress = storedProgress
        ? storedProgress.dailyDate === today
          ? storedProgress
          : { ...storedProgress, dailyDate: today, dailyQuestionIds: [], dailyAttemptedQuestionIds: [], dailyCorrectQuestionIds: [], selectedAnswerIndexes: {} }
        : {
            id: `${subjectId}__${chapterId}`,
            subjectId,
            unitId,
            chapterId,
            attemptedQuestionIds: [],
            correctQuestionIds: [],
            totalQuestions: practiceQuestions.length,
            bookmarked: false,
            completed: false,
            lastMode: 'practice',
            dailyDate: today,
            dailyQuestionIds: [],
            dailyAttemptedQuestionIds: [],
            dailyCorrectQuestionIds: [],
            selectedAnswerIndexes: {},
          };
      setQuestions(practiceQuestions);
      setSelectedAnswers(nextProgress.selectedAnswerIndexes ?? {});
      setCurrent(0);
      setProgress(nextProgress);
      progressRef.current = nextProgress;
      if (storedProgress && storedProgress.dailyDate !== today) {
        void saveLearningProgress(user.uid, {
          subjectId,
          unitId,
          chapterId,
          dailyDate: today,
          dailyQuestionIds: [],
          dailyAttemptedQuestionIds: [],
          dailyCorrectQuestionIds: [],
          selectedAnswerIndexes: {},
          lastMode: 'practice',
        });
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [chapterId, courseId, profilePremium, subcourseId, subjectId, unitId, user?.uid]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setShowLeaveConfirm(true);
      return true;
    });
    return () => {
      subscription.remove();
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, []);

  const dailyAttemptedIds = useMemo(() => progress?.dailyAttemptedQuestionIds ?? [], [progress?.dailyAttemptedQuestionIds]);
  const dailyCorrectIds = useMemo(() => progress?.dailyCorrectQuestionIds ?? [], [progress?.dailyCorrectQuestionIds]);
  const dailyUsed = dailyAttemptedIds.length;
  const dailyLimit = premium ? Math.min(100, questions.length) : Math.min(30, questions.length);
  const currentQuestion = questions[current];
  const currentSelected = currentQuestion ? selectedAnswers[currentQuestion.id] : undefined;
  const currentAttempted = currentQuestion ? dailyAttemptedIds.includes(currentQuestion.id) : false;
  const currentCorrect = currentQuestion ? dailyCorrectIds.includes(currentQuestion.id) : false;
  const isLast = current === questions.length - 1;
  const persist = (next: LearningProgress) => {
    progressRef.current = next;
    setProgress(next);
    if (!user?.uid) return;
    void saveLearningProgress(user.uid, {
      subjectId,
      unitId,
      chapterId,
      attemptedQuestionIds: next.attemptedQuestionIds,
      correctQuestionIds: next.correctQuestionIds,
      completed: next.completed,
      lastMode: 'practice',
      dailyDate: next.dailyDate,
      dailyQuestionIds: next.dailyQuestionIds,
      dailyAttemptedQuestionIds: next.dailyAttemptedQuestionIds,
      dailyCorrectQuestionIds: next.dailyCorrectQuestionIds,
      selectedAnswerIndexes: next.selectedAnswerIndexes,
      totalQuestions: questions.length,
    });
  };

  const smoothScrollTo = (targetY: number) => {
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    const startY = scrollYRef.current;
    const distance = targetY - startY;
    const duration = 600;
    const startedAt = Date.now();

    const tick = () => {
      const progress = Math.min(1, (Date.now() - startedAt) / duration);
      const eased = progress < 0.5 ? 2 * progress * progress : 1 - ((-2 * progress + 2) ** 2) / 2;
      const nextY = startY + distance * eased;
      scrollYRef.current = nextY;
      scrollRef.current?.scrollTo({ y: nextY, animated: false });
      if (progress < 1) scrollTimerRef.current = setTimeout(tick, 16);
      else scrollTimerRef.current = null;
    };

    tick();
  };

  const selectOption = (optionIndex: number) => {
    if (!currentQuestion) return;
    if (!premium && dailyUsed >= dailyLimit && !currentAttempted) {
      setShowLimit(true);
      return;
    }
    if (currentAttempted) return;
    setSelectedAnswers((previous) => ({ ...previous, [currentQuestion.id]: optionIndex }));
    const base = progressRef.current;
    if (!base) return;
    const isCorrect = optionIndex === currentQuestion.correctIndex;
    const attempted = Array.from(new Set([...base.attemptedQuestionIds, currentQuestion.id]));
    const correct = isCorrect ? Array.from(new Set([...base.correctQuestionIds, currentQuestion.id])) : base.correctQuestionIds;
    const dailyAttempted = Array.from(new Set([...(base.dailyAttemptedQuestionIds ?? []), currentQuestion.id]));
    const dailyCorrect = isCorrect ? Array.from(new Set([...(base.dailyCorrectQuestionIds ?? []), currentQuestion.id])) : (base.dailyCorrectQuestionIds ?? []);
    const next: LearningProgress = {
      ...base,
      selectedAnswerIndexes: { ...(base.selectedAnswerIndexes ?? {}), [currentQuestion.id]: optionIndex },
      attemptedQuestionIds: attempted,
      correctQuestionIds: correct,
      dailyDate: dayKey(),
      dailyQuestionIds: base.dailyQuestionIds ?? [],
      dailyAttemptedQuestionIds: dailyAttempted,
      dailyCorrectQuestionIds: dailyCorrect,
      totalQuestions: questions.length,
      completed: premium ? dailyAttempted.length >= Math.min(100, questions.length) : dailyAttempted.length >= dailyLimit,
      lastMode: 'practice',
    };
    persist(next);
    setTimeout(() => {
      smoothScrollTo(Math.max(0, explanationY.current - spacing.md));
    }, 180);
    if (!premium && dailyAttempted.length >= dailyLimit) setShowLimit(true);
  };

  const openSubscription = () => {
    setShowLimit(false);
    router.push('/subscription');
  };

  const openEndOfQuestions = () => {
    if (proSubjectActive) setShowWaiting(true);
    else setShowLimit(true);
  };

  const leavePractice = () => {
    setShowLeaveConfirm(false);
    router.back();
  };

  const modeHeader = (
    <SubpageHeader
      title={t('learningModes.practiceTitle')}
      onBackPress={() => setShowLeaveConfirm(true)}
    />
  );

  if (loading) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ gestureEnabled: false }} />
        {modeHeader}
        <PageLoaderOverlay visible label={t('common.loading')} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ gestureEnabled: false }} />
        {modeHeader}
        <DataNotFound title={t('common.somethingWentWrong')} description={t('common.retry')} onRetry={() => void load()} />
        <ConfirmDialog
          visible={showLeaveConfirm}
          title={t('learningModes.exitPracticeTitle')}
          message={t('learningModes.exitPracticeMessage')}
          confirmLabel={t('learningModes.exit')}
          cancelLabel={t('learningModes.keepPracticing')}
          destructive
          onConfirm={leavePractice}
          onCancel={() => setShowLeaveConfirm(false)}
        />
      </View>
    );
  }

  if (questions.length === 0) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ gestureEnabled: false }} />
        {modeHeader}
        <DataNotFound title={t('learning.noQuestions')} description={t('learningModes.noPracticeQuestions')} />
        <ConfirmDialog
          visible={showLeaveConfirm}
          title={t('learningModes.exitPracticeTitle')}
          message={t('learningModes.exitPracticeMessage')}
          confirmLabel={t('learningModes.exit')}
          cancelLabel={t('learningModes.keepPracticing')}
          destructive
          onConfirm={leavePractice}
          onCancel={() => setShowLeaveConfirm(false)}
        />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ gestureEnabled: false }} />
      {modeHeader}

      <ScrollView
        ref={scrollRef}
        onScroll={(event) => { scrollYRef.current = event.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={16}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + spacing.xxl, gap: spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.limitRow, { backgroundColor: colors.surface, borderColor: premium ? colors.success : colors.border, borderRadius: radius.md }]}>
          <View style={{ flex: 1 }}>
            {profilePremium ? (
              <Text variant="caption" weight="bold" style={{ color: colors.success }}>
                {t('learningModes.proAccessActive')}
              </Text>
            ) : (
              <>
                <Text variant="caption" weight="bold" style={{ color: colors.primary }}>
                  {t('learningModes.dailyLimit', { used: dailyUsed, limit: dailyLimit })}
                </Text>
                <Text variant="caption" secondary>{t('learning.dailyReset')}</Text>
              </>
            )}
          </View>
          {profilePremium ? <Ionicons name="checkmark-circle" size={22} color={colors.success} /> : <Ionicons name="speedometer-outline" size={22} color={colors.primary} />}
        </View>

        <View style={styles.questionMetaRow}>
          <View style={[styles.questionBadge, { backgroundColor: `${colors.primary}15` }]}><Text variant="bodySmall" weight="bold" style={{ color: colors.primary }}>Question {current + 1}</Text></View>
          <View style={styles.metaActions}>
            <Pressable onPress={() => showToast(t('learningModes.bookmarkComingSoon'), 'info')} style={styles.actionIcon} accessibilityLabel="Bookmark question"><Ionicons name="bookmark-outline" size={22} color={colors.primary} /></Pressable>
            <Pressable onPress={() => showToast(t('learningModes.reportComingSoon'), 'info')} style={styles.actionIcon} accessibilityLabel="Report question"><Ionicons name="flag-outline" size={22} color={colors.error} /></Pressable>
          </View>
        </View>

        <View style={[styles.questionCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
              <Text variant="h2" weight="semiBold" style={{ lineHeight: 27, fontSize: 20 }}>{bilingual(currentQuestion.text, currentQuestion.textNe)}</Text>
          <View style={[styles.difficulty, { backgroundColor: currentQuestion.difficulty === 'easy' ? `${colors.success}18` : currentQuestion.difficulty === 'medium' ? `${colors.warning}20` : `${colors.error}18` }]}>
            <Text variant="caption" weight="bold" style={{ color: currentQuestion.difficulty === 'easy' ? colors.success : currentQuestion.difficulty === 'medium' ? colors.warning : colors.error }}>{currentQuestion.difficulty.toUpperCase()}</Text>
          </View>
        </View>

        <View style={{ gap: spacing.sm }}>
          {currentQuestion.options.map((option, index) => {
            const isSelected = currentSelected === index;
            const isCorrect = index === currentQuestion.correctIndex;
            const showResult = currentAttempted;
            const background = showResult && isCorrect ? `${colors.success}16` : showResult && isSelected && !isCorrect ? `${colors.error}16` : colors.surface;
            const border = showResult && isCorrect ? colors.success : showResult && isSelected && !isCorrect ? colors.error : isSelected ? colors.primary : colors.border;
            return (
              <Pressable key={index} onPress={() => selectOption(index)} style={[styles.option, { backgroundColor: background, borderColor: border, borderRadius: radius.md }]}>
                <View style={[styles.optionLetter, { borderColor: border, backgroundColor: isSelected || (showResult && isCorrect) ? border : 'transparent' }]}><Text variant="bodySmall" weight="bold" style={{ color: isSelected || (showResult && isCorrect) ? '#FFF' : colors.textSecondary }}>{String.fromCharCode(65 + index)}</Text></View>
                <Text variant="body" style={{ flex: 1, lineHeight: 20, fontSize: 15 }}>{option}</Text>
                {showResult && isCorrect ? <Ionicons name="checkmark-circle" size={22} color={colors.success} /> : showResult && isSelected ? <Ionicons name="close-circle" size={22} color={colors.error} /> : null}
              </Pressable>
            );
          })}
        </View>

        {currentAttempted ? (
          <View onLayout={(event) => { explanationY.current = event.nativeEvent.layout.y; }} style={[styles.explanationCard, { backgroundColor: currentCorrect ? `${colors.success}10` : `${colors.error}09`, borderColor: currentCorrect ? `${colors.success}65` : `${colors.error}65`, borderRadius: radius.lg }]}>
            <View style={styles.explanationHeader}>
              <View style={[styles.resultIcon, { backgroundColor: currentCorrect ? colors.success : colors.error }]}>
                <Ionicons name={currentCorrect ? 'checkmark' : 'close'} size={22} color="#FFF" />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text variant="h3" weight="semiBold" style={{ color: currentCorrect ? colors.success : colors.error }}>{currentCorrect ? t('learningModes.correctAnswer') : t('learningModes.incorrectAnswer')}</Text>
                <Text variant="caption" secondary>{currentCorrect ? t('learningModes.answerConfirmed') : t('learningModes.selectedAnswerIncorrect')}</Text>
              </View>
            </View>
            <View style={[styles.resultDivider, { backgroundColor: currentCorrect ? `${colors.success}35` : `${colors.error}35` }]} />
            {currentSelected !== undefined ? <Text variant="bodySmall" weight="semiBold" style={{ color: currentCorrect ? colors.success : colors.error }}>{t('learningModes.selectedOptionLabel', { option: currentQuestion.options[currentSelected] ?? '' })}</Text> : null}
            {!currentCorrect ? <Text variant="bodySmall" weight="semiBold" style={{ color: colors.success }}>{t('learningModes.correctOptionLabel', { option: currentQuestion.options[currentQuestion.correctIndex] ?? '' })}</Text> : null}
            <Text variant="bodySmall" weight="semiBold">{t('learningModes.answerExplanation')}</Text>
            <Text variant="body" style={{ color: colors.textSecondary, lineHeight: 21, fontSize: 15 }}>{bilingual(currentQuestion.explanation, currentQuestion.explanationNe)}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.divider, paddingBottom: insets.bottom + spacing.sm }]}>
        <Pressable disabled={current === 0} onPress={() => setCurrent((value) => value - 1)} style={[styles.bottomButton, { borderColor: colors.border, borderRadius: radius.md, opacity: current === 0 ? 0.45 : 1 }]}><Ionicons name="arrow-back" size={19} color={colors.primary} /><Text variant="bodySmall" weight="semiBold" style={{ color: colors.primary }}>{t('learningModes.previous')}</Text></Pressable>
        <Pressable disabled={!premium && dailyUsed >= dailyLimit && !currentAttempted} onPress={() => (isLast ? openEndOfQuestions() : setCurrent((value) => value + 1))} style={[styles.nextButton, { backgroundColor: colors.primary, borderRadius: radius.md }]}><Text variant="bodySmall" weight="bold" style={styles.nextButtonLabel}>{isLast ? (proSubjectActive ? t('learningModes.waitingForQuestions') : t('learningModes.dailyLimitReachedTitle')) : t('learningModes.nextQuestion')}</Text><Ionicons name="arrow-forward" size={19} color="#FFF" /></Pressable>
      </View>

      <Modal visible={showLimit} transparent animationType="fade" onRequestClose={() => setShowLimit(false)}>
        <Pressable style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]} onPress={() => setShowLimit(false)}>
          <Pressable onPress={(event) => event.stopPropagation()} style={[styles.limitModal, { backgroundColor: colors.surface, borderRadius: radius.lg }]}>
            <View style={[styles.modalIcon, { backgroundColor: `${colors.warning}18` }]}><Ionicons name="speedometer-outline" size={30} color={colors.warning} /></View>
            <Text variant="h2" weight="semiBold" style={{ textAlign: 'center' }}>{t('learningModes.dailyLimitReachedTitle')}</Text>
            <Text variant="body" secondary style={{ textAlign: 'center' }}>{t('learningModes.dailyLimitReachedMessage')}</Text>
            <Text variant="caption" secondary style={{ textAlign: 'center' }}>{t('learningModes.subscribeToCrackLimit')}</Text>
            <Button label={t('learningModes.subscription')} onPress={openSubscription} />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showWaiting} transparent animationType="fade" onRequestClose={() => setShowWaiting(false)}>
        <Pressable style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]} onPress={() => setShowWaiting(false)}>
          <Pressable onPress={(event) => event.stopPropagation()} style={[styles.limitModal, { backgroundColor: colors.surface, borderRadius: radius.lg }]}>
            <View style={[styles.modalIcon, { backgroundColor: `${colors.success}18` }]}><Ionicons name="checkmark-done-outline" size={30} color={colors.success} /></View>
            <Text variant="h2" weight="semiBold" style={{ textAlign: 'center' }}>{t('learningModes.availableQuestionsCompleteTitle')}</Text>
            <Text variant="body" secondary style={{ textAlign: 'center' }}>{t('learningModes.availableQuestionsCompleteMessage')}</Text>
            <Button label={t('learningModes.waitingForQuestions')} variant="secondary" disabled onPress={() => undefined} />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showLeaveConfirm} transparent animationType="fade" onRequestClose={() => setShowLeaveConfirm(false)}>
        <Pressable style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]} onPress={() => setShowLeaveConfirm(false)}>
          <Pressable onPress={(event) => event.stopPropagation()} style={[styles.leaveModal, { backgroundColor: colors.surface, borderColor: `${colors.warning}55`, borderRadius: radius.lg }]}>
            <View style={styles.leaveTopRow}>
              <View style={[styles.leaveIcon, { backgroundColor: `${colors.warning}18` }]}><Ionicons name="pause-circle-outline" size={29} color={colors.warning} /></View>
              <View style={styles.leaveTitleBlock}>
                <Text variant="h2" weight="semiBold">{t('learningModes.pausePracticeTitle')}</Text>
                <Text variant="bodySmall" secondary>{t('learningModes.pausePracticeMessage')}</Text>
              </View>
            </View>
            <View style={[styles.saveBadge, { backgroundColor: `${colors.success}15`, borderColor: `${colors.success}55` }]}>
              <Ionicons name="cloud-done-outline" size={19} color={colors.success} />
              <Text variant="caption" weight="bold" style={{ color: colors.success }}>{t('learningModes.progressSynced')}</Text>
            </View>
            <View style={styles.leaveActions}>
              <Button label={t('learningModes.keepPracticing')} variant="secondary" onPress={() => setShowLeaveConfirm(false)} />
              <Button label={t('learningModes.leavePractice')} onPress={leavePractice} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { minHeight: 76, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  headerTitle: { color: '#FFF' },
  headerSubtitle: { color: 'rgba(255,255,255,0.78)', marginTop: 2 },
  limitRow: { borderWidth: 1, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  questionMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  questionBadge: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  metaActions: { flexDirection: 'row', gap: 10 },
  actionIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', elevation: 1 },
  questionCard: { borderWidth: 1, padding: 18, gap: 14, elevation: 1 },
  difficulty: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9 },
  option: { minHeight: 66, borderWidth: 1.4, paddingHorizontal: 13, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  optionLetter: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  explanationCard: { borderWidth: 1, padding: 16, gap: 10 },
  explanationHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  resultIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  resultDivider: { height: 1 },
  bottomBar: { borderTopWidth: 1, paddingHorizontal: 14, paddingTop: 10, flexDirection: 'row', gap: 10 },
  bottomButton: { minHeight: 50, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, flex: 0.85 },
  nextButton: { minHeight: 50, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, flex: 1.35 },
  nextButtonLabel: { color: '#FFF', flex: 1, textAlign: 'center', lineHeight: 18, fontSize: 13 },
  historyCard: { borderWidth: 1, padding: 15, gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  historyItem: { borderTopWidth: 1, paddingTop: 11, flexDirection: 'row', gap: 9 },
  statusDot: { width: 9, height: 9, borderRadius: 5, marginTop: 5 },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22 },
  limitModal: { width: '100%', padding: 22, gap: 13, alignItems: 'stretch' },
  modalIcon: { width: 58, height: 58, borderRadius: 29, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  leaveModal: { width: '100%', overflow: 'hidden', borderWidth: 1, elevation: 8 },
  leaveTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 13, padding: 22, paddingBottom: 8 },
  leaveTitleBlock: { flex: 1, gap: 5, paddingTop: 2 },
  leaveIcon: { width: 56, height: 56, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  saveBadge: { marginHorizontal: 22, marginTop: 12, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  leaveActions: { padding: 22, paddingTop: 18, gap: 10 },
});
