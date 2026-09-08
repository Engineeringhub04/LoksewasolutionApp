// Daily Test — result summary.
//
// Answers arrive via route params (from the quiz on submit, or from a saved
// result when reopening a completed model from history), so the score shown is
// exactly what was submitted. The score is recomputed here from the model rather
// than trusted from the params, which also means the negative-marking penalty is
// applied with the model's own settings.
//
// This page is the VERDICT only — the per-question breakdown lives on the
// separate Review page behind the "Review Answers" button, so the result reads
// clean at a glance instead of turning into a long scroll.
//
// Back always lands on the Daily Test landing page, never the finished quiz
// (the quiz replace()s to get here, so going "back" to it would be a dead end).
import React, { useMemo } from 'react';
import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useProfileStore } from '@/src/core/store/profileStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import {
  fetchDailyTestModels,
  formatDailyTestDuration,
  scoreDailyTest,
  type DailyTestModel,
} from '@/src/core/firebase/services/dailyTest';
import { Text } from '@/src/components/misc/Text';
import { ProgressRing } from '@/src/components/misc/ProgressRing';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';

function verdict(percent: number, passed: boolean) {
  if (percent >= 85) {
    return {
      color: '#16A34A',
      icon: 'trophy' as const,
      title: 'Outstanding!',
      message: 'A near-perfect warm-up. Come back tomorrow for the next one.',
    };
  }
  if (percent >= 60) {
    return {
      color: '#2563EB',
      icon: 'ribbon' as const,
      title: 'Well done!',
      message: 'A solid run. Review your answers to lock in the few you missed.',
    };
  }
  if (passed) {
    return {
      color: '#D97706',
      icon: 'checkmark-circle' as const,
      title: 'Passed — just',
      message: 'You cleared the pass mark. Review the explanations and tomorrow gets easier.',
    };
  }
  return {
    color: '#DC2626',
    icon: 'refresh-circle' as const,
    title: 'Keep going',
    message: 'Every daily test teaches something. Review your answers and you will climb fast.',
  };
}

