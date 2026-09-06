import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useAuthStore } from '@/src/core/store/authStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchCurrentAffairsQuestions, saveQuizProgress, selectDailyQuestions, type CurrentAffairsQuestion } from '@/src/core/firebase/services/currentAffairs';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { ThemeToggleButton } from '@/src/components/misc/ThemeToggleButton';
import { Text } from '@/src/components/misc/Text';
import { Card } from '@/src/components/cards/Card';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';

function ResultView({ questions, answers, score, onBack }: { questions: CurrentAffairsQuestion[]; answers: Record<string, string>; score: number; onBack: () => void }) {
  const { colors, spacing } = useTheme();
  return (
    <ScrollView contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: spacing.xxl * 2 }}>
      <Card style={[styles.resultCard, { backgroundColor: colors.surfaceAlt }]}>
        <View style={styles.resultIcon}><Ionicons name="trophy-outline" size={34} color="#EA580C" /></View>
        <Text variant="h2" weight="bold" style={{ textAlign: 'center' }}>Quiz पूरा भयो</Text>
        <Text variant="bodyLarge" secondary style={{ textAlign: 'center', marginTop: 5 }}>{questions.length} मध्ये {score} सही</Text>
        <Text variant="h1" weight="bold" style={{ textAlign: 'center', color: colors.primary, marginTop: 8 }}>{questions.length ? Math.round((score / questions.length) * 100) : 0}%</Text>
      </Card>
      <View style={styles.reviewHeading}><Text variant="h3" weight="bold">उत्तर समीक्षा</Text><Text variant="caption" secondary>गल्ती दोहोरिन नदिनुहोस्</Text></View>
      {questions.map((question, index) => {
        const answer = answers[question.id];
        const isCorrect = answer === question.correctOptionId;
        const correctText = question.optionsNp.find((option) => option.id === question.correctOptionId)?.text;
        const selectedText = question.optionsNp.find((option) => option.id === answer)?.text;
        return (
          <Card key={question.id} style={[styles.reviewCard, { borderLeftWidth: 4, borderLeftColor: isCorrect ? '#059669' : '#DC2626' }]}>
            <Text variant="caption" secondary>प्रश्न {index + 1}</Text>
            <Text variant="body" weight="semiBold" style={{ marginTop: 4 }}>{question.questionNp}</Text>
            <Text variant="bodySmall" style={{ color: isCorrect ? '#059669' : '#DC2626', marginTop: 7 }}>{isCorrect ? 'सही उत्तर' : answer === '__skipped__' ? 'छोडिएको' : `तपाईंको उत्तर: ${selectedText ?? ''}`}</Text>
            {!isCorrect ? <Text variant="bodySmall" style={{ color: '#059669', marginTop: 3 }}>सही उत्तर: {correctText}</Text> : null}
            <Text variant="caption" secondary style={{ marginTop: 7 }}>{question.explanationNp}</Text>
          </Card>
        );
      })}
      <Pressable onPress={onBack} style={[styles.finishButton, { backgroundColor: colors.primary }]}><Text variant="body" weight="bold" style={{ color: colors.onPrimary }}>Current Affairs मा फर्कनुहोस्</Text></Pressable>
    </ScrollView>
  );
}

