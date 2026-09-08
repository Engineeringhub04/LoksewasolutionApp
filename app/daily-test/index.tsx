// Daily Test — landing screen.
//
// Layout, top to bottom: the enrolled course as a premium gradient banner, a
// "Today's Tests" strip of at most FOUR model cards with a View All link, then
// "Your History".
//
// SCHEDULING drives the strip. Every model document owns a release date, and the
// cards are built from today's date rather than from a rotation. The strip is a
// SHORTLIST, not the archive — the All Models page behind View All lists every
// model there is, so the landing page only has to answer "what should I do now?"
// in four cards:
//   • one slot is always the NEXT test: the first real model on the next
//     scheduled date, or, when the subcourse has nothing queued, a stand-in card
//     for the new set that is coming.
//   • the other three go, in order of urgency, to TODAY's models, then one MISSED
//     model, then the most recent COMPLETED ones — so a day with four tests shows
//     three of them, a day with one shows it plus recent results, and a rest day
//     shows recent results alone. With nothing at all, only the next-test card.
//
// The day is tracked by useLocalDayKey, so at 12:00 AM the cards rebuild and one
// refetch runs — a model added for tomorrow appears on its own, with no relaunch
// and no pull-to-refresh. The key comes from serverNow(), i.e. server-corrected
// time, so winding the device clock forward does not unlock a future test.
//
// Reads are kept low: two queries per visit — the subcourse's models, and every
// result this ACCOUNT has saved. Every card is derived from those two in memory.
// The saved results (not on-device history) decide what counts as "already
// completed", so a model finished on one phone still reads as done after signing
// the same id in somewhere else. On top of that, the in-memory completion store
// carries a just-submitted result, so walking back from the Summary flips the card
// to "View Result" instantly instead of after a refresh. On-device history is only
// the convenience feed under the cards.
//
// Loading never blanks the screen — the header stays put and the spinner is
// confined to the body area beneath it.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { useProfileStore } from '@/src/core/store/profileStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { useLocalDayKey } from '@/src/core/hooks/useLocalDayKey';
import { hasActivePremium } from '@/src/core/firebase/services/profile';
import {
  fetchDailyTestModels,
  fetchDailyTestResults,
  modelsForDate,
  missedModels,
  nextScheduledDate,
  buildDemoUpcomingModel,
  addDaysToKey,
  type DailyTestModel,
  type DailyTestResult,
} from '@/src/core/firebase/services/dailyTest';
import {
  getRecentDailyTestActivities,
  type DailyTestActivity,
} from '@/src/core/services/dailyTestActivity';
import { showToast } from '@/src/core/store/toastStore';
import { useDailyTestCompletionStore } from '@/src/core/store/dailyTestCompletionStore';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { Text } from '@/src/components/misc/Text';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { ErrorState } from '@/src/components/feedback/ErrorState';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { DailyTestCarousel } from '@/src/components/dailyTest/DailyTestCarousel';
import {
  DailyTestModelCard,
  type DailyTestCardSlot,
} from '@/src/components/dailyTest/DailyTestModelCard';
import { DailyTestNoTestCard } from '@/src/components/dailyTest/DailyTestNoTestCard';
import { DailyTestHistoryCard } from '@/src/components/dailyTest/DailyTestHistoryCard';
import { DailyTestRulesDialog } from '@/src/components/dailyTest/DailyTestRulesDialog';

/**
 * Hard cap on the landing strip. Four is what fits before the strip stops being a
 * shortlist and starts being a list — everything beyond it lives on the All Models
 * page, which is one tap away via View All.
 */
const MAX_SLIDES = 4;

/**
 * At most one missed slide here. A missed test still has to be visible — a user
 * who skipped yesterday deserves to know — but with only four slots a quiet week
 * of misses would otherwise crowd out today's test and the next one. The rest are
 * on the All Models page.
 */
const MAX_MISSED_SLIDES = 1;

