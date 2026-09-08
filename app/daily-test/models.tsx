// Daily Test — All Models.
//
// The landing strip answers "what should I do now?" in four cards. This page
// answers the other question: "what is there?" Every model the subcourse has,
// grouped by release date with the newest at the top, so scrolling down is
// scrolling back in time.
//
// Reads are the same two queries the landing page makes — the subcourse's models
// and this account's saved results — so opening All Models costs no more than
// opening the tab. Everything else (which rows are live, missed, done) is derived
// from those two in memory. Session completions are merged on top, so a test
// finished a moment ago already reads as done here.
//
// A row is only startable when its date is today; past-unattempted rows are
// locked as missed and future rows are locked until their date. That mirrors the
// gradient card exactly, which is the point: the two surfaces must never disagree
// about whether something can be opened.
import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  formatDateKeyLong,
  relativeDayLabel,
  type DailyTestModel,
  type DailyTestResult,
} from '@/src/core/firebase/services/dailyTest';
import { showToast } from '@/src/core/store/toastStore';
import { useDailyTestCompletionStore } from '@/src/core/store/dailyTestCompletionStore';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { Text } from '@/src/components/misc/Text';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { ErrorState } from '@/src/components/feedback/ErrorState';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { DailyTestModelMiniCard } from '@/src/components/dailyTest/DailyTestModelMiniCard';
import { DailyTestRulesDialog } from '@/src/components/dailyTest/DailyTestRulesDialog';
import type { DailyTestCardSlot } from '@/src/components/dailyTest/DailyTestModelCard';

interface AllModelsData {
  models: DailyTestModel[];
  results: Record<string, DailyTestResult>;
}

interface DateGroup {
  dateKey: string;
  models: DailyTestModel[];
}

