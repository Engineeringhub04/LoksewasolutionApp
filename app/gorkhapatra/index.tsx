// §22 Daily Gorkhapatra
import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { useTheme } from '@/src/core/theme';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';
import { useTranslation } from '@/src/core/i18n';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchGorkhapatraEditions } from '@/src/core/firebase/services/content';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { IconButton } from '@/src/components/buttons/IconButton';
import { Text } from '@/src/components/misc/Text';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { Card } from '@/src/components/cards/Card';

export default function GorkhapatraScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const { data, loading, refreshing, error, refetch, refresh } = useAsyncData(() => fetchGorkhapatraEditions(), []);
  const [index, setIndex] = useState(0);

  const editions = data ?? [];
  const current = editions[index];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TopAppBar
        title={t('gorkhapatra.title')}
        actions={
          <>
            <IconButton
              name="chevron-back-outline"
              accessibilityLabel={t('common.previous')}
              disabled={index >= editions.length - 1}
              onPress={() => setIndex((i) => Math.min(i + 1, editions.length - 1))}
            />
            <IconButton
              name="chevron-forward-outline"
              accessibilityLabel={t('common.next')}
              disabled={index <= 0}
              onPress={() => setIndex((i) => Math.max(i - 1, 0))}
            />
          </>
        }
      />
      <PageLoaderOverlay visible={loading || refreshing} label="Loading Gorkhapatra..." />
      {loading ? null : error ? (
        <DataNotFound onRetry={refetch} />
      ) : !current ? (
        <EmptyState title={t('gorkhapatra.empty')} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.screenPadding, gap: spacing.md }}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={refresh} />}
        >
          <Text variant="bodySmall" secondary>{current.date?.toDate().toLocaleDateString() ?? ''}</Text>
          {current.sections.map((section, i) => (
            <Card key={i}>
              <Text variant="bodyLarge" weight="semiBold" style={{ marginBottom: spacing.xs }}>{section.title}</Text>
              <Text variant="body" secondary>{section.summary}</Text>
            </Card>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
