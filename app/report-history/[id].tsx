import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchReportHistory } from '@/src/core/firebase/services/reportHistory';
import { SubpageScrollScreen } from '@/src/components/nav/SubpageScrollScreen';
import { Text } from '@/src/components/misc/Text';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { Card } from '@/src/components/cards/Card';

export default function ReportHistoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const { data, loading, refreshing, error, refetch, refresh } = useAsyncData(() => fetchReportHistory(id), [id]);

  return (
    <>
      <SubpageScrollScreen title={t('discussion.reportDetails')} refreshing={refreshing} onRefresh={refresh}>
        {error || !data ? <DataNotFound onRetry={refetch} /> : (
          <View style={{ gap: spacing.md }}>
            <Card>
              <Text variant="caption" secondary>{t('discussion.reportType')}</Text>
              <Text variant="h3" weight="bold">{data.source === 'question' ? t('discussion.questionReport') : data.source === 'comment' ? t('discussion.commentReport') : t('discussion.discussionReport')}</Text>
              <Text variant="caption" secondary>{data.createdAt?.toDate().toLocaleString() ?? '—'}</Text>
            </Card>
            <Card>
              <Text variant="caption" secondary>{t('discussion.reportedContent')}</Text>
              <Text variant="bodyLarge" weight="semiBold">{data.targetTitle ?? data.targetType}</Text>
              {data.targetPreview ? <Text variant="body" secondary style={{ marginTop: spacing.sm }}>{data.targetPreview}</Text> : null}
              {data.targetAuthorName ? <Text variant="caption" secondary style={{ marginTop: spacing.sm }}>{t('discussion.reportedBy')} {data.targetAuthorName}</Text> : null}
            </Card>
            <Card>
              <Text variant="caption" secondary>{t('discussion.reason')}</Text>
              <Text variant="body">{data.reason}</Text>
              {data.description ? <Text variant="body" secondary style={{ marginTop: spacing.sm }}>{data.description}</Text> : null}
            </Card>
            <View style={{ padding: spacing.md, borderRadius: radius.md, backgroundColor: `${statusColor(data.status, colors)}18` }}><Text variant="body" weight="bold" style={{ color: statusColor(data.status, colors) }}>{statusLabel(data.status, t)}</Text></View>
            {data.adminMessage ? <Card><Text variant="caption" secondary>{t('discussion.adminResponse')}</Text><Text variant="body">{data.adminMessage}</Text></Card> : null}
          </View>
        )}
      </SubpageScrollScreen>
      <PageLoaderOverlay visible={loading || refreshing} label={t('common.loading')} />
    </>
  );
}

function statusColor(status: string, colors: ReturnType<typeof useTheme>['colors']): string {
  return status === 'resolved' ? colors.success : status === 'dismissed' ? colors.error : colors.warning;
}

function statusLabel(status: string, t: (key: string) => string): string {
  return status === 'resolved' ? t('discussion.reportResolved') : status === 'dismissed' ? t('discussion.reportDismissed') : status === 'reviewed' ? t('discussion.reportReviewed') : t('discussion.reportPending');
}
