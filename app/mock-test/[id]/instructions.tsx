// §25 Mock Test — pre-test instructions screen.
import React from 'react';
import { View, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchMockTest } from '@/src/core/firebase/services/exams';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';
import { Card } from '@/src/components/cards/Card';
import { ErrorState } from '@/src/components/feedback/ErrorState';
import { Skeleton } from '@/src/components/feedback/Skeleton';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';

export default function MockTestInstructionsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { data: exam, loading, error, refreshing, refetch, refresh } = useAsyncData(() => fetchMockTest(id), [id]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TopAppBar title={t('mockTest.instructions')} />
      {loading ? (
        <View style={{ padding: spacing.screenPadding, gap: spacing.sm }}>
          <Skeleton height={24} width="70%" /><Skeleton height={80} />
        </View>
      ) : error || !exam ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <>
          <ScrollView
            contentContainerStyle={{ padding: spacing.screenPadding, gap: spacing.md }}
            refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={refresh} />}
          >
            <Text variant="h1" weight="bold">{exam.title}</Text>
            <Card style={{ gap: spacing.sm }}>
              <Row label={t('mockTest.duration')} value={`${exam.durationMinutes} min`} />
              <Row label={t('mockTest.questionCount')} value={String(exam.questionIds.length)} />
              <Row label={t('mockTest.markingScheme')} value={exam.markingScheme} />
            </Card>
          </ScrollView>
          <View style={{ padding: spacing.screenPadding }}>
            <Button label={t('mockTest.start')} onPress={() => router.replace(`/mock-test/${id}/attempt`)} />
          </View>
        </>
      )}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text variant="body" secondary>{label}</Text>
      <Text variant="body" weight="semiBold">{value}</Text>
    </View>
  );
}
