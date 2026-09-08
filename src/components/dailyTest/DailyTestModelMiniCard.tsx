// Compact Daily Test model row — the card used by the All Models page.
//
// The landing strip's gradient card is a poster: one model, full width, big CTA.
// That is the wrong shape for a list of every model a subcourse has, where the
// user is scanning dates and states rather than deciding what to play. So this is
// a flat row on the theme surface — accent bar, state icon, name, a couple of
// chips, and one trailing signal (score, lock, or chevron).
//
// Colour here is free to be green/red/orange, unlike the gradient card: the body
// is the neutral surface, so a green score badge or a red "Missed" label has
// nothing to blend into.
import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';
import {
  formatDateKeyShort,
  relativeDayLabel,
  type DailyTestModel,
} from '@/src/core/firebase/services/dailyTest';
import type { DailyTestCardSlot } from '@/src/components/dailyTest/DailyTestModelCard';

const PASS_GREEN = '#16A34A';
const MISS_RED = '#DC2626';
const PREMIUM_ORANGE = '#C2410C';

export interface DailyTestModelMiniCardProps {
  model: DailyTestModel;
  slot: DailyTestCardSlot;
  /** True when this account has a saved attempt for the model. */
  completed: boolean;
  scorePercent?: number | null;
  hasPremiumAccess: boolean;
  /** Today's key, so dates can read "Today" / "Tomorrow". */
  todayKey?: string;
  onPress?: () => void;
}

export function DailyTestModelMiniCard({
  model,
  slot,
  completed,
  scorePercent,
  hasPremiumAccess,
  todayKey,
  onPress,
}: DailyTestModelMiniCardProps) {
  const { colors, radius } = useTheme();

  const locked = model.isPro && !hasPremiumAccess && slot !== 'missed';

  // State drives the accent, the icon and the eyebrow — one decision, three
  // places, so a row can never say "Completed" in missed-red.
  const state: { label: string; tone: string; icon: keyof typeof Ionicons.glyphMap } = completed
    ? { label: 'Completed', tone: PASS_GREEN, icon: 'checkmark-circle' }
    : slot === 'today'
      ? { label: 'Live now', tone: colors.primary, icon: 'play-circle' }
      : slot === 'upcoming'
        ? { label: 'Upcoming', tone: '#6366F1', icon: 'time-outline' }
        : { label: 'Missed', tone: MISS_RED, icon: 'lock-closed' };

  const dateLabel = model.testDate
    ? todayKey
      ? relativeDayLabel(model.testDate, todayKey)
      : formatDateKeyShort(model.testDate)
    : '';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.md,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      {/* Accent bar — the fastest read in a long list. */}
      <View style={[styles.accent, { backgroundColor: state.tone }]} />

      <View style={[styles.iconBox, { backgroundColor: `${state.tone}18` }]}>
        <Ionicons name={state.icon} size={17} color={state.tone} />
      </View>

      <View style={styles.textCol}>
        <View style={styles.eyebrowRow}>
          <Text variant="caption" weight="bold" style={{ color: state.tone }}>
            {state.label.toUpperCase()}
          </Text>
          {dateLabel ? (
            <>
              <View style={[styles.dot, { backgroundColor: colors.textDisabled }]} />
              <Text variant="caption" secondary>
                {dateLabel}
              </Text>
            </>
          ) : null}
        </View>

        <Text variant="bodySmall" weight="bold" numberOfLines={1}>
          {model.modelName || model.name}
        </Text>

        <View style={styles.chipRow}>
          <Text variant="caption" secondary>
            {model.questions.length} Qs
          </Text>
          <View style={[styles.dot, { backgroundColor: colors.textDisabled }]} />
          <Text variant="caption" secondary>
            Pass {model.passPercent}%
          </Text>
          {model.isPro ? (
            <>
              <View style={[styles.dot, { backgroundColor: colors.textDisabled }]} />
              <Text
                variant="caption"
                weight="bold"
                style={{ color: hasPremiumAccess ? PASS_GREEN : PREMIUM_ORANGE }}
              >
                {hasPremiumAccess ? 'Premium · active' : 'Premium'}
              </Text>
            </>
          ) : null}
        </View>
      </View>

      {/* One trailing signal only: the score if there is one, otherwise why the
          row cannot be opened, otherwise a plain "go". */}
      {completed && typeof scorePercent === 'number' ? (
        <View style={[styles.scoreBadge, { backgroundColor: `${PASS_GREEN}14`, borderColor: PASS_GREEN }]}>
          <Text variant="bodySmall" weight="bold" style={{ color: PASS_GREEN }}>
            {scorePercent}%
          </Text>
        </View>
      ) : locked ? (
        <Ionicons name="diamond" size={16} color={PREMIUM_ORANGE} />
      ) : slot === 'missed' ? (
        <Ionicons name="lock-closed" size={15} color={colors.textDisabled} />
      ) : slot === 'upcoming' ? (
        <Ionicons name="lock-closed-outline" size={15} color={colors.textDisabled} />
      ) : (
        <Ionicons name="chevron-forward" size={17} color={colors.textSecondary} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingRight: 12,
    paddingLeft: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  iconBox: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  textCol: { flex: 1, gap: 1 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  chipRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginTop: 1 },
  dot: { width: 3, height: 3, borderRadius: 2 },
  scoreBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
});
