// §24 Quiz Practice — untimed MCQ practice per subject, immediate inline feedback.
import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchQuestionsBySubject } from '@/src/core/firebase/services/questions';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';
import { ProgressBar } from '@/src/components/misc/ProgressBar';
import { ConfirmDialog } from '@/src/components/feedback/ConfirmDialog';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { ErrorState } from '@/src/components/feedback/ErrorState';
import { Skeleton } from '@/src/components/feedback/Skeleton';

export default function QuizPracticeScreen() {
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const { data: questions, loading, error, refetch } = useAsyncData(() => fetchQuestionsBySubject(subjectId), [subjectId]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [finished, setFinished] = useState(false);

  const current = questions?.[index];

  const handleSelect = (optionIndex: number) => {
    if (selected !== null || !current) return;
    setSelected(optionIndex);
    if (optionIndex === current.correctIndex) setCorrectCount((c) => c + 1);
  };

  const handleNext = () => {
    if (!questions) return;
    if (index + 1 >= questions.length) {
      setFinished(true);
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
  };

  const handleExit = () => {
    if (selected !== null || finished) {
      router.back();
    } else {
      setShowExitConfirm(true);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <TopAppBar title={t('quiz.summary')} />
        <View style={{ padding: spacing.screenPadding, gap: spacing.sm }}>
          <Skeleton height={24} width="60%" />
          <Skeleton height={48} /><Skeleton height={48} /><Skeleton height={48} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <TopAppBar title="" />
        <ErrorState onRetry={refetch} />
      </View>
    );
  }

  if (!questions || questions.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <TopAppBar title="" />
        <EmptyState title={t('subjects.contentComingSoon')} />
      </View>
    );
  }

  if (finished) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md }}>
        <Text variant="h1" weight="bold">{t('quiz.summary')}</Text>
        <Text variant="display" weight="bold" style={{ color: colors.primary }}>
          {correctCount}/{questions.length}
        </Text>
        <Button label={t('result.backToHome')} onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TopAppBar title={`Q ${index + 1}/${questions.length}`} onBackPress={handleExit} />
      <View style={{ paddingHorizontal: spacing.screenPadding }}>
        <ProgressBar progress={(index + 1) / questions.length} />
      </View>
      <View style={{ padding: spacing.screenPadding, gap: spacing.md, flex: 1 }}>
        <Text variant="h3" weight="semiBold">{current?.text}</Text>
        {current?.options.map((option, i) => {
          const isSelected = selected === i;
          const isCorrect = i === current.correctIndex;
          const showResult = selected !== null;
          let borderColor = colors.border;
          if (showResult && isSelected) borderColor = isCorrect ? colors.success : colors.error;
          else if (showResult && isCorrect) borderColor = colors.success;

          return (
            <Pressable
              key={i}
              onPress={() => handleSelect(i)}
              style={{ padding: spacing.md, borderRadius: 12, borderWidth: 1.5, borderColor, backgroundColor: colors.surface }}
            >
              <Text variant="bodyLarge">{option}</Text>
            </Pressable>
          );
        })}
        {selected !== null ? (
          <Text variant="body" secondary>{current?.explanation}</Text>
        ) : null}
      </View>
      <View style={{ padding: spacing.screenPadding }}>
        <Button label={t('common.next')} onPress={handleNext} disabled={selected === null} />
      </View>

      <ConfirmDialog
        visible={showExitConfirm}
        title={t('quiz.exitTitle')}
        message={t('quiz.exitMessage')}
        destructive
        onConfirm={() => {
          setShowExitConfirm(false);
          router.back();
        }}
        onCancel={() => setShowExitConfirm(false)}
      />
    </View>
  );
}
