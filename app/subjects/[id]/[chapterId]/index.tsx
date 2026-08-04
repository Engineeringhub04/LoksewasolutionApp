// Topic list within a Chapter (feeds into §19 Topic Detail)
import React from 'react';
import { View, FlatList, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchTopics } from '@/src/core/firebase/services/content';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { Text } from '@/src/components/misc/Text';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { ErrorState } from '@/src/components/feedback/ErrorState';
import { Skeleton } from '@/src/components/feedback/Skeleton';
import { Card } from '@/src/components/cards/Card';

export default function ChapterTopicsScreen() {
  const { id, chapterId } = useLocalSearchParams<{ id: string; chapterId: string }>();
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { data, loading, refreshing, error, refetch, refresh } = useAsyncData(() => fetchTopics(id, chapterId), [id, chapterId]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TopAppBar title={t('subjects.topics')} />
      {loading ? (
        <View style={{ padding: spacing.screenPadding, gap: spacing.sm }}>
          <Skeleton height={56} /><Skeleton height={56} /><Skeleton height={56} />
        </View>
      ) : error ? (
        <ErrorState onRetry={refetch} />
      ) : !data || data.length === 0 ? (
        <EmptyState title={t('subjects.contentComingSoon')} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: spacing.screenPadding, gap: spacing.sm, paddingBottom: spacing.xl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
          renderItem={({ item }) => (
            <Card onPress={() => router.push(`/subjects/${id}/${chapterId}/${item.id}`)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text variant="bodyLarge" weight="medium" style={{ flex: 1 }} numberOfLines={1}>{item.title}</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}
