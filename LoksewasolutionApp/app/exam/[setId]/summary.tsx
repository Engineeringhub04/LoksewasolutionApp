// Result summary shown straight after submitting.
//
// Answers arrive via route params rather than a re-read, so the score shown is
// exactly what was submitted. Review Answers stays locked until the exam's own
// window closes (see areResultsUnlocked) so finishing early can't leak answers.
import React, { useMemo, useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import {
  fetchExamSet,
  scoreAttempt,
  areResultsUnlocked,
  resultsUnlockAt,
  NEGATIVE_MARK_PER_WRONG,
} from '@/src/core/firebase/services/examHub';
import { showToast } from '@/src/core/store/toastStore';
import { Text } from '@/src/components/misc/Text';
import { ProgressRing } from '@/src/components/misc/ProgressRing';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';

/** Message + colour band by score, so the tone matches the result. */
function verdict(percent: number, passed: boolean) {
  if (percent >= 85) {
    return {
      color: '#16A34A',
      icon: 'trophy' as const,
      title: 'Outstanding!',
      message: 'This is top-rank territory. Keep this consistency and the real exam will feel routine.',
    };
  }
  if (percent >= 60) {
    return {
      color: '#2563EB',
      icon: 'ribbon' as const,
      title: 'Well done!',
      message: 'A solid, comfortable pass. Tighten the few topics you slipped on and you are in strong shape.',
    };
  }
  if (passed) {
    return {
      color: '#D97706',
      icon: 'checkmark-circle' as const,
      title: 'You passed',
      message: 'You are over the line, but there is real room to grow. Review the explanations and try again.',
    };
  }
  return {
    color: '#DC2626',
    icon: 'refresh-circle' as const,
    title: 'Not this time',
    message: 'Every attempt shows you exactly what to study next. Read the explanations and re-attempt — this is how scores climb.',
  };
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function ExamSummaryScreen() {
  const { setId, answers: answersParam, timeTaken } = useLocalSearchParams<{
    setId: string;
    answers?: string;
    timeTaken?: string;
  }>();
  const { colors, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [now] = useState(() => Date.now());

  const examSet = useAsyncData(() => (setId ? fetchExamSet(setId) : Promise.resolve(null)), [setId]);

  const answers = useMemo<number[]>(() => {
    if (!answersParam) return [];
    try {
      const parsed = JSON.parse(answersParam);
      return Array.isArray(parsed) ? parsed.map((v) => Number(v)) : [];
    } catch {
      return [];
    }
  }, [answersParam]);

  const set = examSet.data;
  const breakdown = useMemo(
    () => (set ? scoreAttempt(set.questions, answers, set.passPercent) : null),
    [set, answers]
  );

  if (examSet.loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <PageLoaderOverlay visible label="Preparing your result…" />
      </View>
    );
  }

  if (examSet.error || !set || !breakdown) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <SubpageHeader title="Result" showBack={false} />
        <DataNotFound title="Result unavailable" onRetry={() => router.replace('/(tabs)/exam')} />
      </View>
    );
  }

  const band = verdict(breakdown.percent, breakdown.passed);
  const unlocked = areResultsUnlocked(set, now);
  const unlockAt = resultsUnlockAt(set);
  const elapsed = Number(timeTaken ?? 0);

  const stats: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; color: string }[] = [
    { icon: 'checkmark-circle', label: 'Correct', value: String(breakdown.correct), color: '#16A34A' },
    { icon: 'close-circle', label: 'Incorrect', value: String(breakdown.incorrect), color: '#DC2626' },
    { icon: 'remove-circle', label: 'Skipped', value: String(breakdown.skipped), color: colors.textSecondary },
    { icon: 'time', label: 'Time taken', value: formatDuration(elapsed), color: '#2563EB' },
    {
      icon: 'trending-down',
      label: 'Negative marking',
      value: `-${breakdown.negativeMarks.toFixed(2)}`,
      color: '#D97706',
    },
    { icon: 'ribbon', label: 'Pass mark', value: `${set.passPercent}%`, color: '#7C3AED' },
  ];

  const openReview = () => {
    if (!unlocked) {
      showToast(
        unlockAt
          ? `Answers unlock at ${new Date(unlockAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
          : 'Answers are not available yet.',
        'info'
      );
      return;
    }
    router.push({
      pathname: '/exam/[setId]/review',
      params: { setId: set.id, answers: JSON.stringify(answers) },
    } as never);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* No back button: the quiz is gone from the stack, so Back would be a
          dead end. The actions below are the way out. */}
      <SubpageHeader title="Your Result" showBack={false} />

      <ScrollView
        contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: insets.bottom + spacing.xxl, gap: spacing.md }}
      >
        {/* Score ring */}
        <Animated.View
          entering={FadeIn.duration(320)}
          style={[styles.scoreCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg }]}
        >
          <ProgressRing progress={breakdown.percent / 100} size={150} strokeWidth={13} color={band.color} showLabel={false} />
          <View style={styles.ringCentre} pointerEvents="none">
            <Text variant="h1" weight="bold" style={{ color: band.color }}>{breakdown.percent}%</Text>
            <Text variant="caption" secondary>{breakdown.marks.toFixed(2)} / {set.questions.length}</Text>
          </View>

          <View style={[styles.verdictPill, { backgroundColor: `${band.color}17`, marginTop: spacing.md }]}>
            <Ionicons name={band.icon} size={16} color={band.color} />
            <Text variant="bodySmall" weight="bold" style={{ color: band.color }}>
              {breakdown.passed ? 'PASSED' : 'FAILED'}
            </Text>
          </View>

          <Text variant="h3" weight="bold" style={{ marginTop: spacing.sm, textAlign: 'center' }}>{band.title}</Text>
          <Text variant="body" secondary style={{ textAlign: 'center', marginTop: 4, lineHeight: 21 }}>
            {band.message}
          </Text>
        </Animated.View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          {stats.map((stat, index) => (
            <Animated.View
              key={stat.label}
              entering={FadeInDown.delay(index * 50).duration(260)}
              style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md }]}
            >
              <Ionicons name={stat.icon} size={18} color={stat.color} />
              <Text variant="h3" weight="bold">{stat.value}</Text>
              <Text variant="caption" secondary numberOfLines={1}>{stat.label}</Text>
            </Animated.View>
          ))}
        </View>

        {/* Lock notice */}
        {!unlocked ? (
          <View style={[styles.noticeBox, { backgroundColor: `${colors.warning}14`, borderColor: `${colors.warning}44`, borderRadius: radius.md, padding: spacing.md }]}>
            <Ionicons name="lock-closed" size={18} color={colors.warning} />
            <Text variant="bodySmall" style={{ flex: 1, color: colors.textSecondary }}>
              Answer review and rankings unlock once the exam window closes
              {unlockAt ? ` at ${new Date(unlockAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}.
            </Text>
          </View>
        ) : null}

        {/* Actions */}
        <Pressable
          onPress={openReview}
          style={({ pressed }) => [
            styles.primaryBtn,
            {
              backgroundColor: unlocked ? colors.primary : colors.textDisabled,
              borderRadius: radius.md,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Ionicons name={unlocked ? 'eye' : 'lock-closed'} size={17} color="#FFF" />
          <Text variant="body" weight="bold" style={{ color: '#FFF' }}>Review Answers</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push({ pathname: '/exam/[setId]', params: { setId: set.id } } as never)}
          style={({ pressed }) => [styles.secondaryBtn, { borderColor: colors.border, borderRadius: radius.md, opacity: pressed ? 0.8 : 1 }]}
        >
          <Ionicons name="list-outline" size={17} color={colors.textPrimary} />
          <Text variant="body" weight="semiBold">Exam Details & Attempts</Text>
        </Pressable>

        <Pressable
          onPress={() => router.replace('/(tabs)/exam')}
          style={({ pressed }) => [styles.secondaryBtn, { borderColor: colors.border, borderRadius: radius.md, opacity: pressed ? 0.8 : 1 }]}
        >
          <Ionicons name="grid-outline" size={17} color={colors.textPrimary} />
          <Text variant="body" weight="semiBold">Practice Other Exams</Text>
        </Pressable>

        <Text variant="caption" secondary style={{ textAlign: 'center' }}>
          Negative marking: {NEGATIVE_MARK_PER_WRONG} per wrong answer
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scoreCard: { alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  // Overlaid on the ring instead of using its built-in label, so the score and
  // the raw marks can both be shown.
  ringCentre: { position: 'absolute', top: 24 + 150 / 2 - 26, alignItems: 'center' },
  verdictPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    flexGrow: 1,
    flexBasis: '30%',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  noticeBox: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: StyleSheet.hairlineWidth },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15 },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderWidth: 1.5,
  },
});
