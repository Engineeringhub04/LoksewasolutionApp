// Admin → Report Details Control: every report from every user, newest first.
//
// UI only. The two things that were actually wrong here: the segmented track
// was a fixed three-up row that squeezed its labels on small screens, and the
// status chip printed the raw Firestore value (`resolved`, `dismissed`) for
// anything that was not pending — untranslated, lowercase, straight from the
// document. Both now go through the shared report visuals table.
import React, { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { FadeInDown } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchAllReportHistory, type ReportHistoryRecord } from '@/src/core/firebase/services/reportHistory';
import { SubpageScrollScreen } from '@/src/components/nav/SubpageScrollScreen';
import { Text } from '@/src/components/misc/Text';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { Preloading } from '@/src/components/Preloading';
import { HeroBand, SectionCard, StatTile, StatusPill, FilterTrack, useTones } from '@/src/components/premium';
import { sourceVisual, statusTone, statusIcon, statusKey } from '@/src/components/report/reportVisuals';

const TRACKS = ['all', 'question', 'discussion'] as const;
type Track = (typeof TRACKS)[number];

export default function AdminReportHistoryScreen() {
  const { spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [track, setTrack] = useState<Track>('all');
  const { data, loading, settled, refreshing, error, refetch, refresh } = useAsyncData(fetchAllReportHistory, []);

  const records = useMemo(() => {
    const all = data ?? [];
    if (track === 'all') return all;
    return all.filter((record) => track === 'question' ? record.source === 'question' : record.source !== 'question');
  }, [data, track]);

  const all = useMemo(() => data ?? [], [data]);

  // Presentational only — the queue is useless without knowing how much of it
  // is still waiting on someone.
  const tally = useMemo(() => ({
    total: all.length,
    pending: all.filter((record) => record.status === 'pending').length,
    resolved: all.filter((record) => record.status === 'resolved').length,
    question: all.filter((record) => record.source === 'question').length,
  }), [all]);

  const filterItems = useMemo(
    () => [
      { value: 'all' as Track, label: t('discussion.allReports'), count: tally.total },
      { value: 'question' as Track, label: t('discussion.questionReports'), count: tally.question },
      { value: 'discussion' as Track, label: t('discussion.discussionReports'), count: tally.total - tally.question },
    ],
    [tally, t],
  );

  return (
    <>
      <SubpageScrollScreen title={t('discussion.reportDetailsControl')} refreshing={refreshing} onRefresh={refresh}>
        {!settled ? (
          <View style={{ flex: 1 }}>
            <Preloading tinted={false} label={t('common.loading')} hint={t('loadHints.common')} />
          </View>
        ) : (
        <>
        <HeroBand
          icon="shield-checkmark"
          title={t('discussion.reportDetailsControl')}
          subtitle={t('discussion.reportDetailsControlHint')}
          tone="info"
          footer={
            <>
              <StatTile grow value={tally.total} label={t('discussion.allReports')} icon="documents-outline" tone="info" />
              <StatTile grow value={tally.pending} label={t('discussion.reportNew')} icon="sparkles-outline" tone="warning" />
              <StatTile grow value={tally.resolved} label={t('discussion.reportResolved')} icon="checkmark-done-outline" tone="success" />
            </>
          }
        />

        <View style={{ marginHorizontal: -spacing.screenPadding }}>
          <FilterTrack items={filterItems} value={track} onChange={setTrack} />
        </View>

        {error ? <DataNotFound onRetry={refetch} /> : records.length === 0 ? <EmptyState /> : (
          <View style={{ gap: spacing.sm }}>
            {records.map((record, index) => (
              <AdminReportCard key={record.id} record={record} index={index} onPress={() => router.push(`/admin/report-history/${record.id}`)} />
            ))}
          </View>
        )}
        </>
        )}
      </SubpageScrollScreen>
    </>
  );
}

function EmptyState() {
  const { spacing } = useTheme();
  const { t } = useTranslation();
  const tones = useTones();
  return (
    <SectionCard style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
      <View style={[styles.emptyBadge, { backgroundColor: tones.info.bg, borderColor: tones.info.border }]}>
        <Ionicons name="flag-outline" size={30} color={tones.info.fg} />
      </View>
      <Text variant="bodyLarge" weight="bold" style={{ marginTop: spacing.md }}>{t('discussion.noReports')}</Text>
      <Text variant="bodySmall" secondary style={{ textAlign: 'center', marginTop: 4 }}>{t('discussion.noReportsSubtitle')}</Text>
    </SectionCard>
  );
}

function AdminReportCard({ record, index, onPress }: { record: ReportHistoryRecord; index: number; onPress: () => void }) {
  const { colors, spacing, radius, elevation } = useTheme();
  const { t } = useTranslation();
  const tones = useTones();
  const visual = sourceVisual(record.source);
  const source = tones[visual.tone];
  const isNew = record.status === 'pending';
  const origin = record.contextLabel || t(`report.src.${record.source}`);
  const targetLabel = record.targetTitle || record.targetPreview || origin;

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 45).duration(300)}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          elevation[1],
          {
            backgroundColor: pressed ? source.bg : colors.surface,
            borderColor: isNew ? tones.warning.border : pressed ? source.border : colors.border,
            borderRadius: radius.lg,
            padding: spacing.md,
          },
        ]}
      >
        <View style={styles.cardTop}>
          {record.reporterPhoto ? (
            <Image source={{ uri: record.reporterPhoto }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.center, { backgroundColor: source.bg, borderColor: source.border, borderWidth: StyleSheet.hairlineWidth }]}>
              <Ionicons name="person" size={20} color={source.fg} />
            </View>
          )}
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="bodyLarge" weight="bold" numberOfLines={1}>{record.reporterName}</Text>
            <Text variant="caption" secondary numberOfLines={1}>{record.reporterEmail || '—'}</Text>
            <Text variant="caption" style={{ color: colors.textDisabled }} numberOfLines={1}>
              {record.reporterCourseId || '—'} · {record.reporterSubcourseId || '—'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={19} color={colors.textDisabled} />
        </View>

        <View style={[styles.targetBlock, { backgroundColor: source.bg, borderColor: source.border, borderRadius: radius.md, padding: spacing.sm }]}>
          <View style={styles.originRow}>
            <Ionicons name={visual.icon} size={13} color={source.fg} />
            <Text variant="overline" weight="bold" numberOfLines={1} style={{ color: source.fg, flex: 1, letterSpacing: 0.6 }}>
              {origin.toUpperCase()}
            </Text>
          </View>
          <Text variant="bodySmall" weight="semiBold" numberOfLines={2}>{targetLabel}</Text>
        </View>

        <View style={[styles.cardBottom, { borderTopColor: colors.divider, paddingTop: spacing.sm }]}>
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={13} color={colors.textDisabled} />
            <Text variant="caption" secondary>{record.createdAt?.toDate().toLocaleDateString() ?? '—'}</Text>
          </View>
          <StatusPill
            label={isNew ? t('discussion.reportNew') : t(statusKey(record.status))}
            tone={statusTone(record.status)}
            icon={isNew ? 'sparkles' : statusIcon(record.status)}
            variant={isNew ? 'solid' : 'soft'}
            size="sm"
          />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  emptyBadge: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  card: { borderWidth: StyleSheet.hairlineWidth, gap: 10, overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  targetBlock: { gap: 4, borderWidth: StyleSheet.hairlineWidth },
  originRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
