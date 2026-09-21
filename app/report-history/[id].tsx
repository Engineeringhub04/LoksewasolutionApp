// Report detail — what the reporter sees after filing a report.
//
// UI only: the fetch, the record shape and the admin-response list are
// unchanged. What changed is that every panel now takes its colour from a Tone
// instead of a fixed hex. The old page painted the response panel #1E2A5A (or
// #8A3F0A) and the question card #EEF2FF, then printed theme-coloured text on
// top — which is why body copy disappeared in one of the two modes. It also
// hid the reason/description inside the content card for question reports and
// showed it as its own section for everything else; both now use the same
// sections, so the page reads identically whatever was reported.
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
import { Preloading } from '@/src/components/Preloading';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { HeroBand, SectionCard, StatusPill, QuotePanel, InfoRow, useTones } from '@/src/components/premium';
import { ReporterBlock } from '@/src/components/report/ReporterBlock';
import { sourceVisual, statusTone, statusIcon, statusKey, targetIcon, targetKey } from '@/src/components/report/reportVisuals';

function formatDate(value: ReportHistoryRecord['createdAt'] | string | null | undefined): string {
  if (!value) return '—';
  if (typeof value === 'string') return value ? new Date(value).toLocaleString() : '—';
  return value.toDate().toLocaleString();
}

export default function ReportHistoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const tones = useTones();
  const { data, loading, settled, refreshing, error, refetch, refresh } = useAsyncData(async () => {
    if (!id) return null;
    return await fetchReportHistory(id);
  }, [id]);

  const record = data ?? null;

  return (
    <>
      <SubpageScrollScreen title={t('discussion.reportDetails')} refreshing={refreshing} onRefresh={refresh}>
        {!settled ? <Preloading tinted={false} label={t('common.loading')} hint={t('loadHints.common')} /> : error || !record ? <DataNotFound onRetry={refetch} /> : (
          <>
            <HeroBand
              icon={statusIcon(record.status)}
              title={t(statusKey(record.status))}
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
                name={record.reporterName}
                email={record.reporterEmail}
                photo={record.reporterPhoto}
                course={record.reporterCourseId}
                subcourse={record.reporterSubcourseId}
              />
            </SectionCard>

            {record.adminResponses.length ? (
              <SectionCard
                icon="shield-checkmark"
                title={t('discussion.adminResponse')}
                subtitle={t('discussion.adminResponseHistory')}
                tone="success"
              >
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
                        trailing={
                          <Text variant="caption" secondary numberOfLines={1}>{formatDate(response.createdAt)}</Text>
                        }
                      >
                        <Text variant="body">{response.message}</Text>
                      </QuotePanel>
                    );
                  })}
                </View>
              </SectionCard>
            ) : (
              <View style={[styles.pendingInfo, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md }]}>
                <Ionicons name="hourglass-outline" size={20} color={colors.textSecondary} />
                <Text variant="bodySmall" secondary style={{ flex: 1 }}>{t('discussion.reportPendingHint')}</Text>
              </View>
            )}
          </>
        )}
      </SubpageScrollScreen>
    </>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  contentHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  smallAvatar: { width: 38, height: 38, borderRadius: 19 },
  pendingInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: StyleSheet.hairlineWidth },
});
