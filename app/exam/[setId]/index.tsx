// Exam details — reached from "Re-Join" on a card the user has already attempted.
//
// Shows the exam's own details, then every attempt with its score and pass/fail
// state. Tapping an attempt opens Review Answers for exactly that attempt.
import React, { useCallback, useMemo, useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { useAuthStore } from '@/src/core/store/authStore';
import { useProfileStore } from '@/src/core/store/profileStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { useRefreshOnFocus } from '@/src/core/hooks/useRefreshOnFocus';
import {
  fetchExamSet,
  fetchAttemptsForSet,
  areResultsUnlocked,
  resultsUnlockAt,
  type ExamAttempt,
} from '@/src/core/firebase/services/examHub';
import { showToast } from '@/src/core/store/toastStore';
import { Text } from '@/src/components/misc/Text';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';

const PASS = '#16A34A';
const FAIL = '#DC2626';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function ExamDetailsScreen() {
  const { setId } = useLocalSearchParams<{ setId: string }>();
  const { colors, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const courseInfo = useProfileStore((s) => s.courseInfo);
  const [now] = useState(() => Date.now());

  const examSet = useAsyncData(() => (setId ? fetchExamSet(setId) : Promise.resolve(null)), [setId]);
  const attempts = useAsyncData(
    () => (user && setId ? fetchAttemptsForSet(user.uid, setId) : Promise.resolve<ExamAttempt[]>([])),
    [user?.uid, setId]
  );

  const set = examSet.data;
  const unlocked = useMemo(() => (set ? areResultsUnlocked(set, now) : false), [set, now]);
  const unlockAt = set ? resultsUnlockAt(set) : null;

  const loading = examSet.loading || attempts.loading;
  const refreshing = examSet.refreshing || attempts.refreshing;

  // Coming back from the summary/review screens must show the new attempt
  // without a manual pull.
  const onRefresh = useCallback(() => {
    examSet.refresh();
    attempts.refresh();
  }, [examSet, attempts]);
  useRefreshOnFocus(onRefresh);

  const requireUnlocked = (action: () => void) => {
    if (unlocked) {
      action();
      return;
    }
    showToast(
      unlockAt
        ? `Unlocks at ${new Date(unlockAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
        : 'Not available yet.',
      'info'
    );
  };

  if (examSet.error || (!loading && !set)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <SubpageHeader title="Exam Details" />
        <DataNotFound title="Exam not found" onRetry={() => examSet.refetch()} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SubpageHeader title="Exam Details" />

      <ScrollView
        contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: insets.bottom + spacing.xxl, gap: spacing.md }}
        refreshControl={
          <AppRefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
      >
        {set ? (
          <>
            {/* Exam details */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }]}>
              <Text variant="bodyLarge" weight="bold">{set.title}</Text>
              <Text variant="bodySmall" secondary>
                {courseInfo?.subcourseName ?? courseInfo?.courseName ?? ''}
              </Text>
              <View style={styles.metaRow}>
                {[
                  { icon: 'help-circle-outline' as const, label: `${set.totalQuestions} Questions` },
                  { icon: 'time-outline' as const, label: `${set.durationMinutes} min` },
                  { icon: 'ribbon-outline' as const, label: `Pass ${set.passPercent}%` },
                  { icon: 'stats-chart-outline' as const, label: set.difficulty },
                ].map((meta) => (
                  <View key={meta.label} style={[styles.metaPill, { backgroundColor: colors.surfaceAlt }]}>
                    <Ionicons name={meta.icon} size={13} color={colors.textSecondary} />
                    <Text variant="caption" weight="semiBold" secondary style={{ textTransform: 'capitalize' }}>
                      {meta.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Actions */}
            <View style={styles.actionRow}>
              <Pressable
                onPress={() =>
                  requireUnlocked(() =>
                    router.push({ pathname: '/exam/[setId]/ranking', params: { setId: set.id } } as never)
                  )
                }
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  { borderColor: colors.border, borderRadius: radius.md, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Ionicons name={unlocked ? 'trophy' : 'lock-closed'} size={16} color="#D97706" />
                <Text variant="bodySmall" weight="semiBold">Your Ranking</Text>
              </Pressable>

              <Pressable
                onPress={() => router.push({ pathname: '/exam/[setId]/quiz', params: { setId: set.id } } as never)}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { backgroundColor: colors.primary, borderRadius: radius.md, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Ionicons name="refresh" size={16} color="#FFF" />
                <Text variant="bodySmall" weight="bold" style={{ color: '#FFF' }}>Re-Attempt</Text>
              </Pressable>
            </View>

            {/* Attempts */}
            <Text variant="bodyLarge" weight="bold" style={{ marginTop: spacing.xs }}>Attempts History</Text>

            {loading ? null : (attempts.data ?? []).length === 0 ? (
              <EmptyState
                icon="document-text-outline"
                title="No attempts yet"
                description="Your attempts will appear here with their scores once you finish this exam."
              />
            ) : (
              (attempts.data ?? []).map((attempt, index) => {
                const passed = attempt.passed === 1;
                const tone = passed ? PASS : FAIL;
                const date = attempt.createdAt?.toDate();
                const dateLabel = date
                  ? `${date.toLocaleDateString()} · ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : '';

                return (
                  <Animated.View key={attempt.id} entering={FadeInDown.delay(index * 50).duration(260)}>
                    <Pressable
                      onPress={() =>
                        requireUnlocked(() =>
                          router.push({
                            pathname: '/exam/[setId]/review',
                            params: {
                              setId: set.id,
                              answers: JSON.stringify(attempt.answers),
                              attemptLabel: `Attempt ${attempt.attemptNumber}`,
                              attemptDate: dateLabel,
                            },
                          } as never)
                        )
                      }
                      style={({ pressed }) => [
                        styles.attemptCard,
                        {
                          backgroundColor: `${tone}0F`,
                          borderColor: `${tone}55`,
                          borderRadius: radius.lg,
                          padding: spacing.md,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <View style={[styles.attemptBadge, { backgroundColor: tone }]}>
                        <Text variant="caption" weight="bold" style={{ color: '#FFF' }}>{attempt.attemptNumber}</Text>
                      </View>

                      <View style={{ flex: 1, gap: 2 }}>
                        <Text variant="body" weight="bold">Attempt {attempt.attemptNumber}</Text>
                        <Text variant="caption" secondary numberOfLines={1}>
                          {dateLabel}{dateLabel ? ' · ' : ''}{formatDuration(attempt.timeTakenSeconds)}
                        </Text>
                        <Text variant="caption" secondary>
                          {attempt.correct} correct · {attempt.incorrect} wrong · {attempt.skipped} skipped
                        </Text>
                      </View>

                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <Text variant="h3" weight="bold" style={{ color: tone }}>{attempt.score}%</Text>
                        <View style={[styles.resultTag, { backgroundColor: tone }]}>
                          <Text variant="caption" weight="bold" style={{ color: '#FFF' }}>
                            {passed ? 'PASS' : 'FAIL'}
                          </Text>
                        </View>
                      </View>

                      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                    </Pressable>
                  </Animated.View>
                );
              })
            )}

            {!unlocked ? (
              <View style={[styles.noticeBox, { backgroundColor: `${colors.warning}14`, borderColor: `${colors.warning}44`, borderRadius: radius.md, padding: spacing.md }]}>
                <Ionicons name="lock-closed" size={16} color={colors.warning} />
                <Text variant="caption" style={{ flex: 1, color: colors.textSecondary }}>
                  Answer review and rankings unlock once the exam window closes.
                </Text>
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      <PageLoaderOverlay visible={loading} label="Loading Exam Details…" />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, gap: 6 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  metaPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  actionRow: { flexDirection: 'row', gap: 10 },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderWidth: 1.5,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
  },
  attemptCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5 },
  attemptBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  resultTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  noticeBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth },
});
