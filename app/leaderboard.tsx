// §29 Leaderboard
import React, { useState } from 'react';
import { View, FlatList } from 'react-native';
import { useTheme } from '@/src/core/theme';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchLeaderboard } from '@/src/core/firebase/services/leaderboard';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { TabBar } from '@/src/components/nav/TabBar';
import { LeaderboardRow } from '@/src/components/cards/LeaderboardRow';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';

type Scope = 'allTime' | 'weekly';

export default function LeaderboardScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [scope, setScope] = useState<Scope>('allTime');
  const { data, loading, refreshing, error, refetch, refresh } = useAsyncData(() => fetchLeaderboard(), []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TopAppBar title={t('leaderboard.title')} />
      <View style={{ paddingHorizontal: spacing.screenPadding }}>
        <TabBar
          items={[
            { key: 'allTime', label: t('leaderboard.allTime') },
            { key: 'weekly', label: t('leaderboard.weekly') },
          ]}
          active={scope}
          onChange={setScope}
        />
      </View>
      <PageLoaderOverlay visible={loading || refreshing} label="Loading Leaderboard..." />
      {loading ? null : error ? (
        <DataNotFound onRetry={refetch} />
      ) : !data || data.length === 0 ? (
        <EmptyState title={t('leaderboard.empty')} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.screenPadding, gap: spacing.xs }}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={refresh} />}
          renderItem={({ item, index }) => (
            <LeaderboardRow
              rank={index + 1}
              name={item.name}
              photoURL={item.photoURL}
              score={item.score}
              highlighted={user?.displayName === item.name}
            />
          )}
        />
      )}
    </View>
  );
}
