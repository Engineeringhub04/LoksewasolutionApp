// Exam tab hub — links to Mock Tests, Live Exams, and Exam History.
import React from 'react';
import { View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/core/theme';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';
import { useTranslation } from '@/src/core/i18n';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchMockTests, fetchLiveExams } from '@/src/core/firebase/services/exams';
import { Text } from '@/src/components/misc/Text';
import { ExamCard } from '@/src/components/cards/ExamCard';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';

export default function ExamHubScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const mockTests = useAsyncData(() => fetchMockTests(), []);
  const liveExams = useAsyncData(() => fetchLiveExams(), []);

  const refreshing = mockTests.refreshing || liveExams.refreshing;
  const onRefresh = () => {
    mockTests.refresh();
    liveExams.refresh();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: spacing.xxl }}
      refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={{ paddingHorizontal: spacing.screenPadding, marginBottom: spacing.lg }}>
        <Text variant="display" weight="bold">{t('nav.exam')}</Text>
      </View>

      <View style={{ paddingHorizontal: spacing.screenPadding, marginBottom: spacing.lg, position: 'relative', minHeight: mockTests.loading ? 90 : undefined }}>
        <Text variant="h3" weight="semiBold" style={{ marginBottom: spacing.sm }}>{t('mockTest.instructions')}</Text>
        <PageLoaderOverlay visible={mockTests.loading} label="Loading Mock Tests..." />
        {mockTests.loading ? null : mockTests.error ? (
          <DataNotFound onRetry={mockTests.refetch} />
        ) : !mockTests.data || mockTests.data.length === 0 ? (
          <EmptyState title={t('common.comingSoon')} />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {mockTests.data.map((exam) => (
              <ExamCard
                key={exam.id}
                title={exam.title}
                questionCount={exam.questionIds.length}
                durationMinutes={exam.durationMinutes}
                onPress={() => router.push(`/mock-test/${exam.id}/instructions`)}
              />
            ))}
          </View>
        )}
      </View>

      <View style={{ paddingHorizontal: spacing.screenPadding, marginBottom: spacing.lg, position: 'relative', minHeight: liveExams.loading ? 90 : undefined }}>
        <Text variant="h3" weight="semiBold" style={{ marginBottom: spacing.sm }}>{t('liveExam.waitingRoom')}</Text>
        <PageLoaderOverlay visible={liveExams.loading} label="Loading Live Exams..." />
        {liveExams.loading ? null : liveExams.error ? (
          <DataNotFound onRetry={liveExams.refetch} />
        ) : !liveExams.data || liveExams.data.length === 0 ? (
          <EmptyState title={t('common.comingSoon')} />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {liveExams.data.map((exam) => (
              <ExamCard
                key={exam.id}
                title={exam.title}
                questionCount={exam.questionIds.length}
                durationMinutes={exam.durationMinutes}
                status="upcoming"
                onPress={() => router.push(`/live-exam/${exam.id}/waiting`)}
              />
            ))}
          </View>
        )}
      </View>

      <View style={{ paddingHorizontal: spacing.screenPadding, flexDirection: 'row', gap: spacing.md }}>
        <Text
          variant="body"
          weight="semiBold"
          style={{ color: colors.primary }}
          onPress={() => router.push('/exam-history')}
        >
          {t('history.title')}
        </Text>
        <Text
          variant="body"
          weight="semiBold"
          style={{ color: colors.primary }}
          onPress={() => router.push('/leaderboard')}
        >
          {t('leaderboard.title')}
        </Text>
        <Text
          variant="body"
          weight="semiBold"
          style={{ color: colors.primary }}
          onPress={() => router.push('/analytics')}
        >
          {t('analytics.title')}
        </Text>
      </View>
    </ScrollView>
    </View>
  );
}
