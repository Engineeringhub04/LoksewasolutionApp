// Analytics — the private, per-user view of how a subcourse is actually going.
//
// PRIVATE BY DESIGN. Everything here is read from `users/{uid}/app_analytics`,
// which no other user can see. The leaderboard's public mirror deliberately has
// no equivalent: these are the numbers a person checks about themselves, and the
// user was explicit that they should stay that way.
//
// WHAT THE PAGE IS BUILT ON. Nothing in the app ever recorded per-day history —
// every progress document is cumulative — so `app_analytics` stores one snapshot
// per Kathmandu day and differencing consecutive days is what produces every
// trend on this screen. Days before the feature existed are RECONSTRUCTED, and
// the screen is careful to never let a reconstruction pass for a measurement:
// estimated stretches are dashed and dimmed, window totals ignore them entirely,
// and the heatmap simply does not draw days it cannot vouch for.
//
// All fifteen sections live here. The page reads top to bottom as: who you are
// and how you're doing (1-3), how that changed over time (4-5), what you're made
// of (6-8), how hard you're working (9-10), what to do next (11-12), where you
// stand among others (13), what you're aiming at (14), and how any of it was
// calculated (15).
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { FadeInDown } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';

import { Text } from '@/src/components/misc/Text';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { Preloading } from '@/src/components/Preloading';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';
import { ThemeToggleButton } from '@/src/components/misc/ThemeToggleButton';

import { ChartCard } from '@/src/components/charts/ChartCard';
import { LineAreaChart } from '@/src/components/charts/LineAreaChart';
import { BarChart, RankedBars, type RankedBarRow } from '@/src/components/charts/BarChart';
import { DonutChart, type DonutDatum } from '@/src/components/charts/DonutChart';
import { RadarChart, type RadarAxis } from '@/src/components/charts/RadarChart';
import { Heatmap, HeatmapLegend, type HeatmapDay } from '@/src/components/charts/Heatmap';
import { StatTile } from '@/src/components/charts/StatTile';
import { compactNumber, formatDuration } from '@/src/components/charts/chartMath';

import { AnalyticsHero } from '@/src/components/analytics/AnalyticsHero';
import { RangeSwitcher, type RangeOption } from '@/src/components/analytics/RangeSwitcher';
import { InsightCard } from '@/src/components/analytics/InsightCard';
import { WeekStrip } from '@/src/components/analytics/WeekStrip';
import { CohortStrip } from '@/src/components/analytics/CohortStrip';
import { MilestoneList } from '@/src/components/analytics/MilestoneList';
import { MethodFooter } from '@/src/components/analytics/MethodFooter';
import {
  SubcoursePicker,
  type SubcourseOption,
} from '@/src/components/analytics/SubcoursePicker';
import {
  SOURCE_META,
  bestWeekday,
  buildMilestones,
  buildSourceStats,
  chartMaxFor,
  cohortFacts,
  dayLabel,
  deriveInsights,
  fullDateLabel,
  latestBucket,
  leadingSeededCount,
  monthLabel,
  percentChange,
  pointsBreakdown,
  summarise,
  timeFacts,
  weekStrip,
  weekdayLabels,
  weekendIndices,
  type AnalyticsLanguage,
  type CohortFacts,
  type Milestone,
} from '@/src/components/analytics/analyticsDerive';

import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { useProfileStore } from '@/src/core/store/profileStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { useRefreshOnFocus } from '@/src/core/hooks/useRefreshOnFocus';
import { fetchSubcourses } from '@/src/core/firebase/services/courses';
import { hasActivePremium, writeUserStats } from '@/src/core/firebase/services/profile';
import {
  fetchMainLeaderboardCached,
  invalidateMainLeaderboardCache,
  publishMainLeaderboardScore,
  resetMainLeaderboardThrottle,
  shouldPublishMainLeaderboardScore,
} from '@/src/core/services/mainLeaderboard';
import {
  analyticsTodayKey,
  buildAnalyticsSeries,
  computeAnalyticsStreak,
  effortOf,
  fetchAnalyticsDocument,
  listAnalyticsSubcourses,
  previousPeriodSeries,
  type AnalyticsDocument,
  type AnalyticsRange,
} from '@/src/core/services/analyticsSnapshot';

/** Longest heatmap history drawn — 26 weeks is what fits a phone comfortably. */
const HEATMAP_MAX_DAYS = 182;

interface AnalyticsPayload {
  document: AnalyticsDocument | null;
  available: { subcourseId: string; courseId: string; percent: number; points: number }[];
  /** subcourseId → display name. Empty when there is nothing to switch between. */
  names: Record<string, string>;
  /**
   * When this payload was built. `useAsyncData` exposes no fetch time, and §15
   * has to be able to say how old the numbers on screen are.
   */
  fetchedAt: number;
}

