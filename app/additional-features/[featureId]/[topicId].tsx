import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';
import { Text } from '@/src/components/misc/Text';
import { loadAdditionalFeatureQuestionBank, type AdditionalFeatureId, type AdditionalFeatureQuestion } from '@/src/core/services/additionalFeatures';
import { showToast } from '@/src/core/store/toastStore';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';

function valueOf(value: string | string[] | undefined, fallback = ''): string {
  return Array.isArray(value) ? value[0] ?? fallback : value ?? fallback;
}

function shuffleQuestions(questions: AdditionalFeatureQuestion[]): AdditionalFeatureQuestion[] {
  const shuffled = [...questions];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}

function correctIndex(question: AdditionalFeatureQuestion): number {
  if (question.correctOption >= 1 && question.correctOption <= question.options.length) return question.correctOption - 1;
  return Math.max(0, Math.min(question.correctOption, question.options.length - 1));
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
  const featureId = valueOf(params.featureId) as AdditionalFeatureId;
  const topicId = valueOf(params.topicId);
  const topicTitleEn = valueOf(params.topicTitleEn, topicId);
  const topicTitleNp = valueOf(params.topicTitleNp, topicTitleEn);
  const questionBankId = valueOf(params.questionBankId);
  const topicTitle = language === 'ne' ? topicTitleNp : topicTitleEn;
  const alternateTitle = language === 'ne' ? topicTitleEn : topicTitleNp;

  const [questions, setQuestions] = useState<AdditionalFeatureQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [track, setTrack] = useState<'read' | 'practice'>('read');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [current, setCurrent] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});

  const labels = language === 'ne' ? {
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
    expandAll: 'सबै खोल्नुहोस्',
    collapseAll: 'सबै बन्द गर्नुहोस्',
    loading: 'प्रश्नहरू लोड हुँदैछन्...',
    noQuestions: 'यस विषयका प्रश्नहरू उपलब्ध छैनन्।',
    loadError: 'प्रश्नहरू लोड गर्न सकिएन।',
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
    expandAll: 'Expand all',
    collapseAll: 'Collapse all',
    loading: 'Loading questions...',
    noQuestions: 'No questions are available for this topic.',
    loadError: 'Unable to load questions.',
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
      const result = await loadAdditionalFeatureQuestionBank(featureId, topicId, questionBankId);
      const source = result.bank?.questions ?? [];
      setQuestions(source.sort((a, b) => a.order - b.order));
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
  }, [load]);

  const practiceQuestions = useMemo(() => shuffleQuestions(questions), [questions]);
  const activeQuestions = track === 'read' ? questions : practiceQuestions;
  const currentQuestion = activeQuestions[current];
  const selected = currentQuestion ? selectedAnswers[currentQuestion.questionId] : undefined;
  const hasAnswered = selected !== undefined;
  const allExpanded = questions.length > 0 && questions.every((question) => expanded[question.questionId]);

  const selectPracticeOption = (optionIndex: number) => {
    if (!currentQuestion || hasAnswered) return;
    setSelectedAnswers((previous) => ({ ...previous, [currentQuestion.questionId]: optionIndex }));
  };

  const changeTrack = (nextTrack: 'read' | 'practice') => {
    setTrack(nextTrack);
    setCurrent(0);
    setExpanded({});
  };

  const modeHeader = <SubpageHeader title={topicTitle} />;

  if (loading) {
    return <View style={[styles.screen, { backgroundColor: colors.background }]}><Stack.Screen options={{ gestureEnabled: true }} />{modeHeader}<PageLoaderOverlay visible label={labels.loading} /></View>;
  }

  if (loadError) {
    return <View style={[styles.screen, { backgroundColor: colors.background }]}><Stack.Screen options={{ gestureEnabled: true }} />{modeHeader}<DataNotFound title={labels.loadError} description="Pull down to try again." onRetry={() => void load()} /></View>;
  }

  if (questions.length === 0) {
    return <View style={[styles.screen, { backgroundColor: colors.background }]}><Stack.Screen options={{ gestureEnabled: true }} />{modeHeader}<DataNotFound title={labels.noQuestions} description="" /></View>;
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ gestureEnabled: true }} />
      {modeHeader}
      <View style={[styles.topicSubtitle, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}><Text variant="caption" secondary numberOfLines={1}>{alternateTitle}</Text><Text variant="caption" weight="bold" style={{ color: colors.primary }}>{questions.length} {language === 'ne' ? 'प्रश्न' : 'questions'}</Text></View>
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
            <Pressable onPress={() => setExpanded(allExpanded ? {} : Object.fromEntries(questions.map((question) => [question.questionId, true])))} style={styles.expandButton}><Ionicons name={allExpanded ? 'chevron-up-outline' : 'chevron-down-outline'} size={19} color={colors.primary} /><Text variant="caption" weight="bold" style={{ color: colors.primary }}>{allExpanded ? labels.collapseAll : labels.expandAll}</Text></Pressable>
          </View>
          {questions.map((question, index) => <ReadQuestion key={question.questionId} question={question} index={index} isOpen={expanded[question.questionId] === true} onToggle={() => setExpanded((previous) => ({ ...previous, [question.questionId]: !previous[question.questionId] }))} labels={labels} colors={colors} spacing={spacing} radius={radius} />)}
        </ScrollView>
      ) : (
        <PracticeQuestion question={currentQuestion} index={current} total={activeQuestions.length} selected={selected} labels={labels} colors={colors} spacing={spacing} radius={radius} onSelect={selectPracticeOption} onPrevious={() => setCurrent((value) => Math.max(0, value - 1))} onNext={() => setCurrent((value) => Math.min(activeQuestions.length - 1, value + 1))} />
      )}
    </View>
  );
}