export default function CurrentAffairsQuizScreen() {
  const { colors, effective, setMode, spacing } = useTheme();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const questionsData = useAsyncData(() => fetchCurrentAffairsQuestions({ limit: 100 }), []);
  const questions = useMemo(() => selectDailyQuestions(questionsData.data ?? []), [questionsData.data]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const current = questions[index];
  const selected = current ? answers[current.id] : undefined;

  const toggleTheme = () => setMode(effective === 'dark' ? 'light' : 'dark');

  const finishQuiz = async (nextAnswers: Record<string, string>) => {
    let score = 0;
    const correctQuestionIds: string[] = [];
    const wrongQuestionIds: string[] = [];
    const attemptedQuestionIds = questions.map((question) => question.id);
    questions.forEach((question) => {
      if (nextAnswers[question.id] === question.correctOptionId) {
        score += 1;
        correctQuestionIds.push(question.id);
      } else {
        wrongQuestionIds.push(question.id);
      }
    });
    setResult(score);
    if (user?.uid) {
      setSaving(true);
      await saveQuizProgress(user.uid, { attemptedQuestionIds, correctQuestionIds, wrongQuestionIds, selectedAnswerIds: nextAnswers, score, completed: true }).catch(() => undefined);
      setSaving(false);
    }
  };

  const goNext = (forcedAnswer?: string) => {
    if (!current) return;
    const nextAnswers = { ...answers, [current.id]: forcedAnswer ?? selected ?? '__skipped__' };
    setAnswers(nextAnswers);
    if (index >= questions.length - 1) {
      void finishQuiz(nextAnswers);
    } else {
      setIndex((value) => value + 1);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopAppBar title="Daily Quiz" actions={<ThemeToggleButton isDark={effective === 'dark'} onToggle={toggleTheme} size={36} />} />
      <PageLoaderOverlay visible={questionsData.loading || saving} label={saving ? 'Saving Result...' : 'Loading Quiz...'} />
      {questionsData.error ? <DataNotFound onRetry={questionsData.refetch} /> : result !== null ? <ResultView questions={questions} answers={answers} score={result} onBack={() => router.back()} /> : questions.length === 0 ? <EmptyState title="अहिले quiz का लागि प्रश्न उपलब्ध छैन" /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: spacing.xxl * 2 }}>
          <View style={styles.progressRow}><Text variant="bodySmall" weight="semiBold">प्रश्न {index + 1} / {questions.length}</Text><Text variant="caption" secondary>दैनिक अधिकतम १५</Text></View>
          <View style={[styles.progressTrack, { backgroundColor: colors.surfaceAlt }]}><View style={[styles.progressFill, { width: `${((index + 1) / questions.length) * 100}%`, backgroundColor: colors.primary }]} /></View>
          <Card style={styles.questionCard}><Text variant="bodyLarge" weight="bold">{current.questionNp}</Text><View style={styles.optionsList}>{current.optionsNp.map((option) => { const active = selected === option.id; return <Pressable key={option.id} onPress={() => setAnswers((previous) => ({ ...previous, [current.id]: option.id }))} style={[styles.option, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.surfaceAlt : colors.surface }]}><View style={[styles.optionCircle, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : 'transparent' }]}>{active ? <Ionicons name="checkmark" size={14} color={colors.onPrimary} /> : null}</View><Text variant="body" style={{ flex: 1 }}>{option.text}</Text></Pressable>; })}</View></Card>
          <View style={styles.quizActions}><Pressable onPress={() => { setAnswers((previous) => ({ ...previous, [current.id]: '__skipped__' })); goNext('__skipped__'); }} style={[styles.skipButton, { borderColor: colors.border }]}><Text variant="bodySmall" secondary>छोड्नुहोस्</Text></Pressable><Pressable onPress={() => goNext()} style={[styles.nextButton, { backgroundColor: colors.primary }]}><Text variant="body" weight="bold" style={{ color: colors.onPrimary }}>{index === questions.length - 1 ? 'Submit Quiz' : 'Next'}</Text><Ionicons name={index === questions.length - 1 ? 'checkmark-circle-outline' : 'arrow-forward'} size={18} color={colors.onPrimary} /></Pressable></View>
          <Text variant="caption" secondary style={{ textAlign: 'center', marginTop: 14 }}>उत्तर छानेपछि Next थिच्नुहोस्। Timer र negative marking पछि Exam Mode मा थपिनेछ।</Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressTrack: { height: 7, borderRadius: 5, overflow: 'hidden', marginTop: 9, marginBottom: 16 },
  progressFill: { height: '100%', borderRadius: 5 },
  questionCard: { padding: 16 },
  optionsList: { gap: 10, marginTop: 20 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 13, padding: 13 },
  optionCircle: { width: 24, height: 24, borderWidth: 1.5, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  quizActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  skipButton: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, borderWidth: 1 },
  nextButton: { flex: 2, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12 },
  resultCard: { alignItems: 'center', paddingVertical: 24 },
  resultIcon: { width: 66, height: 66, borderRadius: 33, backgroundColor: '#FFEDD5', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  reviewHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, marginBottom: 10 },
  reviewCard: { marginBottom: 9 },
  finishButton: { alignItems: 'center', paddingVertical: 15, borderRadius: 12, marginTop: 8 },
});
