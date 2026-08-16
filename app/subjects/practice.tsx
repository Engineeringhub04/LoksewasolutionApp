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
import { fetchLearningQuestions, type LearningQuestion } from '@/src/core/firebase/services/learningContent';
import { fetchLearningProgress, saveLearningProgress, type LearningProgress } from '@/src/core/firebase/services/learningProgress';
import { fetchMyContentPurchases } from '@/src/core/firebase/services/contentPurchases';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { ConfirmDialog } from '@/src/components/feedback/ConfirmDialog';
import { ThemeToggleButton } from '@/src/components/misc/ThemeToggleButton';

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
  }>();
  const { colors, spacing, radius, effective, setMode } = useTheme();
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
  const [showLimit, setShowLimit] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [hasSpecificAccess, setHasSpecificAccess] = useState(false);

  const courseId = valueOf(params.courseId);
  const subcourseId = valueOf(params.subcourseId);
  const subjectId = valueOf(params.subjectId);
  const chapterId = valueOf(params.chapterId);
  const unitId = valueOf(params.unitId) || null;
  const subjectName = valueOf(params.subjectName, subjectId);
  const chapterName = valueOf(params.chapterName, chapterId);
  const profilePremium = isActivePremium(profile);
  const premium = profilePremium || hasSpecificAccess;

  const load = useCallback(async () => {
    if (!user?.uid || !subjectId || !chapterId) return;
    setLoading(true);
    setLoadError(false);
    try {
      const [allQuestions, storedProgress, purchases] = await Promise.all([
        fetchLearningQuestions(courseId, subcourseId, subjectId, chapterId),
        fetchLearningProgress(user.uid, subjectId, chapterId),
        fetchMyContentPurchases(user.uid).catch(() => []),
      ]);
      const specificAccess = purchases.some((purchase) => purchase.status === 'active' && (
        (purchase.contentType === 'chapter' && purchase.contentId === chapterId)
        || (purchase.contentType === 'subject' && purchase.contentId === subjectId)
      ));
      const premiumForLoad = profilePremium || specificAccess;
      const practiceQuestions = allQuestions
        .filter((question) => question.mode === 'practice' && question.isPublished)
        .slice(0, premiumForLoad ? 100 : undefined);
      setHasSpecificAccess(specificAccess);
      const today = dayKey();
      const nextProgress: LearningProgress = storedProgress
        ? storedProgress.dailyDate === today
          ? storedProgress
          : { ...storedProgress, dailyDate: today, dailyQuestionIds: [], dailyAttemptedQuestionIds: [], dailyCorrectQuestionIds: [] }
        : {
            id: `${subjectId}__${chapterId}`,
            subjectId,
            unitId,
            chapterId,
            attemptedQuestionIds: [],
            correctQuestionIds: [],
            bookmarked: false,
            completed: false,
            lastMode: 'practice',
            dailyDate: today,
            dailyQuestionIds: [],
            dailyAttemptedQuestionIds: [],
            dailyCorrectQuestionIds: [],
          };
      setQuestions(practiceQuestions);
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
    return () => subscription.remove();
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
  const historyQuestions = useMemo(
    () => questions.filter((question) => dailyAttemptedIds.includes(question.id)),
    [dailyAttemptedIds, questions],
  );

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
    });
  };

  const selectOption = (optionIndex: number) => {
    if (!currentQuestion) return;
    if (!premium && dailyUsed >= dailyLimit && !currentAttempted) {
      setShowLimit(true);
      return;
    }
    setSelectedAnswers((previous) => ({ ...previous, [currentQuestion.id]: optionIndex }));
    if (currentAttempted) return;
    const base = progressRef.current;
    if (!base) return;
    const isCorrect = optionIndex === currentQuestion.correctIndex;
    const attempted = Array.from(new Set([...base.attemptedQuestionIds, currentQuestion.id]));
    const correct = isCorrect ? Array.from(new Set([...base.correctQuestionIds, currentQuestion.id])) : base.correctQuestionIds;
    const dailyAttempted = Array.from(new Set([...(base.dailyAttemptedQuestionIds ?? []), currentQuestion.id]));
    const dailyCorrect = isCorrect ? Array.from(new Set([...(base.dailyCorrectQuestionIds ?? []), currentQuestion.id])) : (base.dailyCorrectQuestionIds ?? []);
    const next: LearningProgress = {
      ...base,
      attemptedQuestionIds: attempted,
      correctQuestionIds: correct,
      dailyDate: dayKey(),
      dailyQuestionIds: base.dailyQuestionIds ?? [],
      dailyAttemptedQuestionIds: dailyAttempted,
      dailyCorrectQuestionIds: dailyCorrect,
      completed: premium ? dailyAttempted.length >= Math.min(100, questions.length) : dailyAttempted.length >= dailyLimit,
      lastMode: 'practice',
    };
    persist(next);
    if (!premium && dailyAttempted.length >= dailyLimit) setShowLimit(true);
  };

  const openSubscription = () => {
    setShowLimit(false);
    router.push('/subscription');
  };

  const leavePractice = () => {
    setShowLeaveConfirm(false);
    router.back();
  };

  if (loading) {
    return <PageLoaderOverlay visible label={t('common.loading')} />;
  }

  if (loadError) {
    return <DataNotFound title={t('common.somethingWentWrong')} description={t('common.retry')} onRetry={() => void load()} />;
  }

  if (questions.length === 0) {
    return <DataNotFound title={t('learning.noQuestions')} description={t('learningModes.noPracticeQuestions')} onRetry={() => router.back()} />;
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => setShowLeaveConfirm(true)} style={styles.headerIcon} accessibilityLabel={t('common.back')}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </Pressable>
        <View style={styles.headerText}>
          <Text variant="bodyLarge" weight="bold" style={styles.headerTitle} numberOfLines={1}>{t('learningModes.practiceTitle')}</Text>
          <Text variant="caption" style={styles.headerSubtitle} numberOfLines={1}>{chapterName} · {subjectName}</Text>
        </View>
        <ThemeToggleButton isDark={effective === 'dark'} onToggle={() => setMode(effective === 'dark' ? 'light' : 'dark')} size={34} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + spacing.xxl, gap: spacing.md }} showsVerticalScrollIndicator={false}>
        <View style={[styles.limitRow, { backgroundColor: colors.surface, borderColor: premium ? colors.success : colors.border, borderRadius: radius.md }]}>
          <View style={{ flex: 1 }}>
            <Text variant="caption" weight="bold" style={{ color: premium ? colors.success : colors.primary, textDecorationLine: premium ? 'line-through' : 'none' }}>
              {t('learningModes.dailyLimit', { used: dailyUsed, limit: premium ? 100 : dailyLimit })}
            </Text>
            {premium ? <Text variant="caption" secondary>Pro access active · up to 100 questions</Text> : <Text variant="caption" secondary>{t('learning.dailyReset')}</Text>}
          </View>
          {premium ? <Ionicons name="checkmark-circle" size={22} color={colors.success} /> : <Ionicons name="speedometer-outline" size={22} color={colors.primary} />}
        </View>

        {showHistory ? (
          <View style={[styles.historyCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: `${colors.primary}15` }]}><Ionicons name="time-outline" size={20} color={colors.primary} /></View>
              <Text variant="h3" weight="semiBold" style={{ flex: 1 }}>{t('learningModes.questionHistory')}</Text>
              <Text variant="caption" weight="bold" style={{ color: colors.primary }}>{historyQuestions.length}</Text>
            </View>
            {historyQuestions.map((question) => {
              const isCorrect = dailyCorrectIds.includes(question.id);
              return (
                <View key={question.id} style={[styles.historyItem, { borderTopColor: colors.divider }]}>
                  <View style={[styles.statusDot, { backgroundColor: isCorrect ? colors.success : colors.error }]} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text variant="bodySmall" weight="semiBold">{bilingual(question.text, question.textNe)}</Text>
                    <Text variant="caption" style={{ color: isCorrect ? colors.success : colors.error }}>{isCorrect ? t('learningModes.correct') : t('learningModes.incorrect')}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={styles.questionMetaRow}>
          <View style={[styles.questionBadge, { backgroundColor: `${colors.primary}15` }]}><Text variant="bodySmall" weight="bold" style={{ color: colors.primary }}>Question {current + 1}</Text></View>
          <View style={styles.metaActions}>
            <Pressable onPress={() => showToast(t('learningModes.bookmarkComingSoon'), 'info')} style={styles.actionIcon} accessibilityLabel="Bookmark question"><Ionicons name="bookmark-outline" size={22} color={colors.primary} /></Pressable>
            <Pressable onPress={() => showToast(t('learningModes.reportComingSoon'), 'info')} style={styles.actionIcon} accessibilityLabel="Report question"><Ionicons name="flag-outline" size={22} color={colors.error} /></Pressable>
          </View>
        </View>

        <View style={[styles.questionCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
          <Text variant="h2" weight="semiBold" style={{ lineHeight: 31 }}>{bilingual(currentQuestion.text, currentQuestion.textNe)}</Text>
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
                <Text variant="body" style={{ flex: 1, lineHeight: 23 }}>{bilingual(option, currentQuestion.optionsNe[index] ?? '')}</Text>
                {showResult && isCorrect ? <Ionicons name="checkmark-circle" size={22} color={colors.success} /> : showResult && isSelected ? <Ionicons name="close-circle" size={22} color={colors.error} /> : null}
              </Pressable>
            );
          })}
        </View>

        {currentAttempted ? (
          <View style={[styles.explanationCard, { backgroundColor: currentCorrect ? `${colors.success}12` : `${colors.error}10`, borderColor: currentCorrect ? `${colors.success}55` : `${colors.error}55`, borderRadius: radius.lg }]}>
            <View style={styles.explanationHeader}><Ionicons name={currentCorrect ? 'checkmark-circle' : 'close-circle'} size={27} color={currentCorrect ? colors.success : colors.error} /><Text variant="h3" weight="semiBold" style={{ color: currentCorrect ? colors.success : colors.error }}>{currentCorrect ? t('learningModes.correct') : t('learningModes.incorrect')}</Text></View>
            <Text variant="bodySmall" weight="semiBold">{t('learningModes.answerExplanation')}</Text>
            <Text variant="body" style={{ color: colors.textSecondary, lineHeight: 24 }}>{bilingual(currentQuestion.explanation, currentQuestion.explanationNe)}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.divider, paddingBottom: insets.bottom + spacing.sm }]}>
        <Pressable disabled={current === 0} onPress={() => setCurrent((value) => value - 1)} style={[styles.bottomButton, { borderColor: colors.border, borderRadius: radius.md, opacity: current === 0 ? 0.45 : 1 }]}><Ionicons name="arrow-back" size={19} color={colors.primary} /><Text variant="bodySmall" weight="semiBold" style={{ color: colors.primary }}>{t('learningModes.previous')}</Text></Pressable>
        <Pressable disabled={!premium && dailyUsed >= dailyLimit && !currentAttempted} onPress={() => (isLast ? setShowLimit(true) : setCurrent((value) => value + 1))} style={[styles.nextButton, { backgroundColor: colors.primary, borderRadius: radius.md }]}><Text variant="bodySmall" weight="bold" style={{ color: '#FFF' }}>{isLast ? t('learningModes.dailyLimitReachedTitle') : t('learningModes.nextQuestion')}</Text><Ionicons name="arrow-forward" size={19} color="#FFF" /></Pressable>
      </View>

      <Modal visible={showLimit} transparent animationType="fade" onRequestClose={() => setShowLimit(false)}>
        <Pressable style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]} onPress={() => setShowLimit(false)}>
          <Pressable onPress={(event) => event.stopPropagation()} style={[styles.limitModal, { backgroundColor: colors.surface, borderRadius: radius.lg }]}>
            <View style={[styles.modalIcon, { backgroundColor: `${colors.warning}18` }]}><Ionicons name="speedometer-outline" size={30} color={colors.warning} /></View>
            <Text variant="h2" weight="semiBold" style={{ textAlign: 'center' }}>{t('learningModes.dailyLimitReachedTitle')}</Text>
            <Text variant="body" secondary style={{ textAlign: 'center' }}>{t('learningModes.dailyLimitReachedMessage')}</Text>
            <Button label={t('learningModes.viewMyHistory')} variant="secondary" onPress={() => { setShowLimit(false); setShowHistory(true); }} />
            <Text variant="caption" secondary style={{ textAlign: 'center' }}>{t('learningModes.subscribeToCrackLimit')}</Text>
            <Button label={t('learningModes.subscription')} onPress={openSubscription} />
          </Pressable>
        </Pressable>
      </Modal>

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
  explanationHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bottomBar: { borderTopWidth: 1, paddingHorizontal: 14, paddingTop: 10, flexDirection: 'row', gap: 10 },
  bottomButton: { minHeight: 50, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, flex: 0.85 },
  nextButton: { minHeight: 50, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, flex: 1.35 },
  historyCard: { borderWidth: 1, padding: 15, gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  historyItem: { borderTopWidth: 1, paddingTop: 11, flexDirection: 'row', gap: 9 },
  statusDot: { width: 9, height: 9, borderRadius: 5, marginTop: 5 },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22 },
  limitModal: { width: '100%', padding: 22, gap: 13, alignItems: 'stretch' },
  modalIcon: { width: 58, height: 58, borderRadius: 29, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
});
