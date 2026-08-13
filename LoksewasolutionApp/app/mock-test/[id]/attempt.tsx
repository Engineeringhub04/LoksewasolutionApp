// §25 Mock Test — in-test attempt screen: countdown, flag-for-review, grid overview, submit.
import React, { useMemo, useRef, useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { useExamTimer } from '@/src/core/hooks/useExamTimer';
import { fetchMockTest, fetchQuestionsByIds, submitAttempt, type AttemptAnswer } from '@/src/core/firebase/services/exams';
import { showToast } from '@/src/core/store/toastStore';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';
import { IconButton } from '@/src/components/buttons/IconButton';
import { ConfirmDialog } from '@/src/components/feedback/ConfirmDialog';
import { BottomSheet } from '@/src/components/feedback/BottomSheet';
import { ErrorState } from '@/src/components/feedback/ErrorState';
import { Spinner } from '@/src/components/feedback/Spinner';

export default function MockTestAttemptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const exam = useAsyncData(() => fetchMockTest(id), [id]);
  const questions = useAsyncData(async () => {
    const def = await fetchMockTest(id);
    if (!def) return [];
    return fetchQuestionsByIds(def.questionIds);
  }, [id]);

  const [answers, setAnswers] = useState<Record<string, AttemptAnswer>>({});
  const [index, setIndex] = useState(0);
  const [showGrid, setShowGrid] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const startTimeRef = useRef(Date.now());
  const autoSubmittedRef = useRef(false);

  const questionList = useMemo(() => questions.data ?? [], [questions.data]);
  const current = questionList[index];

  const handleSubmit = async (auto = false) => {
    if (!user || !exam.data || submitting) return;
    setSubmitting(true);
    const timeTakenSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
    const answerList = questionList.map((q) => answers[q.id] ?? { questionId: q.id, selectedIndex: null, flagged: false });
    try {
      const attemptId = await submitAttempt(user.uid, id, exam.data.title, questionList, answerList, timeTakenSeconds);
      if (auto) showToast(t('mockTest.autoSubmitted'), 'info');
      router.replace(`/result/${attemptId}`);
    } catch {
      showToast(t('common.somethingWentWrong'), 'error');
      setSubmitting(false);
    }
  };

  const timer = useExamTimer(exam.data?.durationMinutes ?? 60, () => {
    if (!autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      handleSubmit(true);
    }
  });

  const unansweredCount = useMemo(
    () => questionList.filter((q) => answers[q.id]?.selectedIndex === undefined || answers[q.id]?.selectedIndex === null).length,
    [questionList, answers]
  );

  const selectOption = (optionIndex: number) => {
    if (!current) return;
    setAnswers((prev) => ({
      ...prev,
      [current.id]: { questionId: current.id, selectedIndex: optionIndex, flagged: prev[current.id]?.flagged ?? false },
    }));
    showToast(t('mockTest.answerSaved'), 'success');
  };

  const toggleFlag = () => {
    if (!current) return;
    setAnswers((prev) => ({
      ...prev,
      [current.id]: {
        questionId: current.id,
        selectedIndex: prev[current.id]?.selectedIndex ?? null,
        flagged: !(prev[current.id]?.flagged ?? false),
      },
    }));
    showToast(t('mockTest.flaggedToast'), 'info');
  };

  const requestSubmit = () => {
    if (unansweredCount > 0) setShowSubmitConfirm(true);
    else handleSubmit(false);
  };

  if (exam.loading || questions.loading) {
    return <Spinner fullScreen />;
  }
  if (exam.error || questions.error || !exam.data) {
    return <ErrorState onRetry={() => { exam.refetch(); questions.refetch(); }} />;
  }
  if (questionList.length === 0) {
    return <ErrorState message={t('subjects.contentComingSoon')} />;
  }

  const timerColor = timer.isCritical ? colors.error : timer.isWarning ? colors.warning : colors.textPrimary;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Text variant="bodyLarge" weight="semiBold">{`Q ${index + 1}/${questionList.length}`}</Text>
        <Text variant="h3" weight="bold" style={{ color: timerColor }}>{timer.formatted}</Text>
        <IconButton name="grid-outline" accessibilityLabel={t('mockTest.gridOverview')} onPress={() => setShowGrid(true)} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.screenPadding, gap: spacing.md, flexGrow: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Text variant="h3" weight="semiBold" style={{ flex: 1 }}>{current?.text}</Text>
          <IconButton
            name={answers[current?.id ?? '']?.flagged ? 'flag' : 'flag-outline'}
            accessibilityLabel={t('mockTest.flagForReview')}
            color={answers[current?.id ?? '']?.flagged ? colors.warning : colors.textSecondary}
            onPress={toggleFlag}
          />
        </View>
        {current?.options.map((option, i) => {
          const isSelected = answers[current.id]?.selectedIndex === i;
          return (
            <Pressable
              key={i}
              onPress={() => selectOption(i)}
              style={{
                padding: spacing.md,
                borderRadius: radius.md,
                borderWidth: 1.5,
                borderColor: isSelected ? colors.primary : colors.border,
                backgroundColor: isSelected ? colors.surfaceAlt : colors.surface,
              }}
            >
              <Text variant="bodyLarge">{option}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ flexDirection: 'row', padding: spacing.screenPadding, gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
        <Button
          label={t('common.previous')}
          variant="secondary"
          onPress={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          style={{ flex: 1 }}
        />
        {index === questionList.length - 1 ? (
          <Button label={t('mockTest.submit')} onPress={requestSubmit} loading={submitting} style={{ flex: 1 }} />
        ) : (
          <Button label={t('common.next')} onPress={() => setIndex((i) => Math.min(questionList.length - 1, i + 1))} style={{ flex: 1 }} />
        )}
      </View>

      <BottomSheet visible={showGrid} onClose={() => setShowGrid(false)}>
        <Text variant="h3" weight="semiBold" style={{ marginBottom: spacing.md }}>{t('mockTest.gridOverview')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {questionList.map((q, i) => {
            const answer = answers[q.id];
            const answered = answer?.selectedIndex !== undefined && answer?.selectedIndex !== null;
            const flagged = answer?.flagged;
            return (
              <Pressable
                key={q.id}
                onPress={() => {
                  setIndex(i);
                  setShowGrid(false);
                }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.sm,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: answered ? colors.primary : colors.surfaceAlt,
                  borderWidth: flagged ? 2 : 0,
                  borderColor: colors.warning,
                }}
              >
                <Text variant="bodySmall" weight="semiBold" style={{ color: answered ? colors.onPrimary : colors.textPrimary }}>
                  {i + 1}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Button label={t('mockTest.submit')} onPress={() => { setShowGrid(false); requestSubmit(); }} style={{ marginTop: spacing.lg }} />
      </BottomSheet>

      <ConfirmDialog
        visible={showSubmitConfirm}
        title={t('mockTest.submit')}
        message={t('mockTest.unansweredWarning', { count: unansweredCount })}
        onConfirm={() => {
          setShowSubmitConfirm(false);
          handleSubmit(false);
        }}
        onCancel={() => setShowSubmitConfirm(false)}
      />
    </View>
  );
}

