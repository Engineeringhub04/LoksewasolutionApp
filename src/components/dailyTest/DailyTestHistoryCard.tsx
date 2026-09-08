// Premium history card for a finished Daily Test attempt.
//
// Shared by the landing screen's "Your History" strip and the full history page,
// so both read identically. The whole card is pressable and reopens the Summary
// for that attempt.
//
// The pass/fail verdict drives the card's colour: a green accent bar, ring and
// pill for a pass, red for a fail. Everything else the user might want to compare
// at a glance — score, correct/wrong/skipped counts, and time taken — sits in a
// row of detail tags underneath.
import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';
import { formatDailyTestDuration } from '@/src/core/firebase/services/dailyTest';
import type { DailyTestActivity } from '@/src/core/services/dailyTestActivity';

const PASS_COLOR = '#16A34A';
const FAIL_COLOR = '#DC2626';

/** Formats an attempt's finish time as a short, human "when". */
function formatWhen(millis: number): string {
  if (!millis) return '';
  const date = new Date(millis);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `Today, ${time}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;

  return date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Older entries were saved before `passed` existed, so fall back to the 40%
 * default pass mark rather than showing them as failures.
 */
function resolvePassed(activity: DailyTestActivity): boolean {
  if (typeof activity.passed === 'boolean') return activity.passed;
  return activity.score >= (activity.passPercent ?? 40);
}

export function DailyTestHistoryCard({
  activity,
  onPress,
}: {
  activity: DailyTestActivity;
  onPress: () => void;
}) {
  const { colors, radius, spacing } = useTheme();

  const passed = resolvePassed(activity);
  const tone = passed ? PASS_COLOR : FAIL_COLOR;

  const tags: { icon: keyof typeof Ionicons.glyphMap; label: string; color: string }[] = [
    { icon: 'checkmark-circle', label: `${activity.correct} correct`, color: PASS_COLOR },
    { icon: 'close-circle', label: `${activity.incorrect} wrong`, color: FAIL_COLOR },
    { icon: 'help-circle', label: `${activity.skipped} skipped`, color: colors.textSecondary },
    {
      icon: 'time-outline',
      label: formatDailyTestDuration(activity.timeTakenSeconds),
      color: colors.textSecondary,
    },
  ];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: pressed ? tone : colors.border,
          borderRadius: radius.lg,
          opacity: pressed ? 0.96 : 1,
        },
      ]}
    >
      {/* Verdict accent bar */}
      <View style={[styles.accent, { backgroundColor: tone }]} />

      <View style={{ flex: 1, padding: spacing.cardPadding, paddingLeft: spacing.cardPadding - 2 }}>
        <View style={styles.headRow}>
          <View style={{ flex: 1 }}>
            <Text variant="bodyLarge" weight="bold" numberOfLines={1}>
              {activity.modelName || 'Daily Test'}
            </Text>
            <Text variant="caption" secondary style={{ marginTop: 2 }}>
              {formatWhen(activity.completedAt)}
            </Text>
          </View>

          {/* Score ring */}
          <View style={[styles.ring, { borderColor: tone, backgroundColor: `${tone}12` }]}>
            <Text variant="bodyLarge" weight="bold" style={{ color: tone }}>
              {Math.round(activity.score)}
            </Text>
            <Text variant="caption" style={{ color: tone, marginTop: -2 }}>
              %
            </Text>
          </View>
        </View>

        {/* Verdict pill + question count */}
        <View style={styles.pillRow}>
          <View style={[styles.pill, { backgroundColor: `${tone}18`, borderRadius: radius.pill }]}>
            <Ionicons name={passed ? 'trophy' : 'refresh-circle'} size={13} color={tone} />
            <Text variant="caption" weight="bold" style={{ color: tone }}>
              {passed ? 'PASSED' : 'FAILED'}
            </Text>
          </View>
          <View
            style={[
              styles.pill,
              { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill },
            ]}
          >
            <Ionicons name="layers-outline" size={13} color={colors.textSecondary} />
            <Text variant="caption" weight="bold" secondary>
              {activity.totalQuestions} questions
            </Text>
          </View>
          {typeof activity.passPercent === 'number' ? (
            <View
              style={[
                styles.pill,
                { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill },
              ]}
            >
              <Ionicons name="flag-outline" size={13} color={colors.textSecondary} />
              <Text variant="caption" weight="bold" secondary>
                Pass {activity.passPercent}%
              </Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.divider, { backgroundColor: colors.divider }]} />

        {/* Detail tags */}
        <View style={styles.tagRow}>
          {tags.map((tag) => (
            <View key={tag.label} style={styles.tag}>
              <Ionicons name={tag.icon} size={13} color={tag.color} />
              <Text variant="caption" style={{ color: tag.color }}>
                {tag.label}
              </Text>
            </View>
          ))}
          <Ionicons
            name="chevron-forward"
            size={16}
            color={colors.textDisabled}
            style={{ marginLeft: 'auto' }}
          />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  accent: { width: 5 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ring: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 12 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  divider: { height: StyleSheet.hairlineWidth, marginTop: 12 },
  tagRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
