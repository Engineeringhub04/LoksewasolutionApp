// Review Answers.
//
// Every question is shown with all four options colour-coded against what the
// user picked: their wrong pick in red with a "Your answer" tag, the right option
// in green with "Correct", and the explanation underneath.
//
// Reachable from the summary and from an attempt in the details screen, and gated
// on the same unlock rule in both cases.
import React, { useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchExamSet, scoreAttempt, areResultsUnlocked } from '@/src/core/firebase/services/examHub';
import { Text } from '@/src/components/misc/Text';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';

const CORRECT = '#16A34A';
const WRONG = '#DC2626';

export default function ExamReviewScreen() {
  const { setId, answers: answersParam, attemptLabel, attemptDate } = useLocalSearchParams<{
    setId: string;
    answers?: string;
    attemptLabel?: string;
    attemptDate?: string;
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
        <PageLoaderOverlay visible label="Loading Answers…" />
      </View>
    );
  }

  if (examSet.error || !set || !breakdown) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <SubpageHeader title="Review Answers" />
        <DataNotFound title="Answers unavailable" onRetry={() => router.back()} />
      </View>
    );
  }

  // Same gate as the summary — reaching this route directly must not bypass it.
  if (!areResultsUnlocked(set, now)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <SubpageHeader title="Review Answers" />
        <DataNotFound
          title="Answers are locked"
          description="Answer review unlocks after the exam window closes, so nobody gains an advantage by finishing early."
          onRetry={() => router.back()}
        />
      </View>
    );
  }

  const stats: { label: string; value: string; color: string }[] = [
    { label: 'Total', value: String(set.questions.length), color: colors.textPrimary },
    { label: 'Correct', value: String(breakdown.correct), color: CORRECT },
    { label: 'Incorrect', value: String(breakdown.incorrect), color: WRONG },
    { label: 'Skipped', value: String(breakdown.skipped), color: colors.textSecondary },
    { label: 'Score', value: `${breakdown.percent}%`, color: colors.primary },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SubpageHeader title="Review Answers" />

      <ScrollView
        contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: insets.bottom + spacing.xxl, gap: spacing.md }}
      >
        {/* Attempt stats */}
        <View style={[styles.statsCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }]}>
          <Text variant="bodyLarge" weight="bold" numberOfLines={2}>{set.title}</Text>
          {attemptLabel || attemptDate ? (
            <Text variant="caption" secondary>
              {[attemptLabel, attemptDate].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
          <View style={styles.statsRow}>
            {stats.map((stat) => (
              <View key={stat.label} style={styles.statItem}>
                <Text variant="body" weight="bold" style={{ color: stat.color }}>{stat.value}</Text>
                <Text variant="caption" secondary>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text variant="bodyLarge" weight="bold">Question Answer Details</Text>

        {set.questions.map((question, index) => {
          const chosen = answers[index] ?? -1;
          const skipped = chosen < 0;
          const gotItRight = chosen === question.correctIndex;

          return (
            <Animated.View
              key={index}
              entering={FadeInDown.delay(Math.min(index, 8) * 40).duration(260)}
              style={[styles.questionCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }]}
            >
              <View style={styles.questionHead}>
                <View style={[styles.qNumber, { backgroundColor: `${colors.primary}17` }]}>
                  <Text variant="caption" weight="bold" style={{ color: colors.primary }}>{index + 1}</Text>
                </View>
                <Text variant="body" weight="semiBold" style={{ flex: 1, lineHeight: 22 }}>{question.question}</Text>
                <Ionicons
                  name={skipped ? 'remove-circle' : gotItRight ? 'checkmark-circle' : 'close-circle'}
                  size={20}
                  color={skipped ? colors.textSecondary : gotItRight ? CORRECT : WRONG}
                />
              </View>

              {question.options.map((option, optionIndex) => {
                const isCorrectOption = optionIndex === question.correctIndex;
                const isUserPick = optionIndex === chosen;
                // The right option is always highlighted green, even when the
                // user skipped — that is the point of a review.
                const tone = isCorrectOption ? CORRECT : isUserPick ? WRONG : null;

                return (
                  <View
                    key={optionIndex}
                    style={[
                      styles.option,
                      {
                        borderRadius: radius.md,
                        borderColor: tone ?? colors.border,
                        backgroundColor: tone ? `${tone}12` : colors.surfaceAlt,
                      },
                    ]}
                  >
                    <View style={[styles.optionBullet, { borderColor: tone ?? colors.border, backgroundColor: tone ?? 'transparent' }]}>
                      <Text variant="caption" weight="bold" style={{ color: tone ? '#FFF' : colors.textSecondary }}>
                        {String.fromCharCode(65 + optionIndex)}
                      </Text>
                    </View>
                    <Text variant="bodySmall" style={{ flex: 1 }}>{option}</Text>

                    {isCorrectOption ? (
                      <View style={[styles.tag, { backgroundColor: CORRECT }]}>
                        <Text variant="caption" weight="bold" style={styles.tagText}>Correct</Text>
                      </View>
                    ) : null}
                    {isUserPick && !isCorrectOption ? (
                      <View style={[styles.tag, { backgroundColor: WRONG }]}>
                        <Text variant="caption" weight="bold" style={styles.tagText}>Wrong</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}

              {skipped ? (
                <View style={[styles.skippedNote, { backgroundColor: colors.surfaceAlt, borderRadius: radius.sm }]}>
                  <Ionicons name="information-circle-outline" size={14} color={colors.textSecondary} />
                  <Text variant="caption" secondary>You skipped this question</Text>
                </View>
              ) : null}

              {question.explanation ? (
                <View style={[styles.explanation, { backgroundColor: `${colors.info}12`, borderRadius: radius.md }]}>
                  <View style={styles.explanationHead}>
                    <Ionicons name="bulb-outline" size={15} color={colors.info} />
                    <Text variant="caption" weight="bold" style={{ color: colors.info }}>Explanation</Text>
                  </View>
                  <Text variant="bodySmall" secondary style={{ lineHeight: 20 }}>{question.explanation}</Text>
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
  statsCard: { borderWidth: StyleSheet.hairlineWidth, gap: 8 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 4 },
  statItem: { alignItems: 'center', minWidth: 54 },
  questionCard: { borderWidth: StyleSheet.hairlineWidth, gap: 10 },
  questionHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  qNumber: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderWidth: 1.5 },
  optionBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  tagText: { color: '#FFF' },
  skippedNote: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8 },
  explanation: { padding: 11, gap: 5 },
  explanationHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
