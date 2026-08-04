// §30 Exam History
import React from 'react';
import { View, FlatList, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchAttemptHistory } from '@/src/core/firebase/services/exams';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { ResultCard } from '@/src/components/cards/ResultCard';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { ErrorState } from '@/src/components/feedback/ErrorState';
import { Skeleton } from '@/src/components/feedback/Skeleton';

export default function ExamHistoryScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const { data, loading, refreshing, error, refetch, refresh } = useAsyncData(async () => {
    if (!user) return [];
    return fetchAttemptHistory(user.uid);
  }, [user?.uid]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TopAppBar title={t('history.title')} />
      {loading ? (
        <View style={{ padding: spacing.screenPadding, gap: spacing.sm }}>
          <Skeleton height={64} /><Skeleton height={64} /><Skeleton height={64} />
        </View>
      ) : error ? (
        <ErrorState onRetry={refetch} />
      ) : !data || data.length === 0 ? (
        <EmptyState title={t('history.empty')} ctaLabel={t('history.startMockTest')} onCtaPress={() => router.push('/(tabs)/exam')} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.screenPadding, gap: spacing.sm }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
          renderItem={({ item }) => (
            <ResultCard
              title={item.examTitle}
              date={item.submittedAt?.toDate().toLocaleDateString() ?? ''}
              score={item.score}
              totalMarks={item.totalMarks}
              onPress={() => router.push(`/result/${item.id}`)}
            />
          )}
        />
      )}
    </View>
  );
}
