// One exam card in the Exam tab.
//
// The primary button's label/behaviour is driven entirely by
// resolveExamCardState() in services/examHub.ts, so the rules about when an exam
// opens live in one place instead of being re-derived in the UI:
//
//   countdown -> disabled button showing mm:ss until the start time
//   ready     -> "Start" (MCQ) / "View Question" (PDF paper)
//   rejoin    -> "Re-Join" + an extra Ranking button
//   locked    -> "To Buy" + a "Not Purchased" tag
//
// A card in the `hidden` state is filtered out by the screen and never rendered.
import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';
import type { ExamCardState, ExamSet } from '@/src/core/firebase/services/examHub';
import type { AnswerStatus } from '@/src/core/firebase/services/examAnswers';

interface ExamCardProps {
  set: ExamSet;
  state: ExamCardState;
  /** Accent colour of the section this card belongs to. */
  accentColor: string;
  subcourseLabel: string;
  /**
   * Present only for Theory Desk (PDF) cards once the student has uploaded an
   * answer for this set. Switches the card into a muted, view-only "already
   * submitted" look and routes the primary button to the submission details
   * screen instead of back into Upload — multiple attempts are not allowed.
   */
  answerStatus?: AnswerStatus;
  onRulesPress: () => void;
  onPrimaryPress: () => void;
  onRankingPress: () => void;
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatStartTime(date: Date | null): string {
  if (!date) return 'Open now';
  return `Start: ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: '#16A34A',
  medium: '#D97706',
  hard: '#DC2626',
};

export function ExamCard({
  set,
  state,
  accentColor,
  subcourseLabel,
  answerStatus,
  onRulesPress,
  onPrimaryPress,
  onRankingPress,
}: ExamCardProps) {
  const { colors, radius, spacing } = useTheme();
  const isPdf = set.contentType === 'pdf';
  const isSubmitted = isPdf && !!answerStatus;

  const primary = (() => {
    if (isSubmitted) {
      return { label: 'View Details', icon: 'document-lock-outline' as const, disabled: false };
    }
    switch (state.kind) {
      case 'countdown':
        return { label: formatCountdown(state.msRemaining), icon: 'time-outline' as const, disabled: true };
      case 'rejoin':
        return { label: 'Re-Join', icon: 'refresh' as const, disabled: false };
      case 'locked':
        return { label: 'To Buy', icon: 'lock-closed' as const, disabled: false };
      default:
        return isPdf
          ? { label: 'View Question', icon: 'document-text' as const, disabled: false }
          : { label: 'Start', icon: 'play' as const, disabled: false };
    }
  })();

  const meta: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [];
  if (!isPdf) {
    meta.push({ icon: 'help-circle-outline', label: `${set.totalQuestions} Qs` });
    meta.push({ icon: 'time-outline', label: `${set.durationMinutes}m` });
    meta.push({ icon: 'ribbon-outline', label: `Pass ${set.passPercent}%` });
  } else {
    meta.push({ icon: 'document-attach-outline', label: 'PDF paper' });
  }

  return (
    <View
      style={[
        styles.card,
        isSubmitted ? styles.submittedCard : null,
        { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md },
      ]}
    >
      {/* Title row */}
      <View style={styles.titleRow}>
        <View style={[styles.iconBox, { backgroundColor: `${accentColor}17`, borderRadius: radius.md }]}>
          <Ionicons name={isPdf ? 'document-text' : 'help-circle'} size={22} color={accentColor} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyLarge" weight="bold" numberOfLines={2}>{set.title}</Text>
          <Text variant="bodySmall" secondary numberOfLines={1}>{subcourseLabel}</Text>
        </View>
        {isSubmitted ? (
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: (answerStatus === 'reviewed' ? '#16A34A' : '#D97706') + '18' },
            ]}
          >
            <Ionicons
              name={answerStatus === 'reviewed' ? 'checkmark-done-outline' : 'time-outline'}
              size={12}
              color={answerStatus === 'reviewed' ? '#16A34A' : '#D97706'}
            />
            <Text variant="caption" weight="bold" style={{ color: answerStatus === 'reviewed' ? '#16A34A' : '#D97706' }}>
              {answerStatus === 'reviewed' ? 'Reviewed' : 'Pending'}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Meta chips */}
      <View style={styles.chipRow}>
        <View style={[styles.chip, { backgroundColor: `${accentColor}12`, borderColor: `${accentColor}33` }]}>
          <Ionicons name="calendar-outline" size={13} color={accentColor} />
          <Text variant="caption" weight="semiBold" style={{ color: accentColor }}>{formatStartTime(set.startTime)}</Text>
        </View>
        {meta.map((item) => (
          <View key={item.label} style={[styles.chip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <Ionicons name={item.icon} size={13} color={colors.textSecondary} />
            <Text variant="caption" weight="semiBold" secondary>{item.label}</Text>
          </View>
        ))}
      </View>

      {/* Tags */}
      <View style={styles.chipRow}>
        <View style={[styles.chip, { backgroundColor: `${DIFFICULTY_COLOR[set.difficulty]}14`, borderColor: `${DIFFICULTY_COLOR[set.difficulty]}44` }]}>
          <Ionicons name="stats-chart-outline" size={13} color={DIFFICULTY_COLOR[set.difficulty]} />
          <Text variant="caption" weight="bold" style={{ color: DIFFICULTY_COLOR[set.difficulty], textTransform: 'capitalize' }}>
            {set.difficulty}
          </Text>
        </View>

        {set.accessType === 'free' ? (
          <View style={[styles.chip, { backgroundColor: '#16A34A14', borderColor: '#16A34A44' }]}>
            <Ionicons name="checkmark-circle" size={13} color="#16A34A" />
            <Text variant="caption" weight="bold" style={{ color: '#16A34A' }}>Free</Text>
          </View>
        ) : (
          <View
            style={[
              styles.chip,
              state.kind === 'locked'
                ? { backgroundColor: `${colors.error}14`, borderColor: `${colors.error}44` }
                : { backgroundColor: '#16A34A14', borderColor: '#16A34A44' },
            ]}
          >
            <Ionicons
              name={state.kind === 'locked' ? 'lock-closed' : 'checkmark-circle'}
              size={13}
              color={state.kind === 'locked' ? colors.error : '#16A34A'}
            />
            <Text
              variant="caption"
              weight="bold"
              style={{ color: state.kind === 'locked' ? colors.error : '#16A34A' }}
            >
              {state.kind === 'locked' ? 'Not Purchased' : 'Purchased'}
            </Text>
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actionRow}>
        <Pressable
          onPress={onRulesPress}
          style={({ pressed }) => [
            styles.secondaryButton,
            { borderColor: colors.border, borderRadius: radius.md, opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Ionicons name="information-circle-outline" size={16} color={colors.textPrimary} />
          <Text variant="bodySmall" weight="semiBold">Rules</Text>
        </Pressable>

        {state.kind === 'rejoin' ? (
          <Pressable
            onPress={onRankingPress}
            style={({ pressed }) => [
              styles.secondaryButton,
              { borderColor: colors.border, borderRadius: radius.md, opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <Ionicons name="trophy-outline" size={16} color="#D97706" />
            <Text variant="bodySmall" weight="semiBold">Ranking</Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={onPrimaryPress}
          disabled={primary.disabled}
          style={({ pressed }) => [
            styles.primaryButton,
            {
              // "View Details" always stays a fixed green (matches the "View
              // Question" identity colour) regardless of the section's accent —
              // a submitted card's action must read as a distinct, consistent
              // state everywhere, not blend into whichever board it's on.
              backgroundColor: primary.disabled ? colors.textDisabled : isSubmitted ? '#16A34A' : accentColor,
              borderRadius: radius.md,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Ionicons name={primary.icon} size={16} color="#FFF" />
          <Text variant="bodySmall" weight="bold" style={{ color: '#FFF' }}>{primary.label}</Text>
        </Pressable>
      </View>

      {state.kind === 'countdown' ? (
        <Text variant="caption" secondary style={{ textAlign: 'center' }}>
          Opens automatically when the timer ends
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, gap: 12 },
  submittedCard: { opacity: 0.72 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1.5,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
});
