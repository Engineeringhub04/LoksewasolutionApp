import React, { useState } from 'react';
import { Image, View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchReportHistory, updateReportHistoryReview, type ReportHistoryRecord, type ReportStatus } from '@/src/core/firebase/services/reportHistory';
import { fetchUserProfile } from '@/src/core/firebase/services/profile';
import { fetchUserCourseInfo } from '@/src/core/firebase/services/courses';
import { showToast } from '@/src/core/store/toastStore';
import { SubpageScrollScreen } from '@/src/components/nav/SubpageScrollScreen';
import { Text } from '@/src/components/misc/Text';
import { TextField } from '@/src/components/inputs/TextField';
import { Button } from '@/src/components/buttons/Button';
import { Card } from '@/src/components/cards/Card';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { ConfirmDialog } from '@/src/components/feedback/ConfirmDialog';

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

export default function AdminReportHistoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const { data, loading, error, refetch } = useAsyncData(async () => {
    if (!id) return null;
    const record = await fetchReportHistory(id);
    if (!record) return null;
    const [profile, courseInfo] = await Promise.all([
      fetchUserProfile(record.reporterId).catch(() => null),
      fetchUserCourseInfo(record.reporterId).catch(() => ({ courseId: null, subcourseId: null, courseName: null, subcourseName: null })),
    ]);
    return { record, profile, courseInfo };
  }, [id]);
  const [adminMessage, setAdminMessage] = useState('');
  const [pendingStatus, setPendingStatus] = useState<Exclude<ReportStatus, 'pending'> | null>(null);
  const [busy, setBusy] = useState(false);

  const record = data?.record ?? null;
  const profile = data?.profile ?? null;
  const courseInfo = data?.courseInfo ?? null;
  const sourceLabel = record?.source === 'question' ? t('discussion.questionReport') : record?.source === 'comment' ? t('discussion.commentReport') : t('discussion.discussionReport');
  const statusColor = record?.status === 'resolved' ? colors.success : record?.status === 'dismissed' ? colors.error : record?.status === 'reviewed' ? colors.primary : colors.warning;
  const statusLabel = record?.status === 'resolved' ? t('discussion.reportResolved') : record?.status === 'dismissed' ? t('discussion.reportDismissed') : record?.status === 'reviewed' ? t('discussion.reportReviewed') : t('discussion.reportNew');

  const handleReview = async () => {
    if (!record || !pendingStatus) return;
    setPendingStatus(null);
    setBusy(true);
    try {
      await updateReportHistoryReview(record.id, pendingStatus, adminMessage.trim() || null);
      showToast(t('discussion.reportUpdated'), 'success');
      setAdminMessage('');
      await refetch();
    } catch {
      showToast(t('common.somethingWentWrong'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SubpageScrollScreen title={t('discussion.reportDetails')}>
        {loading ? null : error || !record ? <DataNotFound onRetry={refetch} /> : (
          <View style={{ gap: spacing.md }}>
            <View style={[styles.statusBanner, { backgroundColor: `${statusColor}14`, borderColor: statusColor, borderRadius: radius.lg, padding: spacing.md }]}>
              <View style={styles.statusTitle}><Ionicons name={record.status === 'resolved' ? 'checkmark-circle' : 'flag'} size={21} color={statusColor} /><Text variant="bodyLarge" weight="bold" style={{ color: statusColor }}>{statusLabel}</Text></View>
              <Text variant="caption" secondary>{sourceLabel} · {record.reason}</Text>
            </View>

            <Card style={styles.sectionCard}>
              <View style={styles.sectionHeading}><Ionicons name="person-circle-outline" size={19} color={colors.primary} /><Text variant="bodyLarge" weight="bold">{t('discussion.reporterDetails')}</Text></View>
              <View style={styles.profileRow}>
                {profile?.photoURL || record.reporterPhoto ? <Image source={{ uri: profile?.photoURL || record.reporterPhoto || undefined }} style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: `${colors.primary}15` }]}><Ionicons name="person" size={22} color={colors.primary} /></View>}
                <View style={{ flex: 1, gap: 3 }}>
                  <Text variant="bodyLarge" weight="bold">{profile?.name || record.reporterName}</Text>
                  <Text variant="bodySmall" secondary>{profile?.email || record.reporterEmail || '—'}</Text>
                  <Text variant="caption" secondary>{courseInfo?.courseName || record.reporterCourseId || '—'} · {courseInfo?.subcourseName || record.reporterSubcourseId || '—'}</Text>
                </View>
              </View>
            </Card>

            <Card style={styles.sectionCard}>
              <View style={styles.sectionHeading}><Ionicons name="document-text-outline" size={19} color={colors.primary} /><Text variant="bodyLarge" weight="bold">{t('discussion.reportedContent')}</Text></View>
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
              <View style={styles.sectionHeading}><Ionicons name="information-circle-outline" size={19} color={colors.primary} /><Text variant="bodyLarge" weight="bold">{t('discussion.reportMessage')}</Text></View>
              <Text variant="bodyLarge" weight="bold" style={{ marginTop: spacing.sm }}>{record.reason}</Text>
              <Text variant="body" secondary style={{ marginTop: spacing.sm }}>{record.description || '—'}</Text>
              <Text variant="caption" secondary style={{ marginTop: spacing.sm }}>{formatDate(record.createdAt)}</Text>
            </Card>

            <View style={[styles.actionPanel, { backgroundColor: colors.surface, borderColor: colors.primary, borderRadius: radius.lg, padding: spacing.md }]}>
              <Text variant="bodyLarge" weight="bold">{t('discussion.adminResponse')}</Text>
              <TextField label={t('discussion.customAdminMessage')} placeholder={t('discussion.customAdminMessagePlaceholder')} value={adminMessage} onChangeText={setAdminMessage} multiline numberOfLines={4} containerStyle={{ marginTop: spacing.sm }} />
              <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                <Button label={t('discussion.resolveReport')} onPress={() => setPendingStatus('resolved')} loading={busy} />
                <Button label={t('discussion.markReviewed')} variant="secondary" onPress={() => setPendingStatus('reviewed')} loading={busy} />
                <Button label={t('discussion.dismissReport')} variant="danger" onPress={() => setPendingStatus('dismissed')} loading={busy} />
              </View>
            </View>

            {record.adminResponses.length ? (
              <View style={[styles.responsePanel, { backgroundColor: '#8A3F0A', borderRadius: radius.lg, padding: spacing.md }]}>
                <View style={styles.sectionHeading}><Ionicons name="shield-checkmark" size={19} color="#FFD7B0" /><Text variant="bodyLarge" weight="bold" style={{ color: '#FFD7B0' }}>{t('discussion.adminResponseHistory')}</Text></View>
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
            ) : null}
          </View>
        )}
      </SubpageScrollScreen>
      <PageLoaderOverlay visible={loading || busy} label={t('common.loading')} />
      <ConfirmDialog visible={Boolean(pendingStatus)} title={t('discussion.confirmReportUpdate')} message={t('discussion.confirmReportUpdateMessage')} onConfirm={handleReview} onCancel={() => setPendingStatus(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  statusBanner: { gap: 6, borderWidth: 1 },
  statusTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionCard: { gap: 2 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 10 },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  targetTag: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginTop: 10 },
  actionPanel: { borderWidth: 1 },
  responsePanel: { gap: 2 },
  responseItem: { borderWidth: 1, borderColor: '#C56A2A' },
  responseMeta: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
});
