// Admin report detail — review one report and answer the reporter.
//
// UI only. handleReview is byte-for-byte the same flow as before: the status
// write, then the honest toast that distinguishes "reporter notified" from
// "saved to their notifications". What changed is the shell around it: the
// hardcoded response panels (#1E2A5A / #8A3F0A / #EEF2FF, with '#FFFFFF' text
// forced on top) are gone in favour of toned panels, so the page is readable in
// light mode — and the action panel is now the visual anchor it should be,
// since answering the report is the entire reason this page exists.
import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
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
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { Preloading } from '@/src/components/Preloading';
import { ConfirmDialog } from '@/src/components/feedback/ConfirmDialog';
import { HeroBand, SectionCard, StatusPill, QuotePanel, InfoRow, useTones } from '@/src/components/premium';
import { ReporterBlock } from '@/src/components/report/ReporterBlock';
import { sourceVisual, statusTone, statusIcon, statusKey, targetIcon, targetKey } from '@/src/components/report/reportVisuals';

function formatDate(value: ReportHistoryRecord['createdAt'] | string | null | undefined): string {
  if (!value) return '—';
  if (typeof value === 'string') return value ? new Date(value).toLocaleString() : '—';
  return value.toDate().toLocaleString();
}

export default function AdminReportHistoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const tones = useTones();
  const { data, loading, settled, refreshing, error, refetch, refresh } = useAsyncData(async () => {
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

  const handleReview = async () => {
    if (!record || !pendingStatus) return;
    setPendingStatus(null);
    setBusy(true);
    try {
      const delivery = await updateReportHistoryReview(record.id, pendingStatus, adminMessage.trim() || null);
      // The status write is what can actually fail; notifying is separate and
      // best-effort. The toast says which of the two happened instead of
      // claiming the reporter was alerted when their phone was never reached.
      showToast(
        delivery.pushOk > 0
          ? t('discussion.reportUpdatedNotified')
          : delivery.inboxId
            ? t('discussion.reportUpdatedInboxOnly')
            : t('discussion.reportUpdated'),
        'success',
      );
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
      <SubpageScrollScreen title={t('discussion.reportDetails')} refreshing={refreshing} onRefresh={refresh}>
        {!settled ? <Preloading tinted={false} label={t('common.loading')} hint={t('loadHints.common')} /> : error || !record ? <DataNotFound onRetry={refetch} /> : (
          <>
            <HeroBand
              icon={record.status === 'pending' ? 'sparkles' : statusIcon(record.status)}
              title={record.status === 'pending' ? t('discussion.reportNew') : t(statusKey(record.status))}
              subtitle={record.contextLabel || t(`report.src.${record.source}`)}
              tone={statusTone(record.status)}
              footer={
                <>
                  <StatusPill
                    label={t(`report.src.${record.source}`)}
                    tone={sourceVisual(record.source).tone}
                    icon={sourceVisual(record.source).icon}
                    size="sm"
                  />
                  <StatusPill label={record.reason} tone="neutral" icon="flag-outline" size="sm" />
                  <StatusPill label={formatDate(record.createdAt)} tone="neutral" icon="calendar-outline" size="sm" />
                </>
              }
            />

            {/* The answer box comes FIRST for an admin: on the old page it sat
                below three read-only cards, so every review meant scrolling
                past content you had already read. */}
            <SectionCard
              icon="create-outline"
              title={t('discussion.adminResponse')}
              subtitle={t('discussion.customAdminMessagePlaceholder')}
              tone="primary"
            >
              <TextField
                value={adminMessage}
                onChangeText={setAdminMessage}
                placeholder={t('discussion.customAdminMessage')}
                multiline
                numberOfLines={4}
                style={{ minHeight: 104, textAlignVertical: 'top' }}
              />
              <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
                <Button label={t('discussion.resolveReport')} onPress={() => setPendingStatus('resolved')} loading={busy} />
                <Button label={t('discussion.markReviewed')} variant="secondary" onPress={() => setPendingStatus('reviewed')} loading={busy} />
                <Button label={t('discussion.dismissReport')} variant="danger" onPress={() => setPendingStatus('dismissed')} loading={busy} />
              </View>
            </SectionCard>

            <SectionCard
              icon={targetIcon(record.targetType)}
              title={t('discussion.reportedContent')}
              tone={sourceVisual(record.source).tone}
              trailing={<StatusPill label={t(targetKey(record.targetType))} tone={sourceVisual(record.source).tone} size="sm" />}
            >
              <QuotePanel tone={sourceVisual(record.source).tone} spine>
                <View style={styles.contentHeader}>
                  {record.targetAuthorPhoto ? (
                    <Image source={{ uri: record.targetAuthorPhoto }} style={styles.smallAvatar} />
                  ) : (
                    <View style={[styles.smallAvatar, styles.center, { backgroundColor: tones.primary.bg }]}>
                      <Ionicons name={targetIcon(record.targetType)} size={17} color={tones.primary.fg} />
                    </View>
                  )}
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="body" weight="bold" numberOfLines={2}>{record.targetTitle || t(targetKey(record.targetType))}</Text>
                    <Text variant="caption" secondary numberOfLines={1}>
                      {record.targetAuthorName || t(`report.src.${record.source}`)} · {formatDate(record.createdAt)}
                    </Text>
                  </View>
                </View>
                <Text variant="body" style={{ marginTop: 2 }}>{record.targetPreview || '—'}</Text>
              </QuotePanel>
              <View style={{ marginTop: spacing.xs }}>
                <InfoRow icon="pricetag-outline" label={t('discussion.targetKind')} value={t(targetKey(record.targetType))} divider />
                <InfoRow icon="finger-print-outline" label={t('report.reportId')} value={record.targetId} />
              </View>
            </SectionCard>

            <SectionCard icon="information-circle-outline" title={t('discussion.reportMessage')} tone="warning">
              <InfoRow icon="flag-outline" label={t('discussion.reason')} value={record.reason} tone="warning" divider />
              <InfoRow label={t('report.explanationLabel')} value={record.description || '—'} stacked divider />
              <InfoRow icon="time-outline" label={t('report.submittedOn')} value={formatDate(record.createdAt)} />
            </SectionCard>

            <SectionCard icon="person-circle-outline" title={t('discussion.reporterDetails')} tone="info">
              <ReporterBlock
                name={profile?.name || record.reporterName}
                email={profile?.email || record.reporterEmail}
                photo={profile?.photoURL || record.reporterPhoto}
                course={courseInfo?.courseName || record.reporterCourseId}
                subcourse={courseInfo?.subcourseName || record.reporterSubcourseId}
              />
            </SectionCard>

            {record.adminResponses.length ? (
              <SectionCard icon="shield-checkmark" title={t('discussion.adminResponseHistory')} tone="success">
                <View style={{ gap: spacing.sm }}>
                  {record.adminResponses.map((response, index) => {
                    const latest = index === record.adminResponses.length - 1;
                    return (
                      <QuotePanel
                        key={response.id}
                        tone={statusTone(response.status)}
                        spine={latest}
                        caption={t(statusKey(response.status))}
                        icon={statusIcon(response.status)}
                        trailing={<Text variant="caption" secondary numberOfLines={1}>{formatDate(response.createdAt)}</Text>}
                      >
                        <Text variant="body">{response.message}</Text>
                      </QuotePanel>
                    );
                  })}
                </View>
              </SectionCard>
            ) : (
              <View style={[styles.pendingInfo, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md }]}>
                <Ionicons name="chatbox-ellipses-outline" size={20} color={colors.textSecondary} />
                <Text variant="bodySmall" secondary style={{ flex: 1 }}>{t('report.noResponseYet')}</Text>
              </View>
            )}
          </>
        )}
      </SubpageScrollScreen>
      <PageLoaderOverlay visible={busy} label={t('common.loading')} />
      <ConfirmDialog visible={Boolean(pendingStatus)} title={t('discussion.confirmReportUpdate')} message={t('discussion.confirmReportUpdateMessage')} onConfirm={handleReview} onCancel={() => setPendingStatus(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  contentHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  smallAvatar: { width: 38, height: 38, borderRadius: 19 },
  pendingInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: StyleSheet.hairlineWidth },
});
