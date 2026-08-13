// §35 Keep Notes — personal notes, local-first, fully usable offline.
import React from 'react';
import { View, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/src/core/theme';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';
import { useTranslation } from '@/src/core/i18n';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { useRefreshOnFocus } from '@/src/core/hooks/useRefreshOnFocus';
import { loadNotes } from '@/src/core/firebase/services/notes';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';
import { Text } from '@/src/components/misc/Text';
import { Card } from '@/src/components/cards/Card';
import { FAB } from '@/src/components/buttons/FAB';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';

export default function KeepNotesScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { data, loading, error, refreshing, refetch, refresh } = useAsyncData(() => loadNotes(), []);

  // Returning to this screen must show current data without a manual pull.
  useRefreshOnFocus(refresh);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SubpageHeader title={t('keepNotes.title')} showThemeToggle />
      <PageLoaderOverlay visible={loading || refreshing} label="Loading Notes..." />
      {loading ? null : error ? (
        <DataNotFound onRetry={refetch} />
      ) : !data || data.length === 0 ? (
        <EmptyState title={t('keepNotes.empty')} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.sm, paddingHorizontal: spacing.screenPadding }}
          contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md, paddingBottom: 96 }}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={refresh} />}
          renderItem={({ item }) => (
            <Card onPress={() => router.push(`/notes/${item.id}`)} style={{ flex: 1, backgroundColor: item.color || colors.card, gap: 4 }}>
              <Text variant="body" weight="semiBold" numberOfLines={1}>{item.title || t('keepNotes.titlePlaceholder')}</Text>
              <Text variant="bodySmall" secondary numberOfLines={3}>{item.body}</Text>
              <Text variant="caption" secondary>{new Date(item.updatedAt).toLocaleDateString()}</Text>
            </Card>
          )}
        />
      )}
      <FAB icon="add" accessibilityLabel={t('keepNotes.newNote')} onPress={() => router.push('/notes/new')} />
    </View>
  );
}
