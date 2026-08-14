import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchReportHistory, type ReportHistoryRecord } from '@/src/core/firebase/services/reportHistory';
import { SubpageScrollScreen } from '@/src/components/nav/SubpageScrollScreen';
import { Text } from '@/src/components/misc/Text';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { Card } from '@/src/components/cards/Card';

function formatDate(value: ReportHistoryRecord['createdAt'] | string | null | undefined): string {
  if (!value) return '—';
  if (typeof value === 'string') return value ? new Date(value).toLocaleString() : '—';
  return value.toDate().toLocaleString();
}

function targetLabel(record: ReportHistoryRecord, t: (key: string) => string): string {
  if (record.targetType === 'question') return t('discussion.reportTargetQuestion');
  if (record.targetType === 'post') return t('discussion.reportTargetPost');
  if (record.targetType === 'reply') return t('discussion.reportTargetReply');
  return t('discussion.reportTargetComment');
}

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

            <Card style={styles.sectionCard}>
              <View style={styles.sectionHeading}>
                <Ionicons name="document-text-outline" size={19} color={colors.primary} />
                <Text variant="bodyLarge" weight="bold">{t('discussion.reportedContent')}</Text>
              </View>
              <View style={[styles.targetTag, { backgroundColor: `${colors.primary}14` }]}>
                <Ionicons name={record.targetType === 'question' ? 'help-circle-outline' : 'chatbubble-ellipses-outline'} size={15} color={colors.primary} />
                <Text variant="caption" weight="bold" style={{ color: colors.primary }}>{targetLabel(record, t)}</Text>
              </View>
              <Text variant="h3" weight="bold" style={{ marginTop: spacing.sm }}>{record.targetTitle || sourceLabel}</Text>
              {record.targetPreview ? <Text variant="body" secondary style={{ marginTop: spacing.sm }}>{record.targetPreview}</Text> : null}
              {record.targetAuthorName ? <Text variant="caption" secondary style={{ marginTop: spacing.sm }}>{t('discussion.reportedBy')} {record.targetAuthorName}</Text> : null}
              <Text variant="caption" secondary style={{ marginTop: spacing.sm }}>{t('discussion.targetKind')}: {targetLabel(record, t)} · ID: {record.targetId}</Text>
            </Card>

            <Card style={styles.sectionCard}>
              <View style={styles.sectionHeading}>
                <Ionicons name="information-circle-outline" size={19} color={colors.primary} />
                <Text variant="bodyLarge" weight="bold">{t('discussion.reportMessage')}</Text>
              </View>
              <Text variant="bodyLarge" weight="bold" style={{ marginTop: spacing.sm }}>{record.reason}</Text>
              <Text variant="body" secondary style={{ marginTop: spacing.sm }}>{record.description || '—'}</Text>
              <Text variant="caption" secondary style={{ marginTop: spacing.sm }}>{formatDate(record.createdAt)}</Text>
            </Card>

            {record.adminResponses.length ? (
              <View style={[styles.responsePanel, { backgroundColor: '#8A3F0A', borderRadius: radius.lg, padding: spacing.md }]}>
                <View style={styles.sectionHeading}>
                  <Ionicons name="shield-checkmark" size={19} color="#FFD7B0" />
                  <Text variant="bodyLarge" weight="bold" style={{ color: '#FFD7B0' }}>{t('discussion.adminResponse')}</Text>
                </View>
                <Text variant="caption" style={{ color: '#FFE9D6', marginTop: spacing.xs }}>{t('discussion.adminResponseHistory')}</Text>
                <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                  {record.adminResponses.map((response, index) => (
                    <View key={response.id} style={[styles.responseItem, { backgroundColor: index === record.adminResponses.length - 1 ? '#A85212' : '#743308', borderRadius: radius.md, padding: spacing.sm }]}>
                      <View style={styles.responseMeta}>
                        <Text variant="caption" weight="bold" style={{ color: '#FFD7B0' }}>{response.status === 'resolved' ? t('discussion.reportResolved') : response.status === 'dismissed' ? t('discussion.reportDismissed') : t('discussion.reportReviewed')}</Text>
                        <Text variant="caption" style={{ color: '#FFE9D6' }}>{formatDate(response.createdAt)}</Text>
                      </View>
                      <Text variant="body" style={{ color: '#FFFFFF', marginTop: spacing.xs }}>{response.message}</Text>
                    </View>
                  ))}
                </View>
              </View>
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
  sectionCard: { gap: 2 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  targetTag: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginTop: 10 },
  responsePanel: { gap: 2 },
  responseItem: { borderWidth: 1, borderColor: '#C56A2A' },
  responseMeta: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  pendingInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
