// §27 Result — score summary, per-question review, retake/back-to-home.
import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchAttempt, fetchQuestionsByIds } from '@/src/core/firebase/services/exams';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';
import { ProgressRing } from '@/src/components/misc/ProgressRing';
import { Card } from '@/src/components/cards/Card';
import { ErrorState } from '@/src/components/feedback/ErrorState';
import { Spinner } from '@/src/components/feedback/Spinner';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';

export default function ResultScreen() {
  const { attemptId } = useLocalSearchParams<{ attemptId: string }>();
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [showReview, setShowReview] = useState(false);

  const attempt = useAsyncData(async () => {
    if (!user) return null;
    return fetchAttempt(user.uid, attemptId);
  }, [user?.uid, attemptId]);

  const questions = useAsyncData(async () => {
    if (!attempt.data) return [];
    return fetchQuestionsByIds(attempt.data.answers.map((a) => a.questionId));
  }, [attempt.data?.id]);

  const refreshing = attempt.refreshing || questions.refreshing;
  const onRefresh = () => {
    attempt.refresh();
    questions.refresh();
  };

  if (attempt.loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <Spinner fullScreen />
        <Text variant="body" secondary style={{ marginTop: spacing.md }}>{t('result.calculating')}</Text>
      </View>
    );
  }

  if (attempt.error || !attempt.data) {
    return <ErrorState onRetry={attempt.refetch} />;
  }

  const data = attempt.data;
  const percent = data.totalMarks > 0 ? data.score / data.totalMarks : 0;
  const minutes = Math.floor(data.timeTakenSeconds / 60);
  const seconds = data.timeTakenSeconds % 60;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.screenPadding, gap: spacing.lg }}
      refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={{ alignItems: 'center', gap: spacing.md, marginTop: spacing.lg }}>
        <ProgressRing progress={percent} size={140} strokeWidth={12} color={percent >= 0.5 ? colors.success : colors.error} />
        <Text variant="h2" weight="bold">{data.examTitle}</Text>
        <Text variant="body" secondary>{t('result.timeTaken')}: {minutes}m {seconds}s</Text>
      </View>

      <Card style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
        <Stat label={t('result.correct')} value={data.correctCount} color={colors.success} />
        <Stat label={t('result.incorrect')} value={data.incorrectCount} color={colors.error} />
        <Stat label={t('result.unattempted')} value={data.unattemptedCount} color={colors.textSecondary} />
      </Card>

      <Button label={showReview ? t('common.close') : t('result.reviewAnswers')} variant="secondary" onPress={() => setShowReview((v) => !v)} />

      {showReview && questions.data ? (
        <View style={{ gap: spacing.md }}>
          {questions.data.map((q) => {
            const answer = data.answers.find((a) => a.questionId === q.id);
            const userIndex = answer?.selectedIndex ?? null;
            return (
              <Card key={q.id} style={{ gap: spacing.xs }}>
                <Text variant="body" weight="semiBold">{q.text}</Text>
                <Text variant="bodySmall" secondary>
                  {t('result.yourAnswer')}: {userIndex !== null ? q.options[userIndex] : '—'}
                </Text>
                <Text variant="bodySmall" style={{ color: colors.success }}>
                  {t('result.correctAnswer')}: {q.options[q.correctIndex]}
                </Text>
                <Text variant="bodySmall" secondary>{q.explanation}</Text>
              </Card>
            );
          })}
        </View>
      ) : null}

      <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
        <Button label={t('result.retakeTest')} onPress={() => router.replace(`/mock-test/${data.examId}/instructions`)} />
        <Button label={t('result.backToHome')} variant="secondary" onPress={() => router.replace('/(tabs)')} />
      </View>
    </ScrollView>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text variant="h2" weight="bold" style={{ color }}>{value}</Text>
      <Text variant="caption" secondary>{label}</Text>
    </View>
  );
}