type ModeLabels = { showAnswer: string; hideAnswer: string; answer: string; explanation: string; correct: string; incorrect: string; previous: string; next: string; finish: string };

type ThemeColors = ReturnType<typeof useTheme>['colors'];
type ThemeSpacing = ReturnType<typeof useTheme>['spacing'];
type ThemeRadius = ReturnType<typeof useTheme>['radius'];

function ReadQuestion({ question, index, isOpen, onToggle, labels, colors, spacing, radius }: { question: AdditionalFeatureQuestion; index: number; isOpen: boolean; onToggle: () => void; labels: ModeLabels & { important?: string }; colors: ThemeColors; spacing: ThemeSpacing; radius: ThemeRadius }) {
  return <View style={[styles.questionCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}><QuestionHeader question={question} index={index} colors={colors} /><Text variant="h3" weight="semiBold" style={{ lineHeight: 24, fontSize: 18 }}>{question.question}</Text><Pressable onPress={onToggle} style={styles.answerToggle}><Ionicons name={isOpen ? 'chevron-up-circle-outline' : 'chevron-down-circle-outline'} size={24} color={colors.primary} /><Text variant="bodySmall" weight="semiBold" style={{ color: colors.primary }}>{isOpen ? labels.hideAnswer : labels.showAnswer}</Text></Pressable>{isOpen ? <AnswerDetails question={question} labels={labels} colors={colors} spacing={spacing} radius={radius} /> : null}</View>;
}

function AnswerDetails({ question, labels, colors, spacing, radius, selected }: { question: AdditionalFeatureQuestion; labels: ModeLabels; colors: ThemeColors; spacing: ThemeSpacing; radius: ThemeRadius; selected?: number }) {
  return <View style={{ gap: spacing.sm }}>{question.options.map((option, optionIndex) => { const correct = optionIndex === correctIndex(question); return <View key={option.id || optionIndex} style={[styles.readOption, { backgroundColor: correct ? `${colors.success}12` : colors.surface, borderColor: correct ? `${colors.success}80` : colors.border, borderRadius: radius.md }]}><View style={[styles.optionBullet, { borderColor: correct ? colors.success : colors.border, backgroundColor: correct ? colors.success : 'transparent' }]}><Text variant="caption" weight="bold" style={{ color: correct ? '#FFF' : colors.textSecondary }}>{String.fromCharCode(65 + optionIndex)}</Text></View><Text variant="bodySmall" style={{ flex: 1, lineHeight: 19, fontSize: 14 }}>{option.text}</Text>{correct ? <Ionicons name="checkmark-circle" size={20} color={colors.success} /> : null}</View>; })}<View style={[styles.explanationCard, { backgroundColor: `${colors.warning}12`, borderColor: `${colors.warning}55`, borderRadius: radius.md }]}><View style={styles.explanationTitle}><Ionicons name="bulb-outline" size={22} color={colors.warning} /><Text variant="bodyLarge" weight="bold" style={{ color: colors.warning }}>{labels.explanation}</Text></View><Text variant="bodySmall" style={{ lineHeight: 20, fontSize: 14 }}>{question.explanation}</Text></View>{selected !== undefined ? <Text variant="caption" secondary>{labels.answer}: {String.fromCharCode(65 + selected)}</Text> : null}</View>;
}

function PracticeQuestion({ question, index, total, selected, labels, colors, spacing, radius, onSelect, onPrevious, onNext }: { question: AdditionalFeatureQuestion | undefined; index: number; total: number; selected?: number; labels: ModeLabels; colors: ThemeColors; spacing: ThemeSpacing; radius: ThemeRadius; onSelect: (optionIndex: number) => void; onPrevious: () => void; onNext: () => void }) {
  if (!question) return null;
  const answer = correctIndex(question);
  const answered = selected !== undefined;
  return <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }} showsVerticalScrollIndicator={false}><View style={[styles.practiceProgress, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md }]}><Text variant="caption" weight="bold" style={{ color: colors.primary }}>QUESTION {index + 1} OF {total}</Text><View style={[styles.progressTrack, { backgroundColor: colors.border }]}><View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${((index + 1) / total) * 100}%` }]} /></View></View><View style={[styles.questionCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, marginTop: spacing.md }]}><QuestionHeader question={question} index={index} colors={colors} /><Text variant="h3" weight="semiBold" style={{ lineHeight: 24, fontSize: 18 }}>{question.question}</Text><View style={{ gap: spacing.sm }}>{question.options.map((option, optionIndex) => { const isCorrect = optionIndex === answer; const isSelected = selected === optionIndex; const wrong = answered && isSelected && !isCorrect; const bg = isCorrect && answered ? `${colors.success}13` : wrong ? `${colors.error}13` : colors.surface; const border = isCorrect && answered ? `${colors.success}90` : wrong ? `${colors.error}90` : colors.border; return <Pressable key={option.id || optionIndex} onPress={() => onSelect(optionIndex)} disabled={answered} style={[styles.practiceOption, { backgroundColor: bg, borderColor: border, borderRadius: radius.md }]}><View style={[styles.optionBullet, { borderColor: isCorrect && answered ? colors.success : wrong ? colors.error : colors.border, backgroundColor: isCorrect && answered ? colors.success : wrong ? colors.error : 'transparent' }]}><Text variant="caption" weight="bold" style={{ color: isCorrect && answered || wrong ? '#FFF' : colors.textSecondary }}>{String.fromCharCode(65 + optionIndex)}</Text></View><Text variant="bodySmall" style={{ flex: 1, lineHeight: 19, fontSize: 14 }}>{option.text}</Text>{isCorrect && answered ? <Ionicons name="checkmark-circle" size={21} color={colors.success} /> : wrong ? <Ionicons name="close-circle" size={21} color={colors.error} /> : null}</Pressable>; })}</View>{answered ? <View style={[styles.resultCard, { backgroundColor: selected === answer ? `${colors.success}13` : `${colors.error}13`, borderColor: selected === answer ? `${colors.success}60` : `${colors.error}60`, borderRadius: radius.md }]}><View style={styles.explanationTitle}><Ionicons name={selected === answer ? 'checkmark-circle' : 'close-circle'} size={22} color={selected === answer ? colors.success : colors.error} /><Text variant="bodyLarge" weight="bold" style={{ color: selected === answer ? colors.success : colors.error }}>{selected === answer ? labels.correct : labels.incorrect}</Text></View><Text variant="bodySmall" style={{ lineHeight: 20, fontSize: 14 }}>{question.explanation}</Text></View> : null}</View><View style={styles.practiceFooter}><Pressable onPress={onPrevious} disabled={index === 0} style={[styles.navButton, { borderColor: colors.border, backgroundColor: colors.surface, opacity: index === 0 ? 0.45 : 1 }]}><Ionicons name="arrow-back" size={18} color={colors.primary} /><Text variant="bodySmall" weight="bold" style={{ color: colors.primary }}>{labels.previous}</Text></Pressable><Pressable onPress={onNext} disabled={index === total - 1} style={[styles.navButton, { borderColor: colors.primary, backgroundColor: index === total - 1 ? colors.surface : colors.primary, opacity: index === total - 1 ? 0.45 : 1 }]}><Text variant="bodySmall" weight="bold" style={{ color: index === total - 1 ? colors.primary : '#FFF' }}>{index === total - 1 ? labels.finish : labels.next}</Text><Ionicons name="arrow-forward" size={18} color={index === total - 1 ? colors.primary : '#FFF'} /></Pressable></View></ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topicSubtitle: { minHeight: 36, paddingHorizontal: 16, paddingVertical: 7, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
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
  practiceOption: { minHeight: 58, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  optionBullet: { width: 29, height: 29, borderRadius: 15, borderWidth: 1.4, alignItems: 'center', justifyContent: 'center' },
  explanationCard: { borderWidth: 1, padding: 13, gap: 8 },
  resultCard: { borderWidth: 1, padding: 13, gap: 8 },
  explanationTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  practiceProgress: { borderWidth: 1, padding: 12, gap: 8 },
  progressTrack: { height: 5, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 5, borderRadius: 3 },
  practiceFooter: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 16 },
  navButton: { minHeight: 46, flex: 1, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
});