export default function AnalyticsScreen() {
  const { t, language } = useTranslation();
  const { colors, spacing, radius, effective, setMode } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const user = useAuthStore((s) => s.user);
  const profile = useProfileStore((s) => s.profile);
  const courseInfo = useProfileStore((s) => s.courseInfo);

  const uid = user?.uid ?? '';
  const enrolledCourseId = courseInfo?.courseId ?? '';
  const enrolledSubcourseId = courseInfo?.subcourseId ?? '';

  const [chosenSubcourseId, setChosenSubcourseId] = useState('');
  const [range, setRange] = useState<AnalyticsRange>(30);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [selectedSlice, setSelectedSlice] = useState<string | null>(null);
  const [selectedEffortDay, setSelectedEffortDay] = useState<number | null>(null);

  // §13 loads behind a tap. The board is up to 300 documents and most visits
  // never scroll that far, so it stays off the critical path.
  const [cohort, setCohort] = useState<CohortFacts | null>(null);
  const [cohortLoading, setCohortLoading] = useState(false);

  const subcourseId = chosenSubcourseId || enrolledSubcourseId;
  const lang: AnalyticsLanguage = language === 'ne' ? 'ne' : 'en';

  const analytics = useAsyncData<AnalyticsPayload | null>(
    async (isRefresh) => {
      if (!uid || !subcourseId) return null;

      // Republishing is only valid for the subcourse the user is actually
      // enrolled in: the publish path reads the CURRENT course's progress
      // documents, so running it while viewing a different subcourse would
      // overwrite that subcourse's score with this one's work.
      const isEnrolled = subcourseId === enrolledSubcourseId && !!enrolledCourseId;

      // Pull-to-refresh has to mean something. The throttle is what keeps an
      // ordinary visit down to one read; clearing it first is the only way a
      // deliberate refresh produces genuinely recomputed numbers.
      if (isRefresh && isEnrolled) resetMainLeaderboardThrottle(uid, subcourseId);

      if (isEnrolled && shouldPublishMainLeaderboardScore(uid, subcourseId)) {
        // Non-fatal by contract — publishMainLeaderboardScore never throws, and a
        // slightly stale snapshot still renders every section below.
        const published = await publishMainLeaderboardScore(uid, enrolledCourseId, subcourseId, {
          name: profile?.name || user?.displayName || 'Anonymous',
          photoURL: profile?.photoURL ?? user?.photoURL ?? null,
          isPro: hasActivePremium(profile),
        });
        // Same aggregate the Profile stats card shows. Safe to hand over because
        // `isEnrolled` already guarantees this is the user's own enrolled
        // subcourse and not some other board they happen to be browsing.
        if (published) useProfileStore.getState().setScore(published);
      }

      const [document, available] = await Promise.all([
        fetchAnalyticsDocument(uid, subcourseId),
        listAnalyticsSubcourses(uid),
      ]);

      return { document, available, names: await resolveSubcourseNames(available), fetchedAt: Date.now() };
    },
    // `profile` is deliberately absent: an unrelated profile edit must not
    // trigger a full recompute, and the identity it supplies is only ever read
    // at call time.
    [uid, enrolledCourseId, enrolledSubcourseId, subcourseId],
  );

  const refreshAnalytics = analytics.refresh;

  /**
   * §13 — pull the subcourse board once, on demand.
   *
   * Guarded by a ref rather than the `cohortLoading` state so the callback keeps
   * a stable identity: `reload` depends on it, and a new identity every render
   * would make the focus refetch fire in a loop.
   */
  const cohortBusy = useRef(false);
  const cohortOpened = useRef(false);

  const loadCohort = useCallback(async () => {
    if (!uid || !subcourseId || cohortBusy.current) return;
    cohortBusy.current = true;
    cohortOpened.current = true;
    setCohortLoading(true);
    try {
      const rows = await fetchMainLeaderboardCached(subcourseId);
      const facts = cohortFacts(rows, uid);
      setCohort(facts);
      // The board is in memory right now, so the user's position is free. Mirror
      // it onto users/{uid}.stats — that is where the Profile card reads a rank
      // from, and it must never buy 300 reads of its own to show one. Skipped
      // automatically when the position has not moved.
      if (facts?.rank) {
        const stats = await writeUserStats(uid, { rank: facts.rank });
        // Same uid re-check as the Leaderboard screen: an account switch during
        // the write must not patch this rank onto the next user's profile.
        const store = useProfileStore.getState();
        if (stats && store.loadedUid === uid) store.applyLocalPatch({ stats });
      }
    } catch {
      // A failed board read leaves the section in its prompt state rather than
      // showing a broken rank. Nothing else on the page depends on it.
      setCohort(null);
    } finally {
      cohortBusy.current = false;
      setCohortLoading(false);
    }
  }, [uid, subcourseId]);

  const reload = useCallback(() => {
    void refreshAnalytics();
    // The board is cached for ten minutes and shared with the leaderboard
    // screen. An explicit refresh has to mean something, but it must not
    // silently buy 300 reads for a section the user never opened — so the cache
    // is always cleared, and only an already-open section refetches.
    invalidateMainLeaderboardCache(subcourseId);
    if (cohortOpened.current) void loadCohort();
  }, [refreshAnalytics, subcourseId, loadCohort]);

  useRefreshOnFocus(reload);

  const document = analytics.data?.document ?? null;
  // ---------- derived series ----------

  const points = useMemo(
    () => (document ? buildAnalyticsSeries(document, range) : []),
    [document, range],
  );
  const previousPoints = useMemo(
    () => (document ? previousPeriodSeries(document, range) : []),
    [document, range],
  );
  /** Recorded days only — the sparklines and window totals are built from these. */
  const observedPoints = useMemo(() => points.filter((point) => !point.seeded), [points]);

  const summary = useMemo(() => summarise(points), [points]);
  const previousSummary = useMemo(() => summarise(previousPoints), [previousPoints]);
  const sourceStats = useMemo(() => buildSourceStats(points), [points]);
  const latest = useMemo(() => latestBucket(points), [points]);
  const seededCount = useMemo(() => leadingSeededCount(points), [points]);

  const streak = useMemo(
    () => (document ? computeAnalyticsStreak(document.days, analyticsTodayKey()) : null),
    [document],
  );

  const facts = useMemo(
    () => timeFacts(document?.breakdown ?? null, latest),
    [document, latest],
  );

  const rangeLabel = useMemo(() => rangeLabelFor(range, t), [range, t]);

  // "vs previous all time" is not a sentence, and there is no previous period to
  // compare an all-time window against — so the qualifier is simply dropped.
  const comparisonLabel = useMemo(
    () => (range === 'all' ? undefined : t('analytics.kpi.vsPrevious', { range: rangeLabel })),
    [range, rangeLabel, t],
  );

  // ---------- picker ----------

  const subcourseOptions = useMemo<SubcourseOption[]>(() => {
    const rows = analytics.data?.available ?? [];
    const names = analytics.data?.names ?? {};
    return rows.map((row) => ({
      subcourseId: row.subcourseId,
      courseId: row.courseId,
      // Never the raw id: an unresolved name falls back to the enrolled
      // subcourse label, then to a generic one.
      name:
        names[row.subcourseId] ||
        (row.subcourseId === enrolledSubcourseId
          ? courseInfo?.subcourseName ?? courseInfo?.courseName ?? ''
          : '') ||
        t('analytics.picker.unnamed'),
      percent: row.percent,
      points: row.points,
    }));
  }, [analytics.data, courseInfo, enrolledSubcourseId, t]);

  const switchable = subcourseOptions.length > 1;
  const activeOption = subcourseOptions.find((option) => option.subcourseId === subcourseId);

  // ---------- charts ----------

  const trendValues = useMemo(() => points.map((point) => point.cumulative.pc), [points]);
  const trendLabels = useMemo(
    () => points.map((point) => dayLabel(point.key, lang)),
    [points, lang],
  );
  // Headroom above the best observed value rather than a fixed 0-100 axis: a
  // learner sitting at 14% would otherwise read as a flat line along the floor.
  const trendMax = useMemo(
    () => Math.min(100, chartMaxFor(points, (point) => point.cumulative.pc, 10)),
    [points],
  );

  const heatmapDays = useMemo<HeatmapDay[]>(() => {
    if (!document) return [];
    // Deliberately observed-only. The backfill knows the TOTAL of everything done
    // before tracking began but not which day any of it happened on, so drawing
    // that era would either invent a pattern or paint real work as empty squares.
    return buildAnalyticsSeries(document, 'all')
      .filter((point) => !point.seeded)
      .slice(-HEATMAP_MAX_DAYS)
      .map((point) => ({ key: point.key, value: effortOf(point) }));
  }, [document]);

  const selectedDay = useMemo(
    () => (selectedDayKey ? heatmapDays.find((day) => day.key === selectedDayKey) ?? null : null),
    [heatmapDays, selectedDayKey],
  );

  const radarAxes = useMemo<RadarAxis[]>(
    () =>
      sourceStats.map((stat) => ({
        key: stat.key,
        label: t(SOURCE_META[stat.key].labelKey),
        value: stat.accuracy,
        untouched: !stat.touched,
      })),
    [sourceStats, t],
  );

  const strongest = useMemo(() => {
    const touched = sourceStats.filter((stat) => stat.touched);
    if (!touched.length) return null;
    return touched.reduce((best, stat) => (stat.accuracy > best.accuracy ? stat : best));
  }, [sourceStats]);

  /**
   * The effort ring.
   *
   * The plan called for a breakdown of study TIME per feature, which the data
   * cannot support: the app measures total foreground seconds and the seconds
   * spent on activity-progress records, and nothing else — exams, daily tests and
   * practice record no time at all. Splitting a single total six ways would be
   * invention, so the ring shows what is exactly counted instead: volume of work
   * per source. The two real time figures moved into the footer.
   */
  const effort = useMemo(() => {
    const windowed = sourceStats.filter((stat) => stat.volume > 0);
    const lifetime = windowed.length === 0;
    const rows = lifetime ? sourceStats.filter((stat) => stat.lifetimeVolume > 0) : windowed;

    const data: DonutDatum[] = rows.map((stat) => {
      const value = lifetime ? stat.lifetimeVolume : stat.volume;
      return {
        key: stat.key,
        label: t(SOURCE_META[stat.key].labelKey),
        value,
        color: stat.color,
        display: compactNumber(value),
      };
    });

    return { data, lifetime, total: data.reduce((sum, item) => sum + item.value, 0) };
  }, [sourceStats, t]);

  const rangeOptions = useMemo<RangeOption[]>(
    () => [
      { value: 7, label: t('analytics.range.7d') },
      { value: 30, label: t('analytics.range.30d') },
      { value: 90, label: t('analytics.range.90d') },
      { value: 'all', label: t('analytics.range.all') },
    ],
    [t],
  );

  // ---------- 8. Where the points came from ----------

  const breakdown = useMemo(
    () => pointsBreakdown(document?.breakdown ?? null, summary.totalPoints),
    [document, summary.totalPoints],
  );

  const breakdownRows = useMemo<RankedBarRow[]>(
    () =>
      breakdown.rows.map((row) => ({
        key: row.key,
        label: t(row.labelKey),
        value: row.points,
        display: t('analytics.points.row', {
          points: compactNumber(row.points),
          share: Math.round(row.share),
        }),
        color: row.color,
      })),
    [breakdown, t],
  );

  // ---------- 9. Daily effort ----------

  const effortValues = useMemo(() => points.map((point) => effortOf(point)), [points]);
  const effortLabels = useMemo(
    () => points.map((point) => dayLabel(point.key, lang)),
    [points, lang],
  );
  const effortMax = useMemo(() => chartMaxFor(points, effortOf, 4), [points]);
  const effortAverage = useMemo(() => {
    // Averaged over OBSERVED days only, and over active ones at that: a mean
    // dragged down by days the app was never opened is not "your typical day".
    const active = observedPoints.map(effortOf).filter((value) => value > 0);
    if (!active.length) return undefined;
    return active.reduce((sum, value) => sum + value, 0) / active.length;
  }, [observedPoints]);
  const weekendMarks = useMemo(() => weekendIndices(points), [points]);
  const selectedEffort =
    selectedEffortDay != null && points[selectedEffortDay] ? points[selectedEffortDay] : null;

  // ---------- 10. Accuracy by source ----------

  const accuracyRows = useMemo<RankedBarRow[]>(
    () =>
      [...sourceStats]
        .sort((a, b) => Number(b.touched) - Number(a.touched) || b.accuracy - a.accuracy)
        .map((stat) => ({
          key: stat.key,
          label: t(SOURCE_META[stat.key].labelKey),
          value: stat.touched ? stat.accuracy : 0,
          display: stat.touched ? formatPercent(stat.accuracy) : t('analytics.accuracy.untouched'),
          color: stat.color,
          muted: !stat.touched,
        })),
    [sourceStats, t],
  );

  // ---------- 11. Strength and focus ----------

  const insights = useMemo(() => deriveInsights(sourceStats), [sourceStats]);

  // ---------- 12. Consistency ----------

  const weekDots = useMemo(() => {
    if (!document) return [];
    return weekStrip(buildAnalyticsSeries(document, 'all'), analyticsTodayKey());
  }, [document]);

  const peakDay = useMemo(() => {
    if (!document) return null;
    return bestWeekday(buildAnalyticsSeries(document, 'all'));
  }, [document]);

  // ---------- 14. Milestones ----------

  const milestones = useMemo(
    () =>
      buildMilestones(summary.totalPoints, streak?.current ?? 0, summary.accuracy, facts.totalSeconds, {
        points: colors.primary,
        streak: colors.warning,
        accuracy: colors.success,
        time: colors.info,
      }),
    [summary.totalPoints, summary.accuracy, streak, facts.totalSeconds, colors],
  );

  const milestoneLabel = useCallback(
    (milestone: Milestone) => t(`analytics.milestone.${milestone.key}`, { target: milestone.targetLabel }),
    [t],
  );

  // ---------- gates ----------

  const header = (
    <SubpageHeader
      title={t('analytics.title')}
      // rightSlot replaces the default theme toggle entirely, so the toggle is
      // re-added alongside refresh — every subpage is expected to carry one.
      rightSlot={
        <>
          <Pressable
            onPress={reload}
            style={styles.headerIcon}
            accessibilityRole="button"
            accessibilityLabel={t('analytics.refresh')}
          >
            <Ionicons name="refresh" size={19} color="#FFFFFF" />
          </Pressable>
          <ThemeToggleButton
            isDark={effective === 'dark'}
            onToggle={() => setMode(effective === 'dark' ? 'light' : 'dark')}
            size={36}
          />
        </>
      }
    />
  );

  if (!uid || !subcourseId) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {header}
        <DataNotFound title={t('analytics.title')} description={t('analytics.noCourse')} />
      </View>
    );
  }

  if (analytics.error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {header}
        <DataNotFound onRetry={analytics.refetch} />
      </View>
    );
  }

  // No document means the once-a-day snapshot has never run for this subcourse —
  // which is the state a brand-new user is in, not an error. Gated on the
  // FETCH having produced data (analytics.data !== null): `document` is null
  // both when the doc is missing and when nothing has loaded yet, and treating
  // the latter as "empty" flashed the empty page behind the loader.
  if (!analytics.loading && analytics.data !== null && !document) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {header}
        <DataNotFound
          title={t('analytics.empty.title')}
          description={t('analytics.empty.description')}
          onRetry={analytics.refetch}
        />
      </View>
    );
  }

  const trackingStarted = summary.observedDays <= 1;

  // The header stays; the body is replaced by the glow-ring until the FIRST
  // analytics read settles. `settled`, not `loading`: a pull-to-refresh or the
  // header refresh must never re-hide a fully rendered page.
  const ready = analytics.settled;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {header}

      {!ready ? (
        <Preloading tinted={false} label={t("analytics.loading")} hint={t("loadHints.analytics")} />
      ) : (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: spacing.screenPadding,
          paddingBottom: insets.bottom + 40,
          gap: spacing.md,
        }}
        refreshControl={
          <AppRefreshControl refreshing={analytics.refreshing} onRefresh={reload} />
        }
      >
        {/* ---------- 2. Hero ---------- */}
        <Section index={0}>
          <AnalyticsHero
            courseName={courseInfo?.courseName ?? t('analytics.hero.fallbackCourse')}
            subcourseName={
              activeOption?.name ?? courseInfo?.subcourseName ?? t('analytics.picker.unnamed')
            }
            percent={summary.accuracy}
            points={summary.totalPoints}
            streak={streak?.current ?? 0}
            activeDays={summary.activeDays}
            // Only present once §13 has been opened — the hero never pays for a
            // board read on its own.
            rank={cohort?.rank ?? null}
            switchable={switchable}
            onPress={() => setPickerOpen(true)}
          />
        </Section>

        {/* ---------- 1. Range switcher ---------- */}
        <Section index={1}>
          <View style={{ gap: 6 }}>
            <RangeSwitcher options={rangeOptions} value={range} onChange={setRange} />
            <Text variant="caption" secondary style={{ textAlign: 'center' }}>
              {trackingStarted
                ? t('analytics.trackingStarted')
                : t('analytics.range.observed', { days: summary.observedDays })}
            </Text>
          </View>
        </Section>

        {/* ---------- 3. KPI tiles ---------- */}
        <Section index={2}>
          <View style={{ gap: spacing.sm }}>
            <View style={styles.tileRow}>
              <StatTile
                style={{ flex: 1 }}
                icon="trending-up"
                label={t('analytics.kpi.accuracy')}
                value={formatPercent(summary.accuracy)}
                accent={colors.primary}
                // Percentage POINTS, not a relative change: accuracy is already a
                // percentage, and "+12% of 60%" would mean two different things to
                // two different readers.
                delta={
                  summary.accuracyStart != null ? summary.accuracy - summary.accuracyStart : null
                }
                deltaLabel={t('analytics.kpi.sincePeriodStart')}
                trend={observedPoints.map((point) => point.cumulative.pc)}
              />
              <StatTile
                style={{ flex: 1 }}
                icon="time-outline"
                label={t('analytics.kpi.studyTime')}
                value={formatDuration(summary.studySeconds)}
                accent={colors.info}
                delta={percentChange(summary.studySeconds, previousSummary.studySeconds)}
                deltaLabel={comparisonLabel}
                trend={observedPoints.map((point) => point.delta.s / 60)}
              />
            </View>

            <View style={styles.tileRow}>
              <StatTile
                style={{ flex: 1 }}
                icon="checkmark-done-outline"
                label={t('analytics.kpi.activities')}
                value={compactNumber(summary.activities)}
                accent={colors.success}
                delta={percentChange(summary.activities, previousSummary.activities)}
                deltaLabel={comparisonLabel}
                trend={observedPoints.map((point) => effortOf(point))}
              />
              <StatTile
                style={{ flex: 1 }}
                icon="calendar-outline"
                label={t('analytics.kpi.activeDays')}
                value={String(summary.activeDays)}
                accent={colors.warning}
                delta={percentChange(summary.activeDays, previousSummary.activeDays)}
                deltaLabel={comparisonLabel}
                trend={observedPoints.map((point) => (effortOf(point) > 0 ? 1 : 0))}
              />
            </View>
          </View>
        </Section>

        {/* ---------- 4. Score trend ---------- */}
        <Section index={3}>
          <ChartCard
            title={t('analytics.trend.title')}
            subtitle={t('analytics.trend.subtitle', { range: rangeLabel })}
            height={200}
            loading={analytics.loading}
            empty={points.length < 2}
            emptyLabel={t('analytics.trend.empty')}
            emptyIcon="analytics-outline"
            footer={
              seededCount > 0 ? (
                <EstimateNote
                  color={colors.textSecondary}
                  label={t('analytics.estimateNote', { days: seededCount })}
                />
              ) : null
            }
          >
            <LineAreaChart
              values={trendValues}
              labels={trendLabels}
              color={colors.primary}
              height={200}
              maxValue={trendMax}
              seededCount={seededCount}
              formatValue={(value) => `${Math.round(value)}%`}
              emptyLabel={t('analytics.trend.empty')}
            />
          </ChartCard>
        </Section>

        {/* ---------- 5. Activity heatmap ---------- */}
        <Section index={4}>
          <ChartCard
            title={t('analytics.heatmap.title')}
            // The grid keeps its own full-history window regardless of the range
            // switcher: seven days of a contribution grid is one column, which
            // would say nothing at all.
            subtitle={
              heatmapDays.length
                ? t('analytics.heatmap.subtitle', {
                    from: fullDateLabel(heatmapDays[0].key, lang),
                  })
                : undefined
            }
            height={150}
            loading={analytics.loading}
            empty={heatmapDays.length === 0}
            emptyLabel={t('analytics.heatmap.empty')}
            emptyIcon="grid-outline"
            footer={
              <View style={{ gap: spacing.sm }}>
                {selectedDay ? (
                  <View
                    style={[
                      styles.dayPill,
                      { backgroundColor: colors.surfaceAlt, borderRadius: radius.md },
                    ]}
                  >
                    <Ionicons name="calendar" size={14} color={colors.primary} />
                    <Text variant="caption" weight="medium" numberOfLines={1} style={{ flex: 1 }}>
                      {fullDateLabel(selectedDay.key, lang)}
                    </Text>
                    <Text variant="caption" secondary numberOfLines={1}>
                      {t('analytics.heatmap.dayValue', { count: selectedDay.value })}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.legendRow}>
                  <Text variant="caption" secondary numberOfLines={1} style={{ flex: 1 }}>
                    {t('analytics.heatmap.hint')}
                  </Text>
                  <HeatmapLegend
                    color={colors.success}
                    lessLabel={t('analytics.heatmap.less')}
                    moreLabel={t('analytics.heatmap.more')}
                  />
                </View>
              </View>
            }
          >
            <Heatmap
              days={heatmapDays}
              color={colors.success}
              weekdayLabels={weekdayLabels(lang)}
              monthLabelFor={(key) => monthLabel(key, lang)}
              selectedKey={selectedDayKey}
              onSelect={(day) =>
                setSelectedDayKey((prev) => (prev === day.key ? null : day.key))
              }
              emptyLabel={t('analytics.heatmap.empty')}
            />
          </ChartCard>
        </Section>

        {/* ---------- 6. Skill radar ---------- */}
        <Section index={5}>
          <ChartCard
            title={t('analytics.radar.title')}
            subtitle={t('analytics.radar.subtitle')}
            height={250}
            loading={analytics.loading}
            empty={!latest}
            emptyLabel={t('analytics.radar.empty')}
            emptyIcon="git-network-outline"
            footer={
              strongest ? (
                <View style={styles.legendRow}>
                  <Ionicons name="ribbon-outline" size={14} color={strongest.color} />
                  <Text variant="caption" secondary style={{ flex: 1 }}>
                    {t('analytics.radar.strongest', {
                      source: t(SOURCE_META[strongest.key].labelKey),
                      percent: formatPercent(strongest.accuracy),
                    })}
                  </Text>
                </View>
              ) : null
            }
          >
            <RadarChart
              axes={radarAxes}
              color={colors.primary}
              maxValue={100}
              emptyLabel={t('analytics.radar.empty')}
            />
          </ChartCard>
        </Section>

        {/* ---------- 7. Where effort goes ---------- */}
        <Section index={6}>
          <ChartCard
            title={t('analytics.effort.title')}
            subtitle={
              effort.lifetime
                ? t('analytics.effort.subtitleLifetime')
                : t('analytics.effort.subtitle', { range: rangeLabel })
            }
            height={160}
            loading={analytics.loading}
            empty={effort.total <= 0}
            emptyLabel={t('analytics.effort.empty')}
            emptyIcon="pie-chart-outline"
            footer={
              <View style={{ gap: 4 }}>
                <FactRow
                  color={colors.textSecondary}
                  label={t('analytics.effort.totalTime')}
                  value={formatDuration(facts.totalSeconds)}
                />
                <FactRow
                  color={colors.textSecondary}
                  label={t('analytics.effort.trackedTime')}
                  value={formatDuration(facts.trackedSeconds)}
                />
                {facts.sessions > 0 ? (
                  <FactRow
                    color={colors.textSecondary}
                    label={t('analytics.effort.avgSession')}
                    value={formatDuration(facts.totalSeconds / facts.sessions)}
                  />
                ) : null}
              </View>
            }
          >
            <DonutChart
              data={effort.data}
              centerValue={compactNumber(effort.total)}
              centerLabel={t('analytics.effort.center')}
              selectedKey={selectedSlice}
              onSelect={(key) => setSelectedSlice((prev) => (prev === key ? null : key))}
              emptyLabel={t('analytics.effort.empty')}
            />
          </ChartCard>
        </Section>

        {/* ---------- 8. Where the points came from ---------- */}
        <Section index={7}>
          <ChartCard
            title={t('analytics.points.title')}
            subtitle={t('analytics.points.subtitle')}
            height={Math.max(120, breakdown.rows.length * 44)}
            loading={analytics.loading}
            empty={breakdown.rows.length === 0}
            emptyLabel={t('analytics.points.empty')}
            emptyIcon="pricetags-outline"
            right={
              <View style={[styles.totalPill, { backgroundColor: `${colors.primary}17`, borderRadius: radius.pill }]}>
                <Text variant="caption" weight="bold" color={colors.primary}>
                  {compactNumber(breakdown.total)} {t('analytics.points.unit')}
                </Text>
              </View>
            }
            footer={
              breakdown.estimated ? (
                <View style={styles.legendRow}>
                  <Ionicons name="information-circle-outline" size={13} color={colors.textSecondary} />
                  <Text variant="caption" secondary style={{ flex: 1 }}>
                    {t('analytics.points.estimateNote')}
                  </Text>
                </View>
              ) : null
            }
          >
            <RankedBars rows={breakdownRows} color={colors.primary} emptyLabel={t('analytics.points.empty')} />
          </ChartCard>
        </Section>

        {/* ---------- 9. Daily effort ---------- */}
        <Section index={8}>
          <ChartCard
            title={t('analytics.daily.title')}
            subtitle={t('analytics.daily.subtitle', { range: rangeLabel })}
            height={190}
            loading={analytics.loading}
            empty={points.length === 0}
            emptyLabel={t('analytics.daily.empty')}
            emptyIcon="bar-chart-outline"
            footer={
              <View style={{ gap: spacing.sm }}>
                {selectedEffort ? (
                  <View style={[styles.dayPill, { backgroundColor: colors.surfaceAlt, borderRadius: radius.md }]}>
                    <Ionicons name="calendar" size={14} color={colors.primary} />
                    <Text variant="caption" weight="medium" numberOfLines={1} style={{ flex: 1 }}>
                      {fullDateLabel(selectedEffort.key, lang)}
                    </Text>
                    <Text variant="caption" secondary numberOfLines={1}>
                      {selectedEffort.seeded
                        ? t('analytics.daily.seededDay')
                        : t('analytics.daily.dayValue', { count: effortOf(selectedEffort) })}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.legendRow}>
                  <View style={[styles.swatch, { backgroundColor: colors.warning }]} />
                  <Text variant="caption" secondary style={{ flex: 1 }}>
                    {t('analytics.daily.weekendNote')}
                  </Text>
                </View>
              </View>
            }
          >
            <BarChart
              values={effortValues}
              labels={effortLabels}
              color={colors.primary}
              height={190}
              maxValue={effortMax}
              averageValue={effortAverage}
              averageLabel={t('analytics.daily.average')}
              accentIndices={weekendMarks}
              accentColor={colors.warning}
              seededCount={seededCount}
              selectedIndex={selectedEffortDay}
              onSelect={(index) => setSelectedEffortDay((prev) => (prev === index ? null : index))}
              formatValue={(value) => String(Math.round(value))}
              emptyLabel={t('analytics.daily.empty')}
            />
          </ChartCard>
        </Section>

        {/* ---------- 10. Accuracy by source ---------- */}
        <Section index={9}>
          <ChartCard
            title={t('analytics.accuracy.title')}
            subtitle={t('analytics.accuracy.subtitle')}
            height={Math.max(120, accuracyRows.length * 44)}
            loading={analytics.loading}
            empty={!latest}
            emptyLabel={t('analytics.accuracy.empty')}
            emptyIcon="speedometer-outline"
          >
            {/* Fixed 0-100 scale, unlike the trend line above: an accuracy bar
                rescaled to the best performer would make 40% look like mastery
                simply because nothing else was higher. */}
            <RankedBars
              rows={accuracyRows}
              color={colors.primary}
              maxValue={100}
              emptyLabel={t('analytics.accuracy.empty')}
            />
          </ChartCard>
        </Section>

        {/* ---------- 11. What to do next ---------- */}
        {insights.strength || insights.focus ? (
          <Section index={10}>
            <View style={{ gap: spacing.sm }}>
              <Text variant="bodyLarge" weight="bold">
                {t('analytics.insight.title')}
              </Text>

              {insights.strength ? (
                <InsightCard
                  tone="strength"
                  eyebrow={t('analytics.insight.strengthEyebrow')}
                  title={t(insights.strength.labelKey)}
                  description={t('analytics.insight.strengthBody')}
                  value={formatPercent(insights.strength.accuracy)}
                  accent={insights.strength.color}
                  ctaLabel={t('analytics.insight.keepGoing')}
                  onPress={() => router.push(insights.strength!.route as never)}
                />
              ) : null}

              {insights.focus ? (
                <InsightCard
                  tone="focus"
                  eyebrow={t('analytics.insight.focusEyebrow')}
                  title={t(insights.focus.labelKey)}
                  description={
                    insights.focusUntouched
                      ? t('analytics.insight.focusUntouchedBody')
                      : t('analytics.insight.focusBody')
                  }
                  value={insights.focusUntouched ? undefined : formatPercent(insights.focus.accuracy)}
                  accent={insights.focus.color}
                  ctaLabel={t('analytics.insight.practiceNow')}
                  onPress={() => router.push(insights.focus!.route as never)}
                />
              ) : null}
            </View>
          </Section>
        ) : null}

        {/* ---------- 12. Consistency ---------- */}
        <Section index={11}>
          <ChartCard
            title={t('analytics.week.title')}
            subtitle={t('analytics.week.subtitle')}
            height={72}
            loading={analytics.loading}
            empty={weekDots.length === 0}
            emptyLabel={t('analytics.week.empty')}
            emptyIcon="calendar-outline"
            right={
              streak ? (
                <View style={styles.legendRow}>
                  <Ionicons name="flame" size={14} color={colors.warning} />
                  <Text variant="caption" weight="bold" color={colors.warning}>
                    {t('analytics.week.streak', { days: streak.current })}
                  </Text>
                </View>
              ) : null
            }
            footer={
              <View style={{ gap: 4 }}>
                {peakDay ? (
                  <FactRow
                    color={colors.textPrimary}
                    label={t('analytics.week.peakDay')}
                    value={weekdayLabels(lang)[peakDay.weekday] ?? ''}
                  />
                ) : null}
                {streak && streak.best > 0 ? (
                  <FactRow
                    color={colors.textPrimary}
                    label={t('analytics.week.bestStreak')}
                    value={t('analytics.week.streak', { days: streak.best })}
                  />
                ) : null}
              </View>
            }
          >
            <View style={{ justifyContent: 'center', flex: 1 }}>
              <WeekStrip dots={weekDots} weekdayLabels={weekdayLabels(lang)} color={colors.primary} />
            </View>
          </ChartCard>
        </Section>

        {/* ---------- 13. You vs the cohort ---------- */}
        <Section index={12}>
          <ChartCard
            title={t('analytics.cohort.title')}
            subtitle={t('analytics.cohort.subtitle')}
            height={cohort ? 160 : 84}
            emptyIcon="people-outline"
          >
            <CohortStrip
              facts={cohort}
              loading={cohortLoading}
              prompt={t('analytics.cohort.prompt')}
              loadLabel={t('analytics.cohort.load')}
              emptyLabel={t('analytics.cohort.empty')}
              medianLabel={t('analytics.cohort.median')}
              youLabel={t('analytics.cohort.you')}
              toNextLabel={t('analytics.cohort.toNext')}
              headline={
                cohort?.rank
                  ? t('analytics.cohort.headline', { rank: cohort.rank, size: cohort.size })
                  : undefined
              }
              subline={
                cohort?.topPercent != null
                  ? t('analytics.cohort.subline', { percent: Math.round(cohort.topPercent) })
                  : undefined
              }
              boardLabel={t('analytics.cohort.viewBoard')}
              onLoad={() => void loadCohort()}
              onOpenBoard={() => router.push('/leaderboard' as never)}
            />
          </ChartCard>
        </Section>

        {/* ---------- 14. Milestones ---------- */}
        <Section index={13}>
          <ChartCard
            title={t('analytics.milestone.title')}
            subtitle={t('analytics.milestone.subtitle')}
            height={Math.max(120, milestones.length * 50)}
            loading={analytics.loading}
            empty={milestones.length === 0}
            emptyLabel={t('analytics.milestone.empty')}
            emptyIcon="flag-outline"
          >
            <MilestoneList
              milestones={milestones}
              labelFor={milestoneLabel}
              doneLabel={t('analytics.milestone.done')}
            />
          </ChartCard>
        </Section>

        {/* ---------- 15. How this is calculated ---------- */}
        <Section index={14}>
          <MethodFooter
            title={t('analytics.method.title')}
            intro={t('analytics.method.intro')}
            weightsTitle={t('analytics.method.weightsTitle')}
            labelFor={(labelKey) => t(labelKey)}
            timeNote={(hours) => t('analytics.method.timeNote', { hours })}
            estimateNote={t('analytics.method.estimateNote')}
            privacyNote={t('analytics.method.privacyNote')}
            expandLabel={t('analytics.method.expand')}
            collapseLabel={t('analytics.method.collapse')}
            fetchedAt={analytics.data?.fetchedAt ?? Date.now()}
            updatedLabel={(key, value) => t(`analytics.method.${key}`, { value })}
          />
        </Section>
      </ScrollView>
      )}


      <SubcoursePicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        options={subcourseOptions}
        selectedId={subcourseId}
        onSelect={(next) => {
          setChosenSubcourseId(next);
          // Selections belong to the subcourse that was on screen when they were
          // made; carrying them across would highlight a day or slice that the
          // new subcourse may not even have.
          setSelectedDayKey(null);
          setSelectedSlice(null);
          setSelectedEffortDay(null);
          // The cohort belongs to ONE subcourse's board. Carrying a rank across
          // would show the user a position they do not hold.
          setCohort(null);
          cohortOpened.current = false;
        }}
      />

    </View>
  );
}


