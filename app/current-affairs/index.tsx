// §21 Current Affairs
import React from 'react';
import { View, FlatList, RefreshControl } from 'react-native';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchCurrentAffairs } from '@/src/core/firebase/services/content';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { Text } from '@/src/components/misc/Text';
import { Chip } from '@/src/components/misc/Chip';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { ErrorState } from '@/src/components/feedback/ErrorState';
import { Skeleton } from '@/src/components/feedback/Skeleton';
import { Card } from '@/src/components/cards/Card';

export default function CurrentAffairsScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const { data, loading, refreshing, error, refetch, refresh } = useAsyncData(() => fetchCurrentAffairs(), []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TopAppBar title={t('currentAffairs.title')} />
      {loading ? (
        <View style={{ padding: spacing.screenPadding, gap: spacing.sm }}>
          <Skeleton height={80} /><Skeleton height={80} /><Skeleton height={80} />
        </View>
      ) : error ? (
        <ErrorState onRetry={refetch} />
      ) : !data || data.length === 0 ? (
        <EmptyState title={t('currentAffairs.empty')} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.screenPadding, gap: spacing.sm }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
          renderItem={({ item }) => (
            <Card>
              <View style={{ gap: spacing.xs }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Chip label={item.category} />
                  <Text variant="caption" secondary>{item.date?.toDate().toLocaleDateString() ?? ''}</Text>
                </View>
                <Text variant="bodyLarge" weight="semiBold">{item.headline}</Text>
                <Text variant="body" secondary numberOfLines={3}>{item.summary}</Text>
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}
