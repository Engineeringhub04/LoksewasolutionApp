import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
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

function targetIcon(record: ReportHistoryRecord): keyof typeof Ionicons.glyphMap {
  if (record.targetType === 'question') return 'help-circle-outline';
  if (record.targetType === 'post') return 'chatbubbles-outline';
  if (record.targetType === 'reply') return 'return-down-forward-outline';
  return 'chatbubble-ellipses-outline';
}

function statusLabel(status: ReportHistoryRecord['status'], t: (key: string) => string): string {
  if (status === 'resolved') return t('discussion.reportResolved');
  if (status === 'dismissed') return t('discussion.reportDismissed');
  if (status === 'reviewed') return t('discussion.reportReviewed');
  return t('discussion.reportPending');
}

function ProfileLine({ name, email, photo, course, subcourse, colors }: { name: string; email?: string | null; photo?: string | null; course?: string | null; subcourse?: string | null; colors: ReturnType<typeof useTheme>['colors'] }) {
  return (
    <View style={styles.profileRow}>
      {photo ? <Image source={{ uri: photo }} style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: `${colors.primary}16` }]}><Ionicons name="person" size={22} color={colors.primary} /></View>}
      <View style={{ flex: 1, gap: 3 }}>
        <Text variant="bodyLarge" weight="bold" numberOfLines={1}>{name || '—'}</Text>
        <Text variant="bodySmall" secondary numberOfLines={1}>{email || '—'}</Text>
        <Text variant="caption" secondary numberOfLines={1}>{course || '—'} · {subcourse || '—'}</Text>
      </View>
    </View>
  );
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
  const isQuestionReport = record?.source === 'question' || record?.targetType === 'question';
  const responsePalette = isQuestionReport
    ? { panel: '#1E2A5A', active: '#344A86', previous: '#172044', border: '#7186D6', title: '#E2EAFF', muted: '#C5D2FF' }
    : { panel: '#8A3F0A', active: '#A85212', previous: '#743308', border: '#C56A2A', title: '#FFD7B0', muted: '#FFE9D6' };
  const questionContentPalette = { card: '#EEF2FF', border: '#7186D6', icon: '#2449A8', iconBackground: '#DCE6FF', divider: '#B9C8F2', heading: '#1E2A5A' };

  return (
    <>
      <SubpageScrollScreen title={t('discussion.reportDetails')} refreshing={refreshing} onRefresh={refresh}>
        {loading ? null : error || !record ? <DataNotFound onRetry={refetch} /> : (
          <View style={{ gap: spacing.md }}>
            <View style={[styles.statusBanner, { backgroundColor: `${statusColor}14`, borderColor: statusColor, borderRadius: radius.lg, padding: spacing.md }]}>
              <View style={styles.statusTitle}>
                <Ionicons name={record.status === 'resolved' ? 'checkmark-circle' : 'flag'} size={22} color={statusColor} />
                <Text variant="bodyLarge" weight="bold" style={{ color: statusColor }}>{statusLabel(record.status, t)}</Text>
              </View>
              <Text variant="caption" secondary>{sourceLabel} · {record.reason}</Text>
            </View>

            <Card style={styles.sectionCard}>
              <View style={styles.sectionHeading}><Ionicons name={isQuestionReport ? 'school-outline' : 'document-text-outline'} size={20} color={isQuestionReport ? questionContentPalette.icon : colors.primary} /><Text variant="bodyLarge" weight="bold">{t('discussion.reportedContent')}</Text></View>
              <View style={[styles.targetTag, { backgroundColor: isQuestionReport ? questionContentPalette.iconBackground : `${colors.primary}16` }]}>
                <Ionicons name={targetIcon(record)} size={16} color={isQuestionReport ? questionContentPalette.icon : colors.primary} />
                <Text variant="caption" weight="bold" style={{ color: isQuestionReport ? questionContentPalette.icon : colors.primary }}>{targetLabel(record, t)}</Text>
              </View>
              <View style={[styles.contentCard, { backgroundColor: isQuestionReport ? questionContentPalette.card : colors.surfaceAlt, borderColor: isQuestionReport ? questionContentPalette.border : `${colors.primary}28`, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm }]}>
                <View style={styles.contentHeader}>
                  {isQuestionReport ? <View style={[styles.questionIconWrap, { backgroundColor: questionContentPalette.iconBackground, borderColor: questionContentPalette.border }]}><Ionicons name="school-outline" size={25} color={questionContentPalette.icon} /></View> : record.targetAuthorPhoto ? <Image source={{ uri: record.targetAuthorPhoto }} style={styles.smallAvatar} /> : <View style={[styles.smallAvatar, styles.avatarFallback, { backgroundColor: `${colors.primary}16` }]}><Ionicons name="person" size={16} color={colors.primary} /></View>}
                  <View style={{ flex: 1 }}>
                    <Text variant="body" weight="bold" numberOfLines={2} style={isQuestionReport ? { color: questionContentPalette.heading } : undefined}>{record.targetTitle || targetLabel(record, t)}</Text>
                    <Text variant="caption" secondary numberOfLines={1}>{isQuestionReport ? t('discussion.questionReport') : `${record.targetAuthorName || '—'} · ${formatDate(record.createdAt)}`}</Text>
                  </View>
                </View>
                <Text variant="body" style={{ marginTop: spacing.sm }}>{record.targetPreview || '—'}</Text>
                <Text variant="caption" secondary style={{ marginTop: spacing.sm }}>{t('discussion.targetKind')}: {targetLabel(record, t)} · ID: {record.targetId}</Text>
                {isQuestionReport ? (
                  <View style={[styles.questionReportDetails, { borderTopColor: questionContentPalette.divider }]}>
                    <View style={styles.questionDetailRow}><Ionicons name="flag-outline" size={17} color={questionContentPalette.icon} /><Text variant="caption" weight="bold" style={{ color: questionContentPalette.heading }}>{t('discussion.reason')}: {record.reason}</Text></View>
                    <Text variant="bodySmall" secondary>{record.description || '—'}</Text>
                    <Text variant="caption" secondary>{formatDate(record.createdAt)}</Text>
                  </View>
                ) : null}
              </View>
            </Card>

            <Card style={styles.sectionCard}>
              <View style={styles.sectionHeading}><Ionicons name="person-circle-outline" size={20} color={colors.primary} /><Text variant="bodyLarge" weight="bold">{t('discussion.reporterDetails')}</Text></View>
              <ProfileLine name={record.reporterName} email={record.reporterEmail} photo={record.reporterPhoto} course={record.reporterCourseId} subcourse={record.reporterSubcourseId} colors={colors} />
            </Card>

            {!isQuestionReport ? (
              <Card style={styles.sectionCard}>
                <View style={styles.sectionHeading}><Ionicons name="information-circle-outline" size={20} color={colors.primary} /><Text variant="bodyLarge" weight="bold">{t('discussion.reportMessage')}</Text></View>
                <Text variant="bodyLarge" weight="bold" style={{ marginTop: spacing.sm }}>{record.reason}</Text>
                <Text variant="body" secondary style={{ marginTop: spacing.sm }}>{record.description || '—'}</Text>
                <Text variant="caption" secondary style={{ marginTop: spacing.sm }}>{formatDate(record.createdAt)}</Text>
              </Card>
            ) : null}

            {record.adminResponses.length ? (
              <View style={[styles.responsePanel, { backgroundColor: responsePalette.panel, borderColor: responsePalette.border, borderRadius: radius.lg, padding: spacing.md }]}>
                <View style={styles.sectionHeading}><Ionicons name={isQuestionReport ? 'school-outline' : 'shield-checkmark'} size={20} color={responsePalette.title} /><Text variant="bodyLarge" weight="bold" style={{ color: responsePalette.title }}>{isQuestionReport ? t('discussion.questionResponse') : t('discussion.adminResponse')}</Text></View>
                <Text variant="caption" style={{ color: responsePalette.muted, marginTop: spacing.xs }}>{isQuestionReport ? t('discussion.questionResponseHistory') : t('discussion.adminResponseHistory')}</Text>
                <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                  {record.adminResponses.map((response, index) => (
                    <View key={response.id} style={[styles.responseItem, { backgroundColor: index === record.adminResponses.length - 1 ? responsePalette.active : responsePalette.previous, borderColor: responsePalette.border, borderRadius: radius.md, padding: spacing.sm }]}>
                      <View style={styles.responseMeta}><Text variant="caption" weight="bold" style={{ color: responsePalette.title }}>{statusLabel(response.status, t)}</Text><Text variant="caption" style={{ color: responsePalette.muted }}>{formatDate(response.createdAt)}</Text></View>
                      <Text variant="body" style={{ color: '#FFFFFF', marginTop: spacing.xs }}>{response.message}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : <View style={[styles.pendingInfo, { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md }]}><Ionicons name="time-outline" size={20} color={colors.textSecondary} /><Text variant="bodySmall" secondary style={{ flex: 1 }}>{t('discussion.reportPendingHint')}</Text></View>}
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
  contentCard: { borderWidth: 1 },
  contentHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 10 },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  smallAvatar: { width: 36, height: 36, borderRadius: 18 },
  questionIconWrap: { width: 52, height: 52, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  questionReportDetails: { gap: 7, borderTopWidth: 1, marginTop: 12, paddingTop: 12 },
  questionDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  responsePanel: { gap: 2 },
  responseItem: { borderWidth: 1, borderColor: '#C56A2A' },
  responseMeta: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  pendingInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
