// §23 Question of the Day
import React, { useState } from 'react';
import { View, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchQuestionOfTheDay, submitQotdAnswer } from '@/src/core/firebase/services/qotd';
import { fetchRandomQuestion } from '@/src/core/firebase/services/questions';
import { fetchUserCourseInfo } from '@/src/core/firebase/services/courses';
import { showToast } from '@/src/core/store/toastStore';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { Text } from '@/src/components/misc/Text';
import { Card } from '@/src/components/cards/Card';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { Badge } from '@/src/components/misc/Badge';

export default function QuestionOfTheDayScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  void router;
  const user = useAuthStore((s) => s.user);
  const [selected, setSelected] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const [courseId, setCourseId] = useState<string | null>(null);

  const { data, loading, error, refreshing, refetch, refresh } = useAsyncData(async () => {
    if (!user) return null;
    const courseInfo = await fetchUserCourseInfo(user.uid).catch(() => null);
    const activeCourseId = courseInfo?.courseId ?? null;
    setCourseId(activeCourseId);
    const result = await fetchQuestionOfTheDay(user.uid, fetchRandomQuestion, activeCourseId);
    setSelected(result.answeredIndex);
    setStreak(result.streak);
    return result;
  }, [user?.uid]);

  const alreadyAnswered = data?.answeredIndex !== null && data?.answeredIndex !== undefined;

  const handleSelect = async (optionIndex: number) => {
    if (alreadyAnswered || !user || !data?.question) return;
    setSelected(optionIndex);
    const newStreak = await submitQotdAnswer(user.uid, optionIndex, streak, courseId);
    setStreak(newStreak);
    showToast(t('qotd.streakUpdated', { count: newStreak }), 'success');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TopAppBar
        title={t('qotd.title')}
        actions={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="flame" size={18} color={colors.warning} />
            <Text variant="bodySmall" weight="semiBold">{streak}</Text>
          </View>
        }
      />
      <PageLoaderOverlay visible={loading || refreshing} label="Loading Daily Test..." />
      {loading ? null : error ? (
        <DataNotFound onRetry={refetch} />
      ) : !data?.question ? (
        <DataNotFound title="No Question Available" description="Check back tomorrow for a new question." onRetry={refetch} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.screenPadding, gap: spacing.md }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        >
          {alreadyAnswered ? (
            <View style={{ alignSelf: 'flex-start' }}>
              <Badge label={t('qotd.alreadyAnswered')} color={colors.info} />
            </View>
          ) : null}
          <Text variant="h3" weight="semiBold">{data.question.text}</Text>
          {data.question.options.map((option, i) => {
            const isSelected = selected === i;
            const isCorrect = i === data.question!.correctIndex;
            const showResult = selected !== null;
            let borderColor = colors.border;
            if (showResult && isSelected) borderColor = isCorrect ? colors.success : colors.error;
            else if (showResult && isCorrect) borderColor = colors.success;

            return (
              <Pressable
                key={i}
                onPress={() => handleSelect(i)}
                disabled={alreadyAnswered}
                style={{
                  padding: spacing.md,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor,
                  backgroundColor: colors.surface,
                }}
              >
                <Text variant="bodyLarge">{option}</Text>
              </Pressable>
            );
          })}
          {selected !== null ? (
            <Card>
              <Text variant="bodySmall" weight="semiBold" style={{ marginBottom: spacing.xs }}>{t('result.explanation')}</Text>
              <Text variant="body" secondary>{data.question.explanation}</Text>
            </Card>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
