// Your Report History — one feed for every report context.
//
// WHY the tracks are derived instead of hardcoded: this page used to offer three
// fixed tabs (All / Questions / Discussion) and labelled anything that was not a
// question or a comment as "Discussion report". That silently mislabelled app
// bugs, reading-page reports and article reports — and, worse, an app-problem
// report had no tab of its own. Tracks are now built from the sources actually
// present in the user's history, so a new context shows up here automatically the
// first time the user files a report from it. No screen has to register itself.
//
// The visuals are the premium kit (HeroBand / FilterTrack / StatusPill) and every
// colour resolves through a Tone, so the feed reads the same in light and dark.
import React, { useMemo, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { FadeInDown } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { useProfileStore } from '@/src/core/store/profileStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { useRefreshOnFocus } from '@/src/core/hooks/useRefreshOnFocus';
import { fetchMyReportHistory, type ReportHistoryRecord, type ReportSource } from '@/src/core/firebase/services/reportHistory';
import { SubpageScrollScreen } from '@/src/components/nav/SubpageScrollScreen';
import { Text } from '@/src/components/misc/Text';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { Preloading } from '@/src/components/Preloading';
import { HeroBand, SectionCard, StatTile, StatusPill, ActionRow, FilterTrack, useTones } from '@/src/components/premium';
import { sourceVisual, statusTone, statusIcon, statusKey } from '@/src/components/report/reportVisuals';

export default function ReportHistoryScreen() {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const uid = useAuthStore((state) => state.user?.uid);
  const isAdmin = useProfileStore((state) => state.profile?.isAdmin === true);
  const [track, setTrack] = useState<ReportSource | 'all'>('all');
  const { data, loading, settled, refreshing, error, refetch, refresh } = useAsyncData(
    () => uid ? fetchMyReportHistory(uid) : Promise.resolve([]),
    [uid],
  );

  // Returning to this page must show an admin's resolution without a manual pull.
  useRefreshOnFocus(refresh);

  const all = useMemo(() => data ?? [], [data]);

  // Only sources the user has actually reported from become tracks. This is what
  // makes the page self-maintaining: a report filed from a brand-new context
  // (an app bug, a reading page, an article) produces its own tab on the next
  // load with no code change and no central list to keep in sync.
  const tracks = useMemo(() => {
    const counts = new Map<ReportSource, number>();
    for (const record of all) counts.set(record.source, (counts.get(record.source) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([source, count]) => ({ source, count }));
  }, [all]);

  // A stale selection can outlive its last record (e.g. after a refresh) — fall back.
  const activeTrack: ReportSource | 'all' = track !== 'all' && !tracks.some((entry) => entry.source === track) ? 'all' : track;

  const records = useMemo(
    () => (activeTrack === 'all' ? all : all.filter((record) => record.source === activeTrack)),
    [all, activeTrack],
  );

  // Purely presentational roll-up for the hero strip.
  const tally = useMemo(() => ({
    total: all.length,
    open: all.filter((record) => record.status === 'pending').length,
    closed: all.filter((record) => record.status === 'resolved').length,
  }), [all]);

  const filterItems = useMemo(
    () => [
      { value: 'all' as ReportSource | 'all', label: t('discussion.allReports'), count: all.length },
      ...tracks.map(({ source, count }) => ({ value: source as ReportSource | 'all', label: t(`report.src.${source}`), count })),
    ],
    [tracks, all.length, t],
  );

  return (
    <>
      <SubpageScrollScreen title={t('discussion.yourReportHistory')} refreshing={refreshing} onRefresh={refresh}>
        {!settled ? (
          <View style={{ flex: 1 }}>
            <Preloading tinted={false} label={t('common.loading')} hint={t('loadHints.common')} />
          </View>
        ) : (
        <>
        <HeroBand
          icon="flag"
          title={t('discussion.yourReportHistory')}
          subtitle={t('report.historySubtitle')}
          tone="primary"
          footer={
            <>
              <StatTile grow value={tally.total} label={t('discussion.allReports')} icon="documents-outline" tone="primary" />
              <StatTile grow value={tally.open} label={t('discussion.reportPending')} icon="time-outline" tone="warning" />
              <StatTile grow value={tally.closed} label={t('discussion.reportResolved')} icon="checkmark-done-outline" tone="success" />
            </>
          }
        />

        {isAdmin ? (
          <SectionCard style={{ padding: spacing.sm }}>
            <ActionRow
              icon="shield-checkmark-outline"
              title={t('discussion.reportDetailsControl')}
              subtitle={t('discussion.reportDetailsControlHint')}
              tone="info"
              onPress={() => router.push('/admin/report-history')}
            />
          </SectionCard>
        ) : null}

        {/* Bleeds past the screen padding so the track can scroll edge to edge
            and still start flush with the cards below it. */}
        {tracks.length > 1 ? (
          <View style={{ marginHorizontal: -spacing.screenPadding }}>
            <FilterTrack items={filterItems} value={activeTrack} onChange={setTrack} />
          </View>
        ) : null}

        {/* Blank during the FIRST load — the empty state only shows once data
            has genuinely settled (refetches keep the current list visible). */}
        {error ? <DataNotFound onRetry={refetch} /> : records.length === 0 ? <EmptyReportState /> : (
          <View style={{ gap: spacing.sm }}>
            {records.map((record, index) => (
              <ReportCard key={record.id} record={record} index={index} onPress={() => router.push(`/report-history/${record.id}`)} />
            ))}
          </View>
        )}

        {/* A quiet closing line so the list never ends on a hard edge. */}
        {records.length ? (
          <View style={[styles.footerNote, { borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm }]}>
            <Ionicons name="information-circle-outline" size={15} color={colors.textDisabled} />
            <Text variant="caption" style={{ color: colors.textDisabled, flex: 1 }}>{t('discussion.reportPendingHint')}</Text>
          </View>
        ) : null}
        </>
        )}
      </SubpageScrollScreen>
    </>
  );
}

// Module level on purpose: a component declared inside the screen gets a new
// function identity every render, so React unmounts and remounts it each time
// (losing the icon's own animation state). ReportCard lives out here for the
// same reason.
function EmptyReportState() {
  const { spacing } = useTheme();
  const tones = useTones();
  const { t } = useTranslation();
  return (
    <SectionCard style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
      <View style={[styles.emptyBadge, { backgroundColor: tones.primary.bg, borderColor: tones.primary.border }]}>
        <Ionicons name="flag-outline" size={30} color={tones.primary.fg} />
      </View>
      <Text variant="bodyLarge" weight="bold" style={{ marginTop: spacing.md }}>{t('discussion.noReports')}</Text>
      <Text variant="bodySmall" secondary style={{ textAlign: 'center', marginTop: 4 }}>{t('discussion.noReportsSubtitle')}</Text>
    </SectionCard>
  );
}

function ReportCard({ record, index, onPress }: { record: ReportHistoryRecord; index: number; onPress: () => void }) {
  const { colors, spacing, radius, elevation } = useTheme();
  const { t } = useTranslation();
  const tones = useTones();
  const visual = sourceVisual(record.source);
  const source = tones[visual.tone];
  const sourceLabel = t(`report.src.${record.source}`);
  // The auto-filled origin ("Exam · Set 3") is far more useful than the generic
  // source name, so it wins when present.
  const origin = record.contextLabel || sourceLabel;

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 45).duration(300)}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          elevation[1],
          {
            // Pressed state tints instead of fading: a faded card on a light
            // background just looks unloaded.
            backgroundColor: pressed ? source.bg : colors.surface,
            borderColor: pressed ? source.border : colors.border,
            borderRadius: radius.lg,
            padding: spacing.md,
          },
        ]}
      >
        <View style={styles.cardTop}>
          <View style={[styles.icon, { backgroundColor: source.bg, borderColor: source.border, borderRadius: radius.md }]}>
            <Ionicons name={visual.icon} size={21} color={source.fg} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text variant="bodyLarge" weight="bold" numberOfLines={2}>{record.targetTitle ?? origin}</Text>
            <Text variant="caption" secondary numberOfLines={1}>{origin} · {record.reason}</Text>
          </View>
          <Ionicons name="chevron-forward" size={19} color={colors.textDisabled} />
        </View>
        <View style={[styles.cardBottom, { borderTopColor: colors.divider, paddingTop: spacing.sm }]}>
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={13} color={colors.textDisabled} />
            <Text variant="caption" secondary>{record.createdAt?.toDate().toLocaleDateString() ?? '—'}</Text>
          </View>
          <StatusPill
            label={t(statusKey(record.status))}
            tone={statusTone(record.status)}
            icon={statusIcon(record.status)}
            size="sm"
          />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, gap: 10, overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  emptyBadge: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  footerNote: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: StyleSheet.hairlineWidth, borderStyle: 'dashed' },
});