/** Staggered reveal, one step per section down the page. */
function Section({ index, children }: { index: number; children: React.ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 60).duration(320)}>
      {children}
    </Animated.View>
  );
}

function EstimateNote({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendRow}>
      {/* A dashed swatch, matching exactly how the chart draws the estimated
          stretch — a colour key the user can map back to the line. */}
      <View style={[styles.dashSwatch, { borderColor: color }]} />
      <Text variant="caption" secondary style={{ flex: 1 }}>
        {label}
      </Text>
    </View>
  );
}

function FactRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <View style={styles.legendRow}>
      <Text variant="caption" secondary numberOfLines={1} style={{ flex: 1 }}>
        {label}
      </Text>
      <Text variant="caption" weight="semiBold" color={color} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/**
 * Display names for every subcourse with recorded history.
 *
 * `listAnalyticsSubcourses` returns ids only, and showing a raw id to the user is
 * never acceptable. Skipped entirely for a single subcourse: the picker is hidden
 * in that case, so the extra course reads would buy nothing.
 */
async function resolveSubcourseNames(
  rows: { subcourseId: string; courseId: string }[],
): Promise<Record<string, string>> {
  if (rows.length < 2) return {};

  const courseIds = Array.from(new Set(rows.map((row) => row.courseId).filter(Boolean)));
  const names: Record<string, string> = {};

  await Promise.all(
    courseIds.map(async (courseId) => {
      try {
        const subcourses = await fetchSubcourses(courseId);
        subcourses.forEach((subcourse) => {
          names[subcourse.id] = subcourse.name;
        });
      } catch {
        // A name that cannot be resolved falls back upstream. It must not take
        // the whole page down with it.
      }
    }),
  );

  return names;
}

function rangeLabelFor(range: AnalyticsRange, t: (key: string, params?: Record<string, string | number>) => string): string {
  if (range === 'all') return t('analytics.range.allLabel');
  return t('analytics.range.daysLabel', { days: range });
}

/** Trims a trailing ".0" so whole percentages don't read as false precision. */
function formatPercent(value: number): string {
  const rounded = Math.round((Number.isFinite(value) ? value : 0) * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

const styles = StyleSheet.create({
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileRow: { flexDirection: 'row', gap: 12 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dayPill: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 },
  dashSwatch: { width: 16, borderTopWidth: 2, borderStyle: 'dashed', opacity: 0.7 },
  swatch: { width: 9, height: 9, borderRadius: 2 },
  totalPill: { paddingHorizontal: 10, paddingVertical: 4 },
});
