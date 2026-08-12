// §17 Subject List
import React from 'react';
import { View, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/src/core/theme';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';
import { useTranslation } from '@/src/core/i18n';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { useRefreshOnFocus } from '@/src/core/hooks/useRefreshOnFocus';
import { fetchSubjects } from '@/src/core/firebase/services/content';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { SubjectCard } from '@/src/components/cards/SubjectCard';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { ErrorState } from '@/src/components/feedback/ErrorState';
import { SkeletonCard } from '@/src/components/feedback/Skeleton';

export default function SubjectListScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { data, loading, refreshing, error, refetch, refresh } = useAsyncData(() => fetchSubjects(), []);

  // Returning to this screen must show current data without a manual pull.
  useRefreshOnFocus(refresh);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TopAppBar title={t('subjects.title')} />
      {loading ? (
        <View style={{ padding: spacing.screenPadding, gap: spacing.sm }}>
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </View>
      ) : error ? (
        <ErrorState onRetry={refetch} />
      ) : !data || data.length === 0 ? (
        <EmptyState title={t('subjects.contentComingSoon')} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.sm, paddingHorizontal: spacing.screenPadding }}
          contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={refresh} />}
          renderItem={({ item }) => (
            <SubjectCard
              name={item.name}
              icon={item.icon as never}
              chapterCount={item.chapterCount}
              progress={0}
              onPress={() => router.push(`/subjects/${item.id}`)}
            />
          )}
        />
      )}
    </View>
  );
}