interface DailyTestLandingData {
  models: DailyTestModel[];
  /** Every saved attempt for this ACCOUNT, keyed by modelId. The source of truth
   *  for "already done" — local history is only a convenience feed. */
  results: Record<string, DailyTestResult>;
  /** The same attempts, newest first, so the last-result slide is truly the last. */
  recentResults: DailyTestResult[];
}

interface Slide {
  key: string;
  model: DailyTestModel;
  slot: DailyTestCardSlot;
  completed: boolean;
  scorePercent: number | null;
  /** The saved attempt behind a completed slide, so "View Result" can reopen it. */
  result: DailyTestResult | null;
  /** Stand-in card for a subcourse with nothing scheduled ahead. */
  demo?: boolean;
  /** "Test 2 of 3" when a single date carries more than one model. */
  indexInDay?: { index: number; total: number };
}

export default function DailyTestScreen() {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const user = useAuthStore((s) => s.user);
  const profile = useProfileStore((s) => s.profile);
  const courseInfo = useProfileStore((s) => s.courseInfo);
  const courseId = courseInfo?.courseId ?? null;
  const courseName = courseInfo?.courseName ?? null;
  const subcourseName = courseInfo?.subcourseName ?? null;
  const subcourseId = courseInfo?.subcourseId ?? null;

  const isPremium = hasActivePremium(profile);

  const [activities, setActivities] = useState<DailyTestActivity[]>([]);
  // The model whose rules popup is open. Non-null == popup visible.
  const [rulesModel, setRulesModel] = useState<DailyTestModel | null>(null);

  const { data, loading, refreshing, error, refetch, refresh } =
    useAsyncData<DailyTestLandingData>(
      async () => {
        if (!subcourseId) return { models: [], results: {}, recentResults: [] };
        const models = await fetchDailyTestModels(subcourseId);

        // One query returns every attempt this ACCOUNT has saved, so completion
        // travels with the login instead of with the phone: sign the same id in
        // on a brand-new device and the models it already did still read as done.
        const results: Record<string, DailyTestResult> = {};
        const recentResults = user?.uid
          ? await fetchDailyTestResults(user.uid).catch(() => [])
          : [];
        for (const r of recentResults) {
          if (!results[r.modelId]) results[r.modelId] = r;
        }
        return { models, results, recentResults };
      },
      [subcourseId, user?.uid],
      { enabled: !!subcourseId },
    );

  // The calendar day, watched. When midnight passes (or the app returns from the
  // background on a new day) the slides below rebuild from the new key, and a
  // single refetch picks up any model that was scheduled for the new date.
  const dayKey = useLocalDayKey({
    onDayChange: useCallback(() => {
      if (subcourseId) refetch();
    }, [subcourseId, refetch]),
  });

  // Models finished during THIS session. Merged over the fetched results below so
  // returning from the Summary flips "Start Test" to "View Result" with no
  // refetch and no extra read — the fix for having to pull-to-refresh.
  const sessionCompletions = useDailyTestCompletionStore((s) =>
    user?.uid ? s.byUser[user.uid] : undefined,
  );

  // History lives on-device only, scoped to the signed-in uid — reload it
  // whenever the screen regains focus (e.g. coming back from the summary).
  const loadActivities = useCallback(async () => {
    setActivities(await getRecentDailyTestActivities(user?.uid));
  }, [user?.uid]);

  useFocusEffect(
    useCallback(() => {
      void loadActivities();
    }, [loadActivities]),
  );

  useEffect(() => {
    void loadActivities();
  }, [loadActivities]);

  /** Opens the Summary for an already-finished attempt, reusing saved answers. */
  const openSummary = useCallback(
    (modelId: string, answers: number[], timeTakenSeconds: number) => {
      router.push({
        pathname: '/daily-test/[modelId]/summary',
        params: {
          modelId,
          answers: JSON.stringify(answers),
          timeTaken: String(timeTakenSeconds),
          fromHistory: '1',
        },
      } as never);
    },
    [router],
  );

  /** Server results plus anything completed since the last fetch. */
  const results = useMemo<Record<string, DailyTestResult>>(
    () => ({ ...(data?.results ?? {}), ...(sessionCompletions ?? {}) }),
    [data?.results, sessionCompletions],
  );

  const nextDate = useMemo(
    () => (data ? nextScheduledDate(data.models, dayKey) : null),
    [data, dayKey],
  );

  const slides = useMemo<Slide[]>(() => {
    if (!data) return [];

    const build = (
      model: DailyTestModel,
      slot: DailyTestCardSlot,
      extra?: Partial<Slide>,
    ): Slide => {
      const result = results[model.id] ?? null;
      return {
        key: `${slot}-${model.id}`,
        model,
        slot,
        completed: !!result,
        scorePercent: result?.score ?? null,
        result,
        ...extra,
      };
    };

    // THE NEXT TEST, built first and kept aside. It is the one card that is always
    // shown, because "what comes next" is the question a returning user asks even
    // on a day with four tests queued — so it is reserved a slot rather than
    // competing for one. Only the FIRST model of that date is used: two locked
    // cards for the same future day tell the user nothing extra.
    let upcoming: Slide | null = null;
    if (nextDate) {
      const next = modelsForDate(data.models, nextDate);
      if (next[0]) {
        upcoming = build(next[0], 'upcoming', {
          indexInDay:
            next.length > 1 ? { index: 1, total: next.length } : undefined,
        });
      }
    }
    if (!upcoming && courseId) {
      // Nothing queued. Rather than leave a gap, stand in for the set that is
      // coming — named after the subcourse, dated tomorrow, and not advertised as
      // a sample, because from the learner's side a new set really is on its way.
      const demo = buildDemoUpcomingModel(
        courseId,
        subcourseId ?? '',
        addDaysToKey(dayKey, 1),
        subcourseName ?? undefined,
      );
      upcoming = {
        key: 'upcoming-demo',
        model: demo,
        slot: 'upcoming',
        completed: false,
        scorePercent: null,
        result: null,
        demo: true,
      };
    }

    // The remaining slots, filled in order of urgency. `room` is what is left once
    // the next-test card has taken its own slot.
    const room = MAX_SLIDES - (upcoming ? 1 : 0);
    const list: Slide[] = [];

    // 1. TODAY — every model released for this exact date, numbered so two tests
    //    on one day read as two tests. `indexInDay.total` stays the REAL total, so
    //    a fourth test that did not fit still shows as "TEST 3 OF 4" rather than
    //    pretending the day only had three.
    const todays = modelsForDate(data.models, dayKey);
    todays.forEach((model, i) => {
      if (list.length >= room) return;
      list.push(
        build(model, 'today', {
          indexInDay: { index: i + 1, total: todays.length },
        }),
      );
    });

    // 2. MISSED — released, the date has gone, never attempted.
    missedModels(data.models, results, dayKey)
      .slice(0, MAX_MISSED_SLIDES)
      .forEach((model) => {
        if (list.length >= room) return;
        list.push(build(model, 'missed'));
      });

    // 3. RECENT RESULTS fill whatever is still free, newest first — so a rest day
    //    shows the last three things the user finished instead of an empty strip.
    const shown = new Set(list.map((s) => s.model.id));
    for (const saved of data.recentResults) {
      if (list.length >= room) break;
      if (shown.has(saved.modelId)) continue;
      const model = data.models.find((m) => m.id === saved.modelId);
      if (!model) continue;
      shown.add(model.id);
      list.push({
        key: `completed-${model.id}`,
        model,
        slot: 'completed',
        completed: true,
        scorePercent: saved.score,
        result: saved,
      });
    }

    // The next test goes last: the cards read left-to-right as now → recently →
    // next, and the carousel opens on something the user can actually act on.
    return upcoming ? [...list, upcoming] : list;
  }, [data, results, dayKey, nextDate, courseId, subcourseId, subcourseName]);

  /** True when the schedule has nothing for today — drives the empty-day card. */
  const hasTestToday = slides.some((s) => s.slot === 'today');

  /** Start / View Result on a card. Starting always goes via the rules popup. */
  const handleSlidePress = (slide: Slide) => {
    if (slide.completed) {
      if (slide.result) {
        openSummary(slide.model.id, slide.result.answers, slide.result.timeTakenSeconds);
        return;
      }
      showToast(t('dailyTest.detailsUnavailable'), 'info');
      return;
    }
    // Only a released, unattempted model can be started. The card already
    // disables its CTA for upcoming/missed/demo, so this is belt-and-braces.
    if (slide.slot !== 'today') return;
    setRulesModel(slide.model);
  };

  const handleHistoryPress = (activity: DailyTestActivity) => {
    if (!activity.answers) {
      showToast(t('dailyTest.detailsUnavailable'), 'info');
      return;
    }
    openSummary(activity.modelId, activity.answers, activity.timeTakenSeconds);
  };

  /** "I understood (Start)" — close the popup, then enter the quiz. */
  const handleRulesConfirm = () => {
    const model = rulesModel;
    setRulesModel(null);
    if (!model) return;
    router.push({
      pathname: '/daily-test/[modelId]/quiz',
      params: { modelId: model.id },
    } as never);
  };

  const recent = useMemo(() => activities.slice(0, 3), [activities]);

  const renderBody = () => {
    if (!subcourseId) {
      return (
        <EmptyState
          icon="school-outline"
          title={t('dailyTest.noCourseTitle')}
          description={t('dailyTest.noCourseMessage')}
          ctaLabel={t('dailyTest.selectCourse')}
          ctaIcon="arrow-forward"
          onCtaPress={() => router.push('/course-setup' as never)}
        />
      );
    }

    if (error) {
      return <ErrorState message={t('dailyTest.errorMessage')} onRetry={refetch} />;
    }

    return (
      <View style={{ gap: spacing.lg }}>
        {/* Model strip. The section row carries a View All link to the full list —
            the same affordance as "Your History", because the strip is only ever
            the four cards that matter today. */}
        {slides.length > 0 || (data && !loading) ? (
          <View style={{ gap: spacing.sm }}>
            <View style={styles.sectionRow}>
              <Text variant="h3" weight="bold">
                {t('dailyTest.modelsSectionTitle')}
              </Text>
              <Pressable
                onPress={() => router.push('/daily-test/models' as never)}
                hitSlop={8}
                style={styles.viewAll}
              >
                <Text variant="bodySmall" weight="semiBold" style={{ color: colors.primary }}>
                  {t('dailyTest.viewAll')}
                </Text>
                <Ionicons name="chevron-forward" size={15} color={colors.primary} />
              </Pressable>
            </View>

            {/* A rest day is stated in one line above the cards rather than in a
                card of its own, which would eat one of the four slots. */}
            {!hasTestToday ? (
              <DailyTestNoTestCard nextDateKey={nextDate} todayKey={dayKey} />
            ) : null}

            {/* Full-bleed, so it cancels the screen padding. */}
            <View style={{ marginHorizontal: -spacing.screenPadding }}>
              <DailyTestCarousel screenPadding={spacing.screenPadding}>
                {slides.map((slide) => (
                  <DailyTestModelCard
                    key={slide.key}
                    model={slide.model}
                    slot={slide.slot}
                    completed={slide.completed}
                    scorePercent={slide.scorePercent}
                    hasPremiumAccess={isPremium}
                    demo={slide.demo}
                    indexInDay={slide.indexInDay}
                    todayKey={dayKey}
                    onPrimaryPress={() => handleSlidePress(slide)}
                    onSubscribePress={() => router.push('/subscription' as never)}
                  />
                ))}
              </DailyTestCarousel>
            </View>
          </View>
        ) : loading ? null : (
          <EmptyState
            icon="calendar-outline"
            title={t('dailyTest.emptyTitle')}
            description={t('dailyTest.emptyMessage')}
          />
        )}

        {/* Your History (on-device) */}
        <View style={{ gap: spacing.sm }}>
          <View style={styles.sectionRow}>
            <Text variant="h3" weight="bold">
              {t('dailyTest.historySectionTitle')}
            </Text>
            <Pressable
              onPress={() => router.push('/daily-test/history' as never)}
              hitSlop={8}
              style={styles.viewAll}
            >
              <Text variant="bodySmall" weight="semiBold" style={{ color: colors.primary }}>
                {t('dailyTest.viewAll')}
              </Text>
              <Ionicons name="chevron-forward" size={15} color={colors.primary} />
            </Pressable>
          </View>

          {recent.length === 0 ? (
            <View style={[styles.emptyRecent, { borderColor: colors.border, borderRadius: radius.md }]}>
              <Ionicons name="time-outline" size={22} color={colors.textSecondary} />
              <Text variant="bodySmall" secondary style={{ textAlign: 'center' }}>
                {t('dailyTest.recentEmpty')}
              </Text>
            </View>
          ) : (
            recent.map((activity, index) => (
              <Animated.View
                key={activity.id}
                entering={FadeInDown.delay(index * 60).springify()}
              >
                <DailyTestHistoryCard
                  activity={activity}
                  onPress={() => handleHistoryPress(activity)}
                />
              </Animated.View>
            ))
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* No `actions` — TopAppBar renders its own built-in theme toggle, exactly
          as on every other page. (An admin-only seed button used to sit here while
          the schedule was being built; the models are seeded now, so it is gone.) */}
      <TopAppBar title={t('dailyTest.title')} />

      {/* Body wrapper — the loader below is absolute-filled to THIS view, so the
          header above stays visible and the spinner centres in the body only. */}
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{
            padding: spacing.screenPadding,
            paddingBottom: insets.bottom + spacing.xl,
            flexGrow: 1,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            subcourseId ? (
              <AppRefreshControl refreshing={refreshing} onRefresh={refresh} />
            ) : undefined
          }
        >
          {courseId && courseName ? (
            <LinearGradient
              colors={['#2563EB', '#1D4ED8', '#0B1F5B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.activeCard}
            >
              <View style={styles.activeGlow} />
              <View style={styles.activeIconBox}>
                <Ionicons name="school" size={26} color="#FFFFFF" />
              </View>
              <View style={styles.activeTextCol}>
                <Text variant="bodySmall" weight="semiBold" style={styles.activeLabel}>
                  {t('dailyTest.activeCourseLabel')}
                </Text>
                <Text variant="h2" weight="bold" style={styles.activeTitle} numberOfLines={2}>
                  {courseName}
                </Text>
                {subcourseName ? (
                  <Text variant="bodySmall" style={styles.activeSub} numberOfLines={1}>
                    {subcourseName}
                  </Text>
                ) : null}
              </View>
              <View style={styles.activeTrendBox}>
                <Ionicons name="flash" size={22} color="#FFFFFF" />
              </View>
            </LinearGradient>
          ) : null}

          <View style={{ marginTop: courseId && courseName ? spacing.lg : 0, flex: 1 }}>
            {renderBody()}
          </View>
        </ScrollView>

        <PageLoaderOverlay visible={loading && !data} opaque label={t('dailyTest.loading')} />
      </View>

      <DailyTestRulesDialog
        visible={!!rulesModel}
        model={rulesModel}
        onStart={handleRulesConfirm}
        onCancel={() => setRulesModel(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  activeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 24,
    padding: 18,
    overflow: 'hidden',
    shadowColor: '#1D4ED8',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  activeGlow: {
    position: 'absolute',
    top: -30,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  activeIconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTextCol: { flex: 1, gap: 3 },
  activeLabel: { color: 'rgba(255,255,255,0.78)', letterSpacing: 0.3 },
  activeTitle: { color: '#FFFFFF' },
  activeSub: { color: 'rgba(255,255,255,0.72)', marginTop: 2 },
  activeTrendBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  emptyRecent: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 26,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
});
