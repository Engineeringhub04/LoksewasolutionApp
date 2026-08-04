// §29 Leaderboard
import React, { useState } from 'react';
import { View, FlatList, RefreshControl } from 'react-native';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchLeaderboard } from '@/src/core/firebase/services/leaderboard';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { TabBar } from '@/src/components/nav/TabBar';
import { LeaderboardRow } from '@/src/components/cards/LeaderboardRow';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { ErrorState } from '@/src/components/feedback/ErrorState';
import { Skeleton } from '@/src/components/feedback/Skeleton';

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
      {loading ? (
        <View style={{ padding: spacing.screenPadding, gap: spacing.sm }}>
          <Skeleton height={52} /><Skeleton height={52} /><Skeleton height={52} />
        </View>
      ) : error ? (
        <ErrorState onRetry={refetch} />
      ) : !data || data.length === 0 ? (
        <EmptyState title={t('leaderboard.empty')} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.screenPadding, gap: spacing.xs }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
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
