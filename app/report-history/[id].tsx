import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
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
  const { data, loading, refreshing, error, refetch, refresh } = useAsyncData(async () => {
    if (!id) return null;
    return await fetchReportHistory(id);
  }, [id]);

  const record = data ?? null;
  const sourceLabel = record?.source === 'question' ? t('discussion.questionReport') : record?.source === 'comment' ? t('discussion.commentReport') : t('discussion.discussionReport');
  const statusColor = record?.status === 'resolved' ? colors.success : record?.status === 'dismissed' ? colors.error : record?.status === 'reviewed' ? colors.primary : colors.warning;
  const statusLabel = record?.status === 'resolved' ? t('discussion.reportResolved') : record?.status === 'dismissed' ? t('discussion.reportDismissed') : record?.status === 'reviewed' ? t('discussion.reportReviewed') : t('discussion.reportPending');

  return (
    <>
      <SubpageScrollScreen title={t('discussion.reportDetails')} refreshing={refreshing} onRefresh={refresh}>
        {loading ? null : error || !record ? <DataNotFound onRetry={refetch} /> : (
          <View style={{ gap: spacing.md }}>
            <View style={[styles.statusBanner, { backgroundColor: `${statusColor}14`, borderColor: statusColor, borderRadius: radius.lg, padding: spacing.md }]}>
              <View style={styles.statusTitle}>
                <Ionicons name={record.status === 'resolved' ? 'checkmark-circle' : 'flag'} size={21} color={statusColor} />
                <Text variant="bodyLarge" weight="bold" style={{ color: statusColor }}>{statusLabel}</Text>
              </View>
              <Text variant="caption" secondary>{sourceLabel} · {record.reason}</Text>
            </View>

            <Card>
              <Text variant="caption" secondary>{t('discussion.reportedContent')}</Text>
              <Text variant="h3" weight="bold" style={{ marginTop: spacing.xs }}>{record.targetTitle || sourceLabel}</Text>
              {record.targetPreview ? <Text variant="body" secondary style={{ marginTop: spacing.sm }}>{record.targetPreview}</Text> : null}
              {record.targetAuthorName ? <Text variant="caption" secondary style={{ marginTop: spacing.sm }}>{t('discussion.reportedBy')} {record.targetAuthorName}</Text> : null}
            </Card>

            <Card>
              <Text variant="caption" secondary>{t('discussion.reportMessage')}</Text>
              <Text variant="bodyLarge" weight="semiBold" style={{ marginTop: spacing.xs }}>{record.reason}</Text>
              <Text variant="body" secondary style={{ marginTop: spacing.sm }}>{record.description || '—'}</Text>
              <Text variant="caption" secondary style={{ marginTop: spacing.sm }}>{record.createdAt?.toDate().toLocaleString() ?? '—'}</Text>
            </Card>

            {record.adminMessage ? (
              <Card style={{ borderColor: colors.primary, borderWidth: 1 }}>
                <View style={styles.responseTitle}>
                  <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
                  <Text variant="bodyLarge" weight="bold" style={{ color: colors.primary }}>{t('discussion.adminResponse')}</Text>
                </View>
                <Text variant="body">{record.adminMessage}</Text>
                {record.reviewedAt ? <Text variant="caption" secondary style={{ marginTop: spacing.sm }}>{t('discussion.reportReviewedOn')} {record.reviewedAt.toDate().toLocaleString()}</Text> : null}
              </Card>
            ) : (
              <View style={[styles.pendingInfo, { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md }]}>
                <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
                <Text variant="bodySmall" secondary style={{ flex: 1 }}>{t('discussion.reportPendingHint')}</Text>
              </View>
            )}
          </View>
        )}
      </SubpageScrollScreen>
      <PageLoaderOverlay visible={loading || refreshing} label={t('common.loading')} />
    </>
  );
}

const styles = StyleSheet.create({
  statusBanner: { gap: 6, borderWidth: 1 },
  statusTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  responseTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  pendingInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
