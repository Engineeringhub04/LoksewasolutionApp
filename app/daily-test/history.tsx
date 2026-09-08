// Daily Test — full history (on-device).
//
// The landing screen shows the latest three under "Your History"; "View All"
// opens this. Everything here comes from AsyncStorage, so it costs no Firestore
// reads.
//
// Tapping an entry reopens its Summary — the answer sheet is stored alongside
// each entry for exactly this reason, so the round trip stays read-free. Entries
// saved before that existed have no answers, and say so rather than opening an
// empty result.
import React, { useCallback, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import {
  getRecentDailyTestActivities,
  type DailyTestActivity,
} from '@/src/core/services/dailyTestActivity';
import { showToast } from '@/src/core/store/toastStore';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { Text } from '@/src/components/misc/Text';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { DailyTestHistoryCard } from '@/src/components/dailyTest/DailyTestHistoryCard';

/** Same fallback the card uses, so the summary strip and the cards agree. */
function isPassed(activity: DailyTestActivity): boolean {
  if (typeof activity.passed === 'boolean') return activity.passed;
  return activity.score >= (activity.passPercent ?? 40);
}

export default function DailyTestHistoryScreen() {
  const { colors, radius, spacing } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const uid = useAuthStore((s) => s.user?.uid) ?? null;
  const [activities, setActivities] = useState<DailyTestActivity[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void getRecentDailyTestActivities(uid).then((list) => {
        if (active) setActivities(list);
      });
      return () => {
        active = false;
      };
    }, [uid]),
  );

  // Lifetime stats across everything still in the local log.
  const totals = useMemo(() => {
    if (activities.length === 0) return null;
    const passed = activities.filter(isPassed).length;
    const avg = Math.round(
      activities.reduce((sum, a) => sum + a.score, 0) / activities.length,
    );
    const best = Math.max(...activities.map((a) => Math.round(a.score)));
    return { attempts: activities.length, passed, avg, best };
  }, [activities]);

  const openSummary = (activity: DailyTestActivity) => {
    if (!activity.answers) {
      showToast(t('dailyTest.detailsUnavailable'), 'info');
      return;
    }
    router.push({
      pathname: '/daily-test/[modelId]/summary',
      params: {
        modelId: activity.modelId,
        answers: JSON.stringify(activity.answers),
        timeTaken: String(activity.timeTakenSeconds),
        fromHistory: '1',
      },
    } as never);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TopAppBar title={t('dailyTest.historyTitle')} />

      {activities.length === 0 ? (
        <EmptyState
          icon="time-outline"
          title={t('dailyTest.historySectionTitle')}
          description={t('dailyTest.recentEmpty')}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: spacing.screenPadding,
            paddingBottom: insets.bottom + spacing.xl,
            gap: spacing.sm,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Lifetime strip — static, and every colour is read from the theme
              (no inherited defaults) so the numbers stay legible in dark mode. */}
          {totals ? (
            <View
              style={[
                styles.totals,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: radius.lg,
                  padding: spacing.cardPadding,
                  marginBottom: spacing.xs,
                },
              ]}
            >
              {[
                { icon: 'layers-outline' as const, label: 'Attempts', value: String(totals.attempts), color: colors.primary },
                { icon: 'trophy-outline' as const, label: 'Passed', value: String(totals.passed), color: '#16A34A' },
                { icon: 'stats-chart-outline' as const, label: 'Average', value: `${totals.avg}%`, color: '#2563EB' },
                { icon: 'flame-outline' as const, label: 'Best', value: `${totals.best}%`, color: '#D97706' },
              ].map((cell) => (
                <View key={cell.label} style={styles.totalCell}>
                  <Ionicons name={cell.icon} size={16} color={cell.color} />
                  <Text
                    variant="bodyLarge"
                    weight="bold"
                    color={colors.textPrimary}
                    style={{ marginTop: 2 }}
                  >
                    {cell.value}
                  </Text>
                  <Text variant="caption" color={colors.textSecondary} numberOfLines={1}>
                    {cell.label}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {activities.map((activity, index) => (
            <Animated.View
              key={activity.id}
              entering={FadeInDown.delay(Math.min(index, 8) * 60).springify()}
            >
              <DailyTestHistoryCard activity={activity} onPress={() => openSummary(activity)} />
            </Animated.View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  totals: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  totalCell: { flex: 1, alignItems: 'center', gap: 1 },
});