export default function DailyTestAllModelsScreen() {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const user = useAuthStore((s) => s.user);
  const profile = useProfileStore((s) => s.profile);
  const courseInfo = useProfileStore((s) => s.courseInfo);
  const subcourseId = courseInfo?.subcourseId ?? null;
  const isPremium = hasActivePremium(profile);

  const [rulesModel, setRulesModel] = useState<DailyTestModel | null>(null);

  const { data, loading, refreshing, error, refetch, refresh } = useAsyncData<AllModelsData>(
    async () => {
      if (!subcourseId) return { models: [], results: {} };
      const models = await fetchDailyTestModels(subcourseId);
      const saved = user?.uid ? await fetchDailyTestResults(user.uid).catch(() => []) : [];
      const results: Record<string, DailyTestResult> = {};
      for (const r of saved) if (!results[r.modelId]) results[r.modelId] = r;
      return { models, results };
    },
    [subcourseId, user?.uid],
    { enabled: !!subcourseId },
  );

  // Same midnight watch as the landing page: a model dated tomorrow flips from
  // "Upcoming" to "Live now" on this page too, without a relaunch.
  const dayKey = useLocalDayKey({
    onDayChange: useCallback(() => {
      if (subcourseId) refetch();
    }, [subcourseId, refetch]),
  });

  const sessionCompletions = useDailyTestCompletionStore((s) =>
    user?.uid ? s.byUser[user.uid] : undefined,
  );

  const results = useMemo<Record<string, DailyTestResult>>(
    () => ({ ...(data?.results ?? {}), ...(sessionCompletions ?? {}) }),
    [data?.results, sessionCompletions],
  );

  // Newest date first. Keys are "YYYY-MM-DD", so a plain string compare is a
  // chronological compare — no Date objects, nothing a timezone can shift.
  const groups = useMemo<DateGroup[]>(() => {
    if (!data) return [];
    const byDate = new Map<string, DailyTestModel[]>();
    for (const model of data.models) {
      if (!model.testDate) continue; // unscheduled documents are not shown anywhere
      const bucket = byDate.get(model.testDate);
      if (bucket) bucket.push(model);
      else byDate.set(model.testDate, [model]);
    }
    return [...byDate.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
      .map(([dateKey, models]) => ({
        dateKey,
        // Within a day, the admin's own order wins; the id only breaks ties so the
        // list can never reshuffle between renders.
        models: [...models].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)),
      }));
  }, [data]);

  /** Where a model sits relative to today — the single source for its row state. */
  const slotFor = useCallback(
    (model: DailyTestModel): DailyTestCardSlot => {
      if (model.testDate > dayKey) return 'upcoming';
      if (model.testDate === dayKey) return 'today';
      return results[model.id] ? 'completed' : 'missed';
    },
    [dayKey, results],
  );

  const handlePress = (model: DailyTestModel) => {
    const saved = results[model.id];
    if (saved) {
      router.push({
        pathname: '/daily-test/[modelId]/summary',
        params: {
          modelId: model.id,
          answers: JSON.stringify(saved.answers),
          timeTaken: String(saved.timeTakenSeconds),
          fromHistory: '1',
        },
      } as never);
      return;
    }

    const slot = slotFor(model);
    if (slot === 'upcoming') {
      showToast(
        `${t('dailyTest.unlocksOn')} ${relativeDayLabel(model.testDate, dayKey)}`,
        'info',
      );
      return;
    }
    if (slot === 'missed') {
      showToast(t('dailyTest.missedLocked'), 'info');
      return;
    }
    if (model.isPro && !isPremium) {
      router.push('/subscription' as never);
      return;
    }
    setRulesModel(model);
  };

  const handleRulesConfirm = () => {
    const model = rulesModel;
    setRulesModel(null);
    if (!model) return;
    router.push({
      pathname: '/daily-test/[modelId]/quiz',
      params: { modelId: model.id },
    } as never);
  };

  const renderBody = () => {
    if (!subcourseId) {
      return (
        <EmptyState
          icon="school-outline"
          title={t('dailyTest.noCourseTitle')}
          description={t('dailyTest.noCourseMessage')}
        />
      );
    }
    if (error) return <ErrorState message={t('dailyTest.errorMessage')} onRetry={refetch} />;
    if (loading && !data) return null;
    if (groups.length === 0) {
      return (
        <EmptyState
          icon="calendar-outline"
          title={t('dailyTest.emptyTitle')}
          description={t('dailyTest.allModelsEmpty')}
        />
      );
    }

    // A running index across groups, so the entrance stagger reads as one list
    // rather than restarting at every date heading.
    let row = -1;

    return (
      <View style={{ gap: spacing.md }}>
        {groups.map((group) => {
          const relative = relativeDayLabel(group.dateKey, dayKey);
          const isToday = group.dateKey === dayKey;
          const isFuture = group.dateKey > dayKey;
          const tone = isToday ? colors.primary : isFuture ? '#6366F1' : colors.textSecondary;

          return (
            <View key={group.dateKey} style={{ gap: spacing.xs }}>
              {/* Date heading. The relative word carries the meaning ("Today",
                  "Tomorrow"), the full date carries the fact. */}
              <View style={styles.dateRow}>
                <View style={[styles.datePill, { backgroundColor: `${tone}14`, borderColor: `${tone}40` }]}>
                  <Ionicons
                    name={isFuture ? 'time-outline' : isToday ? 'flash' : 'calendar-outline'}
                    size={12}
                    color={tone}
                  />
                  <Text variant="caption" weight="bold" style={{ color: tone }}>
                    {relative.toUpperCase()}
                  </Text>
                </View>
                <Text variant="caption" secondary>
                  {formatDateKeyLong(group.dateKey)}
                </Text>
                <View style={[styles.rule, { backgroundColor: colors.border }]} />
                <Text variant="caption" secondary>
                  {group.models.length === 1 ? '1 test' : `${group.models.length} tests`}
                </Text>
              </View>

              {group.models.map((model) => {
                row += 1;
                const saved = results[model.id] ?? null;
                return (
                  <Animated.View
                    key={model.id}
                    entering={FadeInDown.delay(Math.min(row, 8) * 60).springify()}
                  >
                    <DailyTestModelMiniCard
                      model={model}
                      slot={slotFor(model)}
                      completed={!!saved}
                      scorePercent={saved?.score ?? null}
                      hasPremiumAccess={isPremium}
                      todayKey={dayKey}
                      onPress={() => handlePress(model)}
                    />
                  </Animated.View>
                );
              })}
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TopAppBar title={t('dailyTest.allModelsTitle')} />

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
          {/* One-line context strip: which subcourse this list belongs to, so the
              page is self-explanatory when reached from a deep link. */}
          {courseInfo?.subcourseName ? (
            <View
              style={[
                styles.contextStrip,
                {
                  backgroundColor: `${colors.primary}0F`,
                  borderColor: `${colors.primary}26`,
                  borderRadius: radius.md,
                  marginBottom: spacing.md,
                },
              ]}
            >
              <Ionicons name="library-outline" size={15} color={colors.primary} />
              <Text variant="caption" weight="semiBold" numberOfLines={1} style={{ flex: 1 }}>
                {courseInfo.subcourseName}
              </Text>
              {data ? (
                <Text variant="caption" secondary>
                  {data.models.length} total
                </Text>
              ) : null}
            </View>
          ) : null}

          {renderBody()}
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
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 2 },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  contextStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
