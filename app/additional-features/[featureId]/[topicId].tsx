import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/src/components/buttons/Button';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';
import { Text } from '@/src/components/misc/Text';
import { getAdditionalFeaturePracticeProgress, loadAdditionalFeatureQuestionBank, saveAdditionalFeaturePracticeProgress, type AdditionalFeatureId, type AdditionalFeaturePracticeProgress, type AdditionalFeatureQuestion } from '@/src/core/services/additionalFeatures';
import { showToast } from '@/src/core/store/toastStore';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';

const DAILY_LIMIT = 50;

type Track = 'read' | 'practice';

type ModeLabels = {
  read: string;
  practice: string;
  important: string;
  showAnswer: string;
  hideAnswer: string;
  answer: string;
  explanation: string;
  correct: string;
  incorrect: string;
  previous: string;
  next: string;
  finish: string;
  question: string;
  todayPractice: string;
  dailyReset: string;
  dailyLimitTitle: string;
  dailyLimitMessage: string;
  exitTitle: string;
  exitMessage: string;
  keepPracticing: string;
  leavePractice: string;
  progressSaved: string;
  retry: string;
};

function valueOf(value: string | string[] | undefined, fallback = ''): string {
  return Array.isArray(value) ? value[0] ?? fallback : value ?? fallback;
}

function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}

function correctOptionId(question: AdditionalFeatureQuestion): string | undefined {
  if (question.correctOptionId && question.options.some((option) => option.id === question.correctOptionId)) return question.correctOptionId;
  const rawIndex = Number(question.correctOption);
  if (!Number.isFinite(rawIndex)) return undefined;
  if (rawIndex >= 1 && rawIndex <= question.options.length) return question.options[rawIndex - 1]?.id;
  return question.options[Math.max(0, Math.min(rawIndex, question.options.length - 1))]?.id;
}

function correctIndex(question: AdditionalFeatureQuestion): number {
  const optionId = correctOptionId(question);
  const mappedIndex = optionId ? question.options.findIndex((option) => option.id === optionId) : -1;
  if (mappedIndex >= 0) return mappedIndex;
  return Math.max(0, Math.min(Number(question.correctOption) || 0, question.options.length - 1));
}

function shufflePracticeQuestion(question: AdditionalFeatureQuestion): AdditionalFeatureQuestion {
  const answerId = correctOptionId(question);
  const options = shuffle(question.options);
  const shuffledCorrectIndex = answerId ? options.findIndex((option) => option.id === answerId) : -1;
  return {
    ...question,
    options,
    correctOptionId: answerId,
    // Keep the serialized field 1-based for compatibility with the seeded schema.
    correctOption: shuffledCorrectIndex >= 0 ? shuffledCorrectIndex + 1 : 1,
  };
}

function difficultyColor(difficulty: string, colors: ReturnType<typeof useTheme>['colors']): string {
  if (difficulty === 'easy') return colors.success;
  if (difficulty === 'hard') return colors.error;
  return colors.warning;
}

function QuestionHeader({ question, index, colors }: { question: AdditionalFeatureQuestion; index: number; colors: ReturnType<typeof useTheme>['colors'] }) {
  const difficulty = question.difficulty ? `${question.difficulty[0].toUpperCase()}${question.difficulty.slice(1)}` : 'Question';
  const color = difficultyColor(question.difficulty, colors);
  return (
    <View style={styles.questionTopRow}>
      <View style={[styles.numberBadge, { backgroundColor: `${colors.primary}15` }]}><Text variant="bodySmall" weight="bold" style={{ color: colors.primary }}>Qn. {index + 1}</Text></View>
      <View style={[styles.difficultyBadge, { backgroundColor: `${color}18` }]}><Text variant="caption" weight="bold" style={{ color }}>{difficulty}</Text></View>
      <View style={{ flex: 1 }} />
      <Pressable onPress={() => showToast('Bookmark will be available soon.', 'info')} style={styles.smallAction} accessibilityLabel="Bookmark question"><Ionicons name="bookmark-outline" size={21} color={colors.primary} /></Pressable>
      <Pressable onPress={() => showToast('Report will be available soon.', 'info')} style={styles.smallAction} accessibilityLabel="Report question"><Ionicons name="flag-outline" size={21} color={colors.error} /></Pressable>
    </View>
  );
}

