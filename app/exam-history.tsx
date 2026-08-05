// §30 Exam History
import React from 'react';
import { View, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/src/core/theme';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchAttemptHistory } from '@/src/core/firebase/services/exams';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { ResultCard } from '@/src/components/cards/ResultCard';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';

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
      <PageLoaderOverlay visible={loading || refreshing} label="Loading Exam History..." />
      {loading ? null : error ? (
        <DataNotFound onRetry={refetch} />
      ) : !data || data.length === 0 ? (
        <EmptyState title={t('history.empty')} ctaLabel={t('history.startMockTest')} onCtaPress={() => router.push('/(tabs)/exam')} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.screenPadding, gap: spacing.sm }}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={refresh} />}
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
