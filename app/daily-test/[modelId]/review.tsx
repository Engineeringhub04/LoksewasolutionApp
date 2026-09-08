// Daily Test — answer review.
//
// The full per-question breakdown, split out of the Summary so that page stays a
// clean verdict. For every question this shows what the user picked, what the
// right answer was, whether the question was skipped, and the explanation.
//
// A stats card sits at the top so the numbers travel with the detail — the user
// doesn't have to go back to the Summary to remember how they did.
//
// No extra Firestore reads: the answer sheet arrives in the route params (from
// the Summary, which got it from the quiz or from the on-device history entry),
// and the model is re-read from the same low-read subcourse query.
import React, { useMemo } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
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
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';

/** -1 means "not answered". */
const UNANSWERED = -1;

const CORRECT = '#16A34A';
const WRONG = '#DC2626';

export default function DailyTestReviewScreen() {
  const {
    modelId,
    answers: answersParam,
    timeTaken,
  } = useLocalSearchParams<{
    modelId: string;
    answers?: string;
    timeTaken?: string;
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
      // Exact id only. Reviewing an answer sheet against a different model's
      // questions would mark correct answers wrong.
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

  if (modelData.loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <SubpageHeader title="Review Answers" />
        <View style={{ flex: 1 }}>
          <PageLoaderOverlay visible label="Loading your answers…" />
        </View>
      </View>
    );
  }

  if (modelData.error || !model || !breakdown) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <SubpageHeader title="Review Answers" />
        <DataNotFound title="Answers unavailable" onRetry={() => router.back()} />
      </View>
    );
  }

  const elapsed = Number(timeTaken ?? 0);
  const passTone = breakdown.passed ? CORRECT : WRONG;

  const stats: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; color: string }[] =
    [
      { icon: 'checkmark-circle', label: 'Correct', value: String(breakdown.correct), color: CORRECT },
      { icon: 'close-circle', label: 'Wrong', value: String(breakdown.incorrect), color: WRONG },
      {
        icon: 'remove-circle',
        label: 'Skipped',
        value: String(breakdown.skipped),
        color: colors.textSecondary,
      },
      {
        icon: 'time',
        label: 'Time',
        value: formatDailyTestDuration(elapsed),
        color: '#2563EB',
      },
    ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SubpageHeader title="Review Answers" />

      <ScrollView
        contentContainerStyle={{
          padding: spacing.screenPadding,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.md,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* User stats card — static on purpose; only the answer cards animate. */}
        <View
          style={[
            styles.statsCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: radius.lg,
              padding: spacing.cardPadding,
            },
          ]}
        >
          <View style={styles.statsHead}>
            <View style={{ flex: 1 }}>
              <Text variant="caption" weight="bold" secondary style={styles.eyebrow}>
                YOUR ATTEMPT
              </Text>
              <Text variant="bodyLarge" weight="bold" numberOfLines={1}>
                {model.modelName || model.name}
              </Text>
            </View>
            <View style={[styles.scoreBox, { backgroundColor: `${passTone}14`, borderColor: passTone }]}>
              <Text variant="h3" weight="bold" style={{ color: passTone }}>
                {breakdown.percent}%
              </Text>
              <Text variant="caption" weight="bold" style={{ color: passTone, marginTop: -2 }}>
                {breakdown.passed ? 'PASSED' : 'FAILED'}
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          <View style={styles.statsRow}>
            {stats.map((stat) => (
              <View key={stat.label} style={styles.statCell}>
                <Ionicons name={stat.icon} size={16} color={stat.color} />
                <Text variant="bodyLarge" weight="bold" style={{ marginTop: 2 }}>
                  {stat.value}
                </Text>
                <Text variant="caption" secondary numberOfLines={1}>
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          <View style={styles.metaRow}>
            <Text variant="caption" secondary>
              Net marks {breakdown.netMarks} / {breakdown.totalMarks}
            </Text>
            <Text variant="caption" secondary>
              Accuracy {breakdown.accuracy}%
            </Text>
            <Text variant="caption" secondary>
              {model.negativeMarking
                ? `Negative marking −${Math.round(model.negativeMarkPercent * 100)}%`
                : 'No negative marking'}
            </Text>
          </View>
        </View>

        {/* Per-question detail */}
        {model.questions.map((q, qi) => {
          const chosen = answers[qi] ?? UNANSWERED;
          const skipped = chosen === UNANSWERED;
          const gotIt = chosen === q.correctIndex;
          const tone = skipped ? colors.warning : gotIt ? CORRECT : WRONG;

          return (
            <Animated.View
              key={qi}
              entering={FadeInDown.delay(Math.min(qi, 8) * 60).springify()}
              style={[
                styles.reviewCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                },
              ]}
            >
              {/* Verdict header */}
              <View style={styles.reviewHead}>
                <View style={[styles.qBadge, { backgroundColor: `${tone}16` }]}>
                  <Text variant="caption" weight="bold" style={{ color: tone }}>
                    Q{qi + 1}
                  </Text>
                </View>
                <View style={[styles.verdictTag, { backgroundColor: `${tone}14` }]}>
                  <Ionicons
                    name={skipped ? 'remove-circle' : gotIt ? 'checkmark-circle' : 'close-circle'}
                    size={13}
                    color={tone}
                  />
                  <Text variant="caption" weight="bold" style={{ color: tone }}>
                    {skipped ? 'Skipped' : gotIt ? 'Correct' : 'Wrong'}
                  </Text>
                </View>
                {q.category ? (
                  <Text variant="caption" secondary numberOfLines={1} style={{ flex: 1, textAlign: 'right' }}>
                    {q.category}
                  </Text>
                ) : null}
              </View>

              <Text variant="body" weight="semiBold" style={{ marginTop: 10, lineHeight: 23 }}>
                {q.question}
              </Text>

              <View style={{ gap: 8, marginTop: 12 }}>
                {q.options.map((option, oi) => {
                  const isCorrect = oi === q.correctIndex;
                  const isChosen = oi === chosen;
                  const optionTone = isCorrect ? CORRECT : isChosen ? WRONG : colors.border;
                  return (
                    <View
                      key={oi}
                      style={[
                        styles.reviewOption,
                        {
                          borderColor: optionTone,
                          backgroundColor: isCorrect
                            ? `${CORRECT}12`
                            : isChosen
                              ? `${WRONG}12`
                              : 'transparent',
                        },
                      ]}
                    >
                      <Text
                        variant="bodySmall"
                        weight="bold"
                        style={{ color: colors.textSecondary, width: 18 }}
                      >
                        {String.fromCharCode(65 + oi)}
                      </Text>
                      <Text variant="bodySmall" style={{ flex: 1 }}>
                        {option}
                      </Text>

                      {/* Label each option's role so it's unambiguous even when
                          the user's pick WAS the correct one. */}
                      {isCorrect ? (
                        <View style={[styles.optionTag, { backgroundColor: `${CORRECT}20` }]}>
                          <Text variant="caption" weight="bold" style={{ color: CORRECT }}>
                            {isChosen ? 'Your answer · Correct' : 'Correct answer'}
                          </Text>
                        </View>
                      ) : isChosen ? (
                        <View style={[styles.optionTag, { backgroundColor: `${WRONG}20` }]}>
                          <Text variant="caption" weight="bold" style={{ color: WRONG }}>
                            Your answer
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>

              {skipped ? (
                <View style={[styles.skippedNote, { backgroundColor: `${colors.warning}12` }]}>
                  <Ionicons name="alert-circle-outline" size={14} color={colors.warning} />
                  <Text variant="caption" style={{ color: colors.warning, flex: 1 }}>
                    You did not answer this question, so it scored zero.
                  </Text>
                </View>
              ) : null}

              {q.explanation ? (
                <View
                  style={[
                    styles.explainBox,
                    { backgroundColor: `${colors.info}10`, borderRadius: radius.sm },
                  ]}
                >
                  <Text variant="caption" weight="bold" style={{ color: colors.info, marginBottom: 3 }}>
                    EXPLANATION
                  </Text>
                  <Text variant="bodySmall" secondary style={{ lineHeight: 20 }}>
                    {q.explanation}
                  </Text>
                </View>
              ) : null}
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  statsCard: {
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  statsHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  eyebrow: { letterSpacing: 0.7 },
  scoreBox: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 78,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 12 },
  statsRow: { flexDirection: 'row', alignItems: 'flex-start' },
  statCell: { flex: 1, alignItems: 'center', gap: 1 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  reviewCard: { padding: 14, borderWidth: StyleSheet.hairlineWidth },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  verdictTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  reviewOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderRadius: 12,
  },
  optionTag: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  skippedNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
  },
  explainBox: { marginTop: 10, padding: 12 },
});