export default function AdditionalFeatureTopicScreen() {
  const params = useLocalSearchParams<{ featureId?: string; topicId?: string; topicTitleEn?: string; topicTitleNp?: string; questionBankId?: string }>();
  const { colors, spacing, radius } = useTheme();
  const { language } = useTranslation();
  const insets = useSafeAreaInsets();
  const featureId = valueOf(params.featureId) as AdditionalFeatureId;
  const topicId = valueOf(params.topicId);
  const topicTitleEn = valueOf(params.topicTitleEn, topicId);
  const topicTitleNp = valueOf(params.topicTitleNp, topicTitleEn);
  const questionBankId = valueOf(params.questionBankId);
  const topicTitle = language === 'ne' ? topicTitleNp : topicTitleEn;
  const alternateTitle = language === 'ne' ? topicTitleEn : topicTitleNp;

  const [questions, setQuestions] = useState<AdditionalFeatureQuestion[]>([]);
  const [progress, setProgress] = useState<AdditionalFeaturePracticeProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [track, setTrack] = useState<Track>('read');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [current, setCurrent] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [showLimit, setShowLimit] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const scrollYRef = useRef(0);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const explanationY = useRef(0);

  const labels: ModeLabels = language === 'ne' ? {
    read: 'पढ्नुहोस्',
    practice: 'अभ्यास',
    important: 'महत्त्वपूर्ण प्रश्नहरू',
    showAnswer: 'उत्तर हेर्नुहोस्',
    hideAnswer: 'उत्तर लुकाउनुहोस्',
    answer: 'उत्तर',
    explanation: 'व्याख्या',
    correct: 'सही उत्तर',
    incorrect: 'गलत उत्तर',
    previous: 'अघिल्लो',
    next: 'अर्को',
    finish: 'अभ्यास पूरा भयो',
    question: 'प्रश्न',
    todayPractice: 'आजको अभ्यास',
    dailyReset: 'दैनिक सीमा अर्को दिन फेरि खुल्नेछ।',
    dailyLimitTitle: 'आजको अभ्यास सीमा पूरा भयो',
    dailyLimitMessage: 'आजका प्रश्नहरूको अभ्यास पूरा भयो। कृपया अर्को दिन आएर फेरि अभ्यास गर्नुहोस्।',
    exitTitle: 'अभ्यास रोक्ने हो?',
    exitMessage: 'तपाईंको प्रगति यस फोनको क्यासमा सुरक्षित हुनेछ। पछि यही topic बाट अभ्यास जारी राख्न सक्नुहुन्छ।',
    keepPracticing: 'अभ्यास जारी राख्नुहोस्',
    leavePractice: 'बाहिर निस्कनुहोस्',
    progressSaved: 'फोनको क्यासमा सुरक्षित भयो',
    retry: 'फेरि प्रयास गर्नुहोस्',
  } : {
    read: 'Read',
    practice: 'Practice',
    important: 'Important Questions',
    showAnswer: 'Show answer',
    hideAnswer: 'Hide answer',
    answer: 'Answer',
    explanation: 'Explanation',
    correct: 'Correct answer',
    incorrect: 'Incorrect answer',
    previous: 'Previous',
    next: 'Next',
    finish: 'Practice complete',
    question: 'Question',
    todayPractice: "Today's practice",
    dailyReset: 'The daily limit will reset on the next day.',
    dailyLimitTitle: 'Today’s practice limit is complete',
    dailyLimitMessage: 'You have completed today’s available practice. Please come back tomorrow and practice again.',
    exitTitle: 'Leave this practice?',
    exitMessage: 'Your progress will be saved in this phone’s cache. You can continue this topic later.',
    keepPracticing: 'Keep practising',
    leavePractice: 'Leave practice',
    progressSaved: 'Saved to phone cache',
    retry: 'Try again',
  };

  const load = useCallback(async () => {
    if (!featureId || !topicId) {
      setLoading(false);
      setLoadError(true);
      return;
    }
    setLoading(true);
    setLoadError(false);
    try {
      const [result, storedProgress] = await Promise.all([
        loadAdditionalFeatureQuestionBank(featureId, topicId, questionBankId),
        getAdditionalFeaturePracticeProgress(featureId, topicId),
      ]);
      const source = [...(result.bank?.questions ?? [])].sort((a, b) => a.order - b.order);
      setQuestions(source);
      setProgress(storedProgress);
      setExpanded({});
      setSelectedAnswers({});
      setCurrent(0);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [featureId, questionBankId, topicId]);

  useEffect(() => {
    void load();
    return () => {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, [load]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (track === 'practice') setShowLeaveConfirm(true);
      else router.back();
      return true;
    });
    return () => subscription.remove();
  }, [track]);

  const practiceQuestions = useMemo(() => shuffle(questions).map(shufflePracticeQuestion), [questions]);
  const activeQuestions = track === 'read' ? questions : practiceQuestions;
  const currentQuestion = activeQuestions[current];

  useEffect(() => {
    if (!progress || practiceQuestions.length === 0) return;
    const restored: Record<string, number> = {};
    practiceQuestions.forEach((question) => {
      const optionId = progress.selectedAnswerIds[question.questionId];
      if (optionId) {
        const optionIndex = question.options.findIndex((option) => option.id === optionId);
        if (optionIndex >= 0) restored[question.questionId] = optionIndex;
      }
    });
    setSelectedAnswers(restored);
  }, [practiceQuestions, progress]);

  const selected = currentQuestion ? selectedAnswers[currentQuestion.questionId] : undefined;
  const hasAnswered = selected !== undefined;
  const dailyLimit = Math.min(activeQuestions.length, DAILY_LIMIT);
  const dailyUsed = progress?.attemptedQuestionIds.length ?? 0;
  const currentAttempted = currentQuestion ? progress?.attemptedQuestionIds.includes(currentQuestion.questionId) === true : false;
  const currentCorrect = currentQuestion ? progress?.correctQuestionIds.includes(currentQuestion.questionId) === true : false;
  const allExpanded = questions.length > 0 && questions.every((question) => expanded[question.questionId]);
  const isLast = current === activeQuestions.length - 1;

  const persist = (next: AdditionalFeaturePracticeProgress) => {
    setProgress(next);
    void saveAdditionalFeaturePracticeProgress(next);
  };

  const smoothScrollTo = (targetY: number) => {
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    const startY = scrollYRef.current;
    const distance = targetY - startY;
    const duration = 600;
    const startedAt = Date.now();
    const tick = () => {
      const progressValue = Math.min(1, (Date.now() - startedAt) / duration);
      const eased = progressValue < 0.5 ? 2 * progressValue * progressValue : 1 - ((-2 * progressValue + 2) ** 2) / 2;
      const nextY = startY + distance * eased;
      scrollYRef.current = nextY;
      scrollRef.current?.scrollTo({ y: nextY, animated: false });
      if (progressValue < 1) scrollTimerRef.current = setTimeout(tick, 16);
      else scrollTimerRef.current = null;
    };
    tick();
  };

  const selectPracticeOption = (optionIndex: number) => {
    if (!currentQuestion || hasAnswered || currentAttempted) return;
    if (dailyUsed >= dailyLimit) {
      setShowLimit(true);
      return;
    }
    const optionId = currentQuestion.options[optionIndex]?.id;
    if (!optionId || !progress) return;
    const answerIsCorrect = optionIndex === correctIndex(currentQuestion);
    const attemptedQuestionIds = Array.from(new Set([...progress.attemptedQuestionIds, currentQuestion.questionId]));
    const correctQuestionIds = answerIsCorrect
      ? Array.from(new Set([...progress.correctQuestionIds, currentQuestion.questionId]))
      : progress.correctQuestionIds;
    const next: AdditionalFeaturePracticeProgress = {
      ...progress,
      attemptedQuestionIds,
      correctQuestionIds,
      selectedAnswerIndexes: { ...progress.selectedAnswerIndexes, [currentQuestion.questionId]: optionIndex },
      selectedAnswerIds: { ...progress.selectedAnswerIds, [currentQuestion.questionId]: optionId },
    };
    setSelectedAnswers((previous) => ({ ...previous, [currentQuestion.questionId]: optionIndex }));
    persist(next);
    setTimeout(() => smoothScrollTo(Math.max(0, explanationY.current - spacing.md)), 180);
    if (attemptedQuestionIds.length >= dailyLimit) setShowLimit(true);
  };

  const handlePracticeNext = () => {
    if (isLast) {
      if (dailyUsed >= dailyLimit) setShowLimit(true);
      else showToast(labels.finish, 'success');
      return;
    }
    setCurrent((value) => Math.min(activeQuestions.length - 1, value + 1));
  };

  const changeTrack = (nextTrack: Track) => {
    setTrack(nextTrack);
    setCurrent(0);
    setExpanded({});
  };

  const leavePractice = () => {
    setShowLeaveConfirm(false);
    router.back();
  };

  const modeHeader = <SubpageHeader title={topicTitle} onBackPress={() => (track === 'practice' ? setShowLeaveConfirm(true) : router.back())} />;

  if (loading) {
    return <View style={[styles.screen, { backgroundColor: colors.background }]}><Stack.Screen options={{ gestureEnabled: false }} />{modeHeader}<PageLoaderOverlay visible label={language === 'ne' ? 'प्रश्नहरू लोड हुँदैछन्...' : 'Loading questions...'} /></View>;
  }

  if (loadError) {
    return <View style={[styles.screen, { backgroundColor: colors.background }]}><Stack.Screen options={{ gestureEnabled: false }} />{modeHeader}<DataNotFound title={language === 'ne' ? 'प्रश्नहरू लोड गर्न सकिएन।' : 'Unable to load questions.'} description={labels.retry} onRetry={() => void load()} /><LeaveConfirmation visible={showLeaveConfirm} labels={labels} colors={colors} radius={radius} onCancel={() => setShowLeaveConfirm(false)} onConfirm={leavePractice} /></View>;
  }

  if (questions.length === 0) {
    return <View style={[styles.screen, { backgroundColor: colors.background }]}><Stack.Screen options={{ gestureEnabled: false }} />{modeHeader}<DataNotFound title={language === 'ne' ? 'यस विषयका प्रश्नहरू उपलब्ध छैनन्।' : 'No questions are available for this topic.'} description="" /><LeaveConfirmation visible={showLeaveConfirm} labels={labels} colors={colors} radius={radius} onCancel={() => setShowLeaveConfirm(false)} onConfirm={leavePractice} /></View>;
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ gestureEnabled: false }} />
      {modeHeader}
      <View style={[styles.topicSubtitle, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}><Text variant="caption" secondary numberOfLines={1}>{alternateTitle}</Text></View>
      <View style={[styles.trackBar, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, margin: spacing.md }]}>
        {(['read', 'practice'] as const).map((item) => {
          const active = track === item;
          return <Pressable key={item} onPress={() => changeTrack(item)} style={[styles.trackButton, active ? { backgroundColor: colors.primary } : null]} accessibilityRole="button"><Ionicons name={item === 'read' ? 'book-outline' : 'checkmark-done-outline'} size={17} color={active ? '#FFF' : colors.textSecondary} /><Text variant="bodySmall" weight="bold" style={{ color: active ? '#FFF' : colors.textSecondary }}>{labels[item]}</Text></Pressable>;
        })}
      </View>

      {track === 'read' ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md }} showsVerticalScrollIndicator={false}>
          <View style={[styles.sectionHeader, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
            <View style={[styles.sectionIcon, { backgroundColor: `${colors.primary}15` }]}><Ionicons name="bookmark" size={22} color={colors.primary} /></View>
            <View style={styles.sectionTitle}><Text variant="h3" weight="semiBold" style={{ lineHeight: 23 }}>{labels.important}</Text><Text variant="caption" secondary>{topicTitle}</Text></View>
            <Pressable onPress={() => setExpanded(allExpanded ? {} : Object.fromEntries(questions.map((question) => [question.questionId, true])))} style={styles.expandButton}><Ionicons name={allExpanded ? 'chevron-up-outline' : 'chevron-down-outline'} size={19} color={colors.primary} /><Text variant="caption" weight="bold" style={{ color: colors.primary }}>{allExpanded ? labels.hideAnswer : labels.showAnswer}</Text></Pressable>
          </View>
          {questions.map((question, index) => <ReadQuestion key={question.questionId} question={question} index={index} isOpen={expanded[question.questionId] === true} onToggle={() => setExpanded((previous) => ({ ...previous, [question.questionId]: !previous[question.questionId] }))} labels={labels} colors={colors} spacing={spacing} radius={radius} />)}
        </ScrollView>
      ) : (
        <ScrollView ref={scrollRef} onScroll={(event) => { scrollYRef.current = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={16} contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + spacing.xxl, gap: spacing.md }} showsVerticalScrollIndicator={false}>
          <View style={[styles.limitRow, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md }]}>
            <View style={{ flex: 1 }}><Text variant="caption" weight="bold" style={{ color: colors.primary }}>{labels.todayPractice}: {dailyUsed}/{dailyLimit}</Text><Text variant="caption" secondary>{labels.dailyReset}</Text></View>
            <Ionicons name="speedometer-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.questionMetaRow}><View style={[styles.questionBadge, { backgroundColor: `${colors.primary}15` }]}><Text variant="bodySmall" weight="bold" style={{ color: colors.primary }}>{labels.question} {current + 1}</Text></View><View style={styles.metaActions}><Pressable onPress={() => showToast('Bookmark will be available soon.', 'info')} style={styles.actionIcon} accessibilityLabel="Bookmark question"><Ionicons name="bookmark-outline" size={22} color={colors.primary} /></Pressable><Pressable onPress={() => showToast('Report will be available soon.', 'info')} style={styles.actionIcon} accessibilityLabel="Report question"><Ionicons name="flag-outline" size={22} color={colors.error} /></Pressable></View></View>
          <PracticeQuestion question={currentQuestion} index={current} total={activeQuestions.length} selected={selected} attempted={currentAttempted} correct={currentCorrect} labels={labels} colors={colors} spacing={spacing} radius={radius} explanationY={explanationY} onSelect={selectPracticeOption} onPrevious={() => setCurrent((value) => Math.max(0, value - 1))} onNext={handlePracticeNext} nextDisabled={!currentAttempted && dailyUsed >= dailyLimit} />
        </ScrollView>
      )}

      <LimitModal visible={showLimit} labels={labels} colors={colors} radius={radius} onClose={() => setShowLimit(false)} />
      <LeaveConfirmation visible={showLeaveConfirm} labels={labels} colors={colors} radius={radius} onCancel={() => setShowLeaveConfirm(false)} onConfirm={leavePractice} />
    </View>
  );
}

