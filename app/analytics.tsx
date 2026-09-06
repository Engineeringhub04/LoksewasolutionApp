// §28 Performance Analytics
import React from 'react';
import { View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/src/core/theme';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { useRefreshOnFocus } from '@/src/core/hooks/useRefreshOnFocus';
import { fetchAnalytics } from '@/src/core/firebase/services/analytics';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';
import { Text } from '@/src/components/misc/Text';
import { Card } from '@/src/components/cards/Card';
import { ProgressBar } from '@/src/components/misc/ProgressBar';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { RefreshableCenter } from '@/src/components/feedback/RefreshableCenter';

const MIN_ATTEMPTS_FOR_ANALYTICS = 3;

export default function AnalyticsScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const { data, loading, error, refreshing, refetch, refresh } = useAsyncData(async () => {
    if (!user) return null;
    return fetchAnalytics(user.uid);
  }, [user?.uid]);

  // Returning to this screen must show current data without a manual pull.
  useRefreshOnFocus(refresh);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SubpageHeader title={t('analytics.title')} showThemeToggle />
      <PageLoaderOverlay visible={loading || refreshing} label="Loading Analytics..." />
      {loading ? null : error || !data ? (
        // Wrapped so the empty/error states keep pull-to-refresh, which is
        // exactly when the user wants to retry.
        <RefreshableCenter refreshing={refreshing} onRefresh={refresh}>
          <DataNotFound onRetry={refetch} />
        </RefreshableCenter>
      ) : data.attempts.length < MIN_ATTEMPTS_FOR_ANALYTICS ? (
        <RefreshableCenter refreshing={refreshing} onRefresh={refresh}>
          <EmptyState
            icon="stats-chart-outline"
            title={t('analytics.lowData')}
            ctaLabel={t('history.startMockTest')}
            ctaIcon="play"
            onCtaPress={() => router.push('/(tabs)/exam')}
          />
        </RefreshableCenter>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.screenPadding, gap: spacing.md }}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={refresh} />}
        >
          <Card style={{ gap: spacing.sm }}>
            <Text variant="h3" weight="semiBold">{t('analytics.scoreTrend')}</Text>
            <Text variant="display" weight="bold" style={{ color: colors.primary }}>
              {Math.round(data.averageScorePercent * 100)}%
            </Text>
            <View style={{ flexDirection: 'row', gap: 4, alignItems: 'flex-end', height: 60 }}>
              {data.scoreTrend.map((point, i) => (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    height: `${Math.max(6, point.percent * 100)}%`,
                    backgroundColor: colors.primary,
                    borderRadius: 4,
                  }}
                />
              ))}
            </View>
          </Card>

          <Card style={{ gap: spacing.sm }}>
            <Text variant="h3" weight="semiBold">{t('analytics.timeSpent')}</Text>
            <Text variant="bodyLarge">{Math.round(data.totalTimeSpentSeconds / 60)} min</Text>
          </Card>

          <Card style={{ gap: spacing.sm }}>
            <Text variant="h3" weight="semiBold">{t('analytics.weakTopics')}</Text>
            {data.attempts.slice(0, 3).map((a) => (
              <View key={a.id} style={{ gap: 4 }}>
                <Text variant="body">{a.examTitle}</Text>
                <ProgressBar progress={a.totalMarks > 0 ? a.score / a.totalMarks : 0} />
              </View>
            ))}
          </Card>
        </ScrollView>
      )}
    </View>
  );
}