export default function DailyTestSummaryScreen() {
  const {
    modelId,
    answers: answersParam,
    timeTaken,
  } = useLocalSearchParams<{
    modelId: string;
    answers?: string;
    timeTaken?: string;
    fromHistory?: string;
  }>();
  const { colors, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const courseInfo = useProfileStore((s) => s.courseInfo);
  const subcourseId = courseInfo?.subcourseId ?? null;

  const modelData = useAsyncData<DailyTestModel | null>(
    async () => {
      if (!subcourseId || !modelId) return null;
      const models = await fetchDailyTestModels(subcourseId);
      // Exact id only. A result belongs to ONE model, so scoring the answer sheet
      // against whatever happened to be today's test would print a confident,
      // wrong percentage. No match → not found.
      return models.find((m) => m.id === modelId) ?? null;
    },
    [subcourseId, modelId],
    { enabled: !!subcourseId },
  );

  const answers = useMemo<number[]>(() => {
    if (!answersParam) return [];
    try {
      const parsed = JSON.parse(answersParam);
      return Array.isArray(parsed) ? parsed.map((v) => Number(v)) : [];
    } catch {
      return [];
    }
  }, [answersParam]);

  const model = modelData.data;
  const breakdown = useMemo(
    () => (model ? scoreDailyTest(model, answers) : null),
    [model, answers],
  );

  /**
   * Back never re-creates the Daily Test screen. The quiz REPLACED itself with
   * this summary, so the screen directly underneath is always the page the user
   * came from (the landing page, or the history list) — popping returns to that
   * live instance instead of pushing a fresh copy. replace() is only the
   * fallback for a cold deep-link where there is nothing to pop to.
   *
   * The header arrow AND the "Back to Daily Test" button at the bottom both call
   * this. They used to differ (the button navigate()d to /daily-test), and that
   * difference was visible: navigate() can resolve to a *new* landing screen, so
   * the button landed on a freshly-mounted page — refetching, scrolled to the
   * top, carousel back at slide one — while the arrow returned to the page the
   * user had left. One action, one behaviour.
   */
  const goToLanding = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/daily-test' as never);
  };

  const openReview = () => {
    if (!model) return;
    router.push({
      pathname: '/daily-test/[modelId]/review',
      params: {
        modelId: model.id,
        answers: JSON.stringify(answers),
        timeTaken: String(Number(timeTaken ?? 0)),
      },
    } as never);
  };

  if (modelData.loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <SubpageHeader title="Your Result" showBack onBackPress={goToLanding} />
        <View style={{ flex: 1 }}>
          <PageLoaderOverlay visible label="Preparing your result…" />
        </View>
      </View>
    );
  }

  if (modelData.error || !model || !breakdown) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <SubpageHeader title="Your Result" showBack onBackPress={goToLanding} />
        <DataNotFound title="Result unavailable" onRetry={goToLanding} />
      </View>
    );
  }

  const band = verdict(breakdown.percent, breakdown.passed);
  const elapsed = Number(timeTaken ?? 0);
  const passTone = breakdown.passed ? '#16A34A' : '#DC2626';

  const stats: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value: string;
    color: string;
  }[] = [
    {
      icon: 'checkmark-circle',
      label: 'Correct',
      value: String(breakdown.correct),
      color: '#16A34A',
    },
    {
      icon: 'close-circle',
      label: 'Incorrect',
      value: String(breakdown.incorrect),
      color: '#DC2626',
    },
    {
      icon: 'remove-circle',
      label: 'Skipped',
      value: String(breakdown.skipped),
      color: colors.textSecondary,
    },
    {
      icon: 'time',
      label: 'Time taken',
      value: formatDailyTestDuration(elapsed),
      color: '#2563EB',
    },
  ];

  // Marks maths, spelled out — this is where the negative-marking penalty becomes
  // visible, so a lower-than-expected percentage never looks like a bug.
  const marksRows: { label: string; value: string; color?: string }[] = [
    { label: 'Marks earned', value: `+${breakdown.marksEarned}`, color: '#16A34A' },
  ];
  if (model.negativeMarking) {
    marksRows.push({
      label: `Penalty (−${Math.round(model.negativeMarkPercent * 100)}% per wrong answer)`,
      value: `−${breakdown.marksLost}`,
      color: '#DC2626',
    });
  }
  marksRows.push({
    label: 'Net marks',
    value: `${breakdown.netMarks} / ${breakdown.totalMarks}`,
  });
  marksRows.push({ label: 'Accuracy', value: `${breakdown.accuracy}%` });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SubpageHeader title="Your Result" showBack onBackPress={goToLanding} />

      <ScrollView
        contentContainerStyle={{
          padding: spacing.screenPadding,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.md,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Score ring */}
        <View
          style={[
            styles.scoreCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.lg,
              padding: spacing.lg,
            },
          ]}
        >
          <Text variant="caption" weight="bold" secondary style={styles.modelLabel} numberOfLines={1}>
            {(model.modelName || model.name).toUpperCase()}
          </Text>

          <ProgressRing
            progress={breakdown.percent / 100}
            size={150}
            strokeWidth={13}
            color={band.color}
            showLabel={false}
          />
          <View style={styles.ringCentre} pointerEvents="none">
            <Text variant="h1" weight="bold" style={{ color: band.color }}>
              {breakdown.percent}%
            </Text>
            <Text variant="caption" secondary>
              {breakdown.correct} / {model.questions.length}
            </Text>
          </View>

          {/* Pass / fail against the model's own pass mark. */}
          <View style={[styles.verdictPill, { backgroundColor: `${passTone}17`, marginTop: spacing.md }]}>
            <Ionicons name={breakdown.passed ? 'trophy' : 'refresh-circle'} size={16} color={passTone} />
            <Text variant="bodySmall" weight="bold" style={{ color: passTone }}>
              {breakdown.passed ? 'PASSED' : 'FAILED'} · pass mark {model.passPercent}%
            </Text>
          </View>

          <Text variant="bodyLarge" weight="bold" style={{ color: band.color, marginTop: spacing.sm }}>
            {band.title}
          </Text>
          <Text
            variant="body"
            secondary
            style={{ textAlign: 'center', marginTop: 4, lineHeight: 21 }}
          >
            {band.message}
          </Text>
        </View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          {stats.map((stat) => (
            <View
              key={stat.label}
              style={[
                styles.statCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                },
              ]}
            >
              <Ionicons name={stat.icon} size={18} color={stat.color} />
              <Text variant="h3" weight="bold">
                {stat.value}
              </Text>
              <Text variant="caption" secondary numberOfLines={1}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Marks breakdown */}
        <View
          style={[
            styles.marksCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.md,
              padding: spacing.cardPadding,
            },
          ]}
        >
          <Text variant="bodySmall" weight="bold" secondary style={styles.eyebrow}>
            MARKS BREAKDOWN
          </Text>
          {marksRows.map((row, index) => (
            <View
              key={row.label}
              style={[
                styles.marksRow,
                index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider } : null,
              ]}
            >
              <Text variant="bodySmall" secondary style={{ flex: 1 }}>
                {row.label}
              </Text>
              <Text variant="bodySmall" weight="bold" style={row.color ? { color: row.color } : undefined}>
                {row.value}
              </Text>
            </View>
          ))}
        </View>

        {/* Actions */}
        <Pressable
          onPress={openReview}
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: colors.primary, borderRadius: radius.md, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Ionicons name="list-outline" size={18} color="#FFF" />
          <Text variant="body" weight="bold" style={{ color: '#FFF' }}>
            Review Answers
          </Text>
        </Pressable>

        <Pressable
          onPress={goToLanding}
          style={({ pressed }) => [
            styles.secondaryBtn,
            { borderColor: colors.border, borderRadius: radius.md, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Ionicons name="home-outline" size={17} color={colors.textPrimary} />
          <Text variant="body" weight="bold">
            Back to Daily Test
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scoreCard: { alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  modelLabel: { letterSpacing: 0.8, marginBottom: 14 },
  // Offset = card padding (24) + label block (~30) + half the ring, minus half
  // the centred text block.
  ringCentre: { position: 'absolute', top: 24 + 30 + 150 / 2 - 26, alignItems: 'center' },
  verdictPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    flexGrow: 1,
    flexBasis: '45%',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  marksCard: { borderWidth: StyleSheet.hairlineWidth },
  eyebrow: { letterSpacing: 0.6, marginBottom: 4 },
  marksRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    marginTop: 4,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderWidth: 1.5,
  },
});
