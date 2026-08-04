// §18 Subject Detail / Chapter List
import React from 'react';
import { View, FlatList, Pressable, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchChapters, fetchSubject } from '@/src/core/firebase/services/content';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { Text } from '@/src/components/misc/Text';
import { ProgressRing } from '@/src/components/misc/ProgressRing';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { ErrorState } from '@/src/components/feedback/ErrorState';
import { Skeleton } from '@/src/components/feedback/Skeleton';
import { Card } from '@/src/components/cards/Card';

export default function SubjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const subject = useAsyncData(() => fetchSubject(id), [id]);
  const chapters = useAsyncData(() => fetchChapters(id), [id]);

  const refreshing = subject.refreshing || chapters.refreshing;
  const onRefresh = () => {
    subject.refresh();
    chapters.refresh();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TopAppBar title={subject.data?.name ?? ''} />

      <View style={{ paddingHorizontal: spacing.screenPadding, paddingBottom: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <ProgressRing progress={0} size={64} strokeWidth={6} />
        <View>
          <Text variant="h3" weight="semiBold">{subject.data?.name}</Text>
          <Text variant="bodySmall" secondary>{t('subjects.progress')}</Text>
        </View>
      </View>

      {chapters.loading ? (
        <View style={{ padding: spacing.screenPadding, gap: spacing.sm }}>
          <Skeleton height={64} /><Skeleton height={64} /><Skeleton height={64} />
        </View>
      ) : chapters.error ? (
        <ErrorState onRetry={chapters.refetch} />
      ) : !chapters.data || chapters.data.length === 0 ? (
        <EmptyState title={t('subjects.contentComingSoon')} />
      ) : (
        <FlatList
          data={chapters.data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: spacing.screenPadding, gap: spacing.sm, paddingBottom: spacing.xl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={({ item }) => (
            <Card onPress={() => router.push(`/subjects/${id}/${item.id}`)}>
              <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyLarge" weight="medium">{item.title}</Text>
                  <Text variant="bodySmall" secondary>{item.topicCount} {t('subjects.topics')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </Pressable>
            </Card>
          )}
        />
      )}
    </View>
  );
}