type ThemeColors = ReturnType<typeof useTheme>['colors'];
type ThemeSpacing = ReturnType<typeof useTheme>['spacing'];
type ThemeRadius = ReturnType<typeof useTheme>['radius'];

function ReadQuestion({ question, index, isOpen, onToggle, labels, colors, spacing, radius }: { question: AdditionalFeatureQuestion; index: number; isOpen: boolean; onToggle: () => void; labels: ModeLabels; colors: ThemeColors; spacing: ThemeSpacing; radius: ThemeRadius }) {
  return <View style={[styles.questionCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}><QuestionHeader question={question} index={index} colors={colors} /><Text variant="h3" weight="semiBold" style={{ lineHeight: 24, fontSize: 18 }}>{question.question}</Text><Pressable onPress={onToggle} style={styles.answerToggle}><Ionicons name={isOpen ? 'chevron-up-circle-outline' : 'chevron-down-circle-outline'} size={24} color={colors.primary} /><Text variant="bodySmall" weight="semiBold" style={{ color: colors.primary }}>{isOpen ? labels.hideAnswer : labels.showAnswer}</Text></Pressable>{isOpen ? <AnswerDetails question={question} labels={labels} colors={colors} spacing={spacing} radius={radius} /> : null}</View>;
}

function AnswerDetails({ question, labels, colors, spacing, radius }: { question: AdditionalFeatureQuestion; labels: ModeLabels; colors: ThemeColors; spacing: ThemeSpacing; radius: ThemeRadius }) {
  return <View style={{ gap: spacing.sm }}>{question.options.map((option, optionIndex) => { const correct = optionIndex === correctIndex(question); return <View key={option.id || optionIndex} style={[styles.readOption, { backgroundColor: correct ? `${colors.success}12` : colors.surface, borderColor: correct ? `${colors.success}80` : colors.border, borderRadius: radius.md }]}><View style={[styles.optionBullet, { borderColor: correct ? colors.success : colors.border, backgroundColor: correct ? colors.success : 'transparent' }]}><Text variant="caption" weight="bold" style={{ color: correct ? '#FFF' : colors.textSecondary }}>{String.fromCharCode(65 + optionIndex)}</Text></View><Text variant="bodySmall" style={{ flex: 1, lineHeight: 19, fontSize: 14 }}>{option.text}</Text>{correct ? <Ionicons name="checkmark-circle" size={20} color={colors.success} /> : null}</View>; })}<View style={[styles.explanationCard, { backgroundColor: `${colors.warning}12`, borderColor: `${colors.warning}55`, borderRadius: radius.md }]}><View style={styles.explanationTitle}><Ionicons name="bulb-outline" size={22} color={colors.warning} /><Text variant="bodyLarge" weight="bold" style={{ color: colors.warning }}>{labels.explanation}</Text></View><Text variant="bodySmall" style={{ lineHeight: 20, fontSize: 14 }}>{question.explanation}</Text></View></View>;
}

function PracticeQuestion({ question, index, total, selected, attempted, correct, labels, colors, spacing, radius, explanationY, onSelect, onPrevious, onNext, nextDisabled }: { question: AdditionalFeatureQuestion | undefined; index: number; total: number; selected?: number; attempted: boolean; correct: boolean; labels: ModeLabels; colors: ThemeColors; spacing: ThemeSpacing; radius: ThemeRadius; explanationY: { current: number }; onSelect: (optionIndex: number) => void; onPrevious: () => void; onNext: () => void; nextDisabled: boolean }) {
  if (!question) return null;
  const answer = correctIndex(question);
  return <View><View style={[styles.practiceProgress, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md }]}><Text variant="caption" weight="bold" style={{ color: colors.primary }}>{labels.question.toUpperCase()} {index + 1} OF {total}</Text><View style={[styles.progressTrack, { backgroundColor: colors.border }]}><View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${((index + 1) / total) * 100}%` }]} /></View></View><View style={[styles.questionCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, marginTop: spacing.md }]}><QuestionHeader question={question} index={index} colors={colors} /><Text variant="h2" weight="semiBold" style={{ lineHeight: 27, fontSize: 20 }}>{question.question}</Text><View style={[styles.difficulty, { backgroundColor: question.difficulty === 'easy' ? `${colors.success}18` : question.difficulty === 'medium' ? `${colors.warning}20` : `${colors.error}18` }]}><Text variant="caption" weight="bold" style={{ color: question.difficulty === 'easy' ? colors.success : question.difficulty === 'medium' ? colors.warning : colors.error }}>{question.difficulty.toUpperCase()}</Text></View></View><View style={{ gap: spacing.sm, marginTop: spacing.md }}>{question.options.map((option, optionIndex) => { const isSelected = selected === optionIndex; const isCorrect = optionIndex === answer; const background = attempted && isCorrect ? `${colors.success}16` : attempted && isSelected && !isCorrect ? `${colors.error}16` : colors.surface; const border = attempted && isCorrect ? colors.success : attempted && isSelected && !isCorrect ? colors.error : isSelected ? colors.primary : colors.border; return <Pressable key={option.id || optionIndex} onPress={() => onSelect(optionIndex)} disabled={attempted || nextDisabled} style={[styles.option, { backgroundColor: background, borderColor: border, borderRadius: radius.md }]}><View style={[styles.optionLetter, { borderColor: border, backgroundColor: isSelected || (attempted && isCorrect) ? border : 'transparent' }]}><Text variant="bodySmall" weight="bold" style={{ color: isSelected || (attempted && isCorrect) ? '#FFF' : colors.textSecondary }}>{String.fromCharCode(65 + optionIndex)}</Text></View><Text variant="body" style={{ flex: 1, lineHeight: 20, fontSize: 15 }}>{option.text}</Text>{attempted && isCorrect ? <Ionicons name="checkmark-circle" size={22} color={colors.success} /> : attempted && isSelected ? <Ionicons name="close-circle" size={22} color={colors.error} /> : null}</Pressable>; })}</View>{attempted ? <View onLayout={(event) => { explanationY.current = event.nativeEvent.layout.y; }} style={[styles.explanationCard, { backgroundColor: correct ? `${colors.success}10` : `${colors.error}09`, borderColor: correct ? `${colors.success}65` : `${colors.error}65`, borderRadius: radius.lg, marginTop: spacing.md }]}><View style={styles.explanationHeader}><View style={[styles.resultIcon, { backgroundColor: correct ? colors.success : colors.error }]}><Ionicons name={correct ? 'checkmark' : 'close'} size={22} color="#FFF" /></View><View style={{ flex: 1, gap: 3 }}><Text variant="h3" weight="semiBold" style={{ color: correct ? colors.success : colors.error }}>{correct ? labels.correct : labels.incorrect}</Text><Text variant="caption" secondary>{correct ? 'Answer recorded' : 'Please review the correct answer below'}</Text></View></View><View style={[styles.resultDivider, { backgroundColor: correct ? `${colors.success}35` : `${colors.error}35` }]} />{selected !== undefined ? <Text variant="bodySmall" weight="semiBold" style={{ color: correct ? colors.success : colors.error }}>{labels.answer}: {String.fromCharCode(65 + selected)}</Text> : null}{!correct ? <Text variant="bodySmall" weight="semiBold" style={{ color: colors.success }}>{labels.correct}: {String.fromCharCode(65 + answer)}</Text> : null}<Text variant="bodySmall" weight="bold">{labels.explanation}</Text><Text variant="body" style={{ color: colors.textSecondary, lineHeight: 21, fontSize: 15 }}>{question.explanation}</Text></View> : null}<View style={styles.practiceFooter}><Pressable onPress={onPrevious} disabled={index === 0} style={[styles.bottomButton, { borderColor: colors.border, borderRadius: radius.md, opacity: index === 0 ? 0.45 : 1 }]}><Ionicons name="arrow-back" size={19} color={colors.primary} /><Text variant="bodySmall" weight="semiBold" style={{ color: colors.primary }}>{labels.previous}</Text></Pressable><Pressable disabled={nextDisabled} onPress={onNext} style={[styles.nextButton, { backgroundColor: colors.primary, borderRadius: radius.md, opacity: nextDisabled ? 0.45 : 1 }]}><Text variant="bodySmall" weight="bold" style={styles.nextButtonLabel}>{isLastLabel(index, total, labels)}</Text><Ionicons name="arrow-forward" size={19} color="#FFF" /></Pressable></View></View>;
}

function isLastLabel(index: number, total: number, labels: ModeLabels): string {
  return index === total - 1 ? labels.finish : labels.next;
}

function LimitModal({ visible, labels, colors, radius, onClose }: { visible: boolean; labels: ModeLabels; colors: ThemeColors; radius: ThemeRadius; onClose: () => void }) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><Pressable style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]} onPress={onClose}><Pressable onPress={(event) => event.stopPropagation()} style={[styles.limitModal, { backgroundColor: colors.surface, borderRadius: radius.lg }]}><View style={[styles.modalIcon, { backgroundColor: `${colors.warning}18` }]}><Ionicons name="speedometer-outline" size={30} color={colors.warning} /></View><Text variant="h2" weight="semiBold" style={{ textAlign: 'center' }}>{labels.dailyLimitTitle}</Text><Text variant="body" secondary style={{ textAlign: 'center' }}>{labels.dailyLimitMessage}</Text><Button label={labels.keepPracticing} variant="secondary" onPress={onClose} /></Pressable></Pressable></Modal>;
}

function LeaveConfirmation({ visible, labels, colors, radius, onCancel, onConfirm }: { visible: boolean; labels: ModeLabels; colors: ThemeColors; radius: ThemeRadius; onCancel: () => void; onConfirm: () => void }) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}><Pressable style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]} onPress={onCancel}><Pressable onPress={(event) => event.stopPropagation()} style={[styles.leaveModal, { backgroundColor: colors.surface, borderColor: `${colors.warning}55`, borderRadius: radius.lg }]}><View style={styles.leaveTopRow}><View style={[styles.leaveIcon, { backgroundColor: `${colors.warning}18` }]}><Ionicons name="pause-circle-outline" size={29} color={colors.warning} /></View><View style={styles.leaveTitleBlock}><Text variant="h2" weight="semiBold">{labels.exitTitle}</Text><Text variant="bodySmall" secondary>{labels.exitMessage}</Text></View></View><View style={[styles.saveBadge, { backgroundColor: `${colors.success}15`, borderColor: `${colors.success}55` }]}><Ionicons name="phone-portrait-outline" size={19} color={colors.success} /><Text variant="caption" weight="bold" style={{ color: colors.success }}>{labels.progressSaved}</Text></View><View style={styles.leaveActions}><Button label={labels.keepPracticing} variant="secondary" onPress={onCancel} /><Button label={labels.leavePractice} onPress={onConfirm} /></View></Pressable></Pressable></Modal>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topicSubtitle: { minHeight: 36, paddingHorizontal: 16, paddingVertical: 7, borderBottomWidth: 1, justifyContent: 'center' },
  trackBar: { minHeight: 52, padding: 4, borderWidth: 1, flexDirection: 'row', gap: 4 },
  trackButton: { flex: 1, minHeight: 42, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  sectionHeader: { borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10, elevation: 1 },
  sectionTitle: { flex: 1, minWidth: 0, gap: 2 },
  sectionIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  expandButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 7, paddingHorizontal: 5, flexShrink: 1, maxWidth: 130 },
  questionCard: { borderWidth: 1, padding: 15, gap: 14, elevation: 1 },
  questionTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  numberBadge: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10 },
  difficultyBadge: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  smallAction: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  answerToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 4 },
  readOption: { minHeight: 53, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 10 },
  optionBullet: { width: 29, height: 29, borderRadius: 15, borderWidth: 1.4, alignItems: 'center', justifyContent: 'center' },
  explanationCard: { borderWidth: 1, padding: 16, gap: 10 },
  explanationTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  practiceProgress: { borderWidth: 1, padding: 12, gap: 8 },
  limitRow: { minHeight: 58, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressTrack: { height: 5, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 5, borderRadius: 3 },
  questionMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  questionBadge: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  metaActions: { flexDirection: 'row', gap: 10 },
  actionIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', elevation: 1 },
  difficulty: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9 },
  option: { minHeight: 66, borderWidth: 1.4, paddingHorizontal: 13, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  optionLetter: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  explanationHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  resultIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  resultDivider: { height: 1 },
  practiceFooter: { flexDirection: 'row', gap: 10, marginTop: 16 },
  bottomButton: { minHeight: 50, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, flex: 0.85 },
  nextButton: { minHeight: 50, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, flex: 1.35 },
  nextButtonLabel: { color: '#FFF', flex: 1, textAlign: 'center', lineHeight: 18, fontSize: 13 },
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
