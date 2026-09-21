// "You vs your subcourse" — where the user sits among everyone studying the same
// thing.
//
// Loaded behind a tap, never on mount. The board is up to 300 documents; spending
// that on every visit for a section not everyone cares about is the kind of cost
// that only shows up on someone else's phone bill.
//
// The strip is deliberately NOT a ranking list. A list invites comparison to
// individuals; a distribution shows the user their own position against a shape,
// which is the honest reading of a single number in a crowd.
import React, { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/src/components/misc/Text';
import { Spinner } from '@/src/components/feedback/Spinner';
import { useTheme } from '@/src/core/theme';
import type { CohortFacts } from './analyticsDerive';

const TRACK_HEIGHT = 10;
const MARKER = 18;

export interface CohortStripProps {
  facts: CohortFacts | null;
  loading: boolean;
  /** Shown before the section has ever been opened. */
  prompt: string;
  loadLabel: string;
  emptyLabel: string;
  medianLabel: string;
  youLabel: string;
  /** Label for the "points to catch the person above" cell. */
  toNextLabel: string;
  /** Pre-formatted lines the screen builds, so wording stays in the screen's i18n. */
  headline?: string;
  subline?: string;
  boardLabel: string;
  onLoad: () => void;
  onOpenBoard: () => void;
}

export function CohortStrip({
  facts,
  loading,
  prompt,
  loadLabel,
  emptyLabel,
  medianLabel,
  youLabel,
  toNextLabel,
  headline,
  subline,
  boardLabel,
  onLoad,
  onOpenBoard,
}: CohortStripProps) {
  const { colors, radius, spacing } = useTheme();

  if (loading) {
    return (
      <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.lg, gap: spacing.sm }}>
        <Spinner />
        <Text variant="caption" secondary>
          {loadLabel}
        </Text>
      </View>
    );
  }

  if (!facts) {
    return (
      <Pressable
        onPress={onLoad}
        accessibilityRole="button"
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          padding: spacing.md,
          borderRadius: radius.md,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: colors.border,
          backgroundColor: colors.surfaceAlt,
          opacity: pressed ? 0.75 : 1,
        })}
      >
        <Ionicons name="people-outline" size={18} color={colors.primary} />
        <Text variant="bodySmall" secondary style={{ flex: 1 }}>
          {prompt}
        </Text>
        <Text variant="caption" weight="semiBold" color={colors.primary}>
          {loadLabel}
        </Text>
      </Pressable>
    );
  }

  if (facts.rank == null || facts.size === 0) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
        <Text variant="bodySmall" secondary>
          {emptyLabel}
        </Text>
      </View>
    );
  }

  // Every marker is placed on one axis — points, zero to the leader — so the
  // user's position and the cohort median are directly comparable instead of one
  // being a rank and the other a score.
  const medianPosition =
    facts.topPoints > 0 ? Math.max(0, Math.min(100, (facts.medianPoints / facts.topPoints) * 100)) : 0;

  return (
    <View style={{ gap: spacing.md }}>
      {headline ? (
        <View style={{ gap: 2 }}>
          <Text variant="h3" weight="bold">
            {headline}
          </Text>
          {subline ? (
            <Text variant="caption" secondary>
              {subline}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={{ paddingTop: MARKER / 2 + 2, paddingBottom: 2 }}>
        <View
          style={{
            height: TRACK_HEIGHT,
            borderRadius: radius.pill,
            backgroundColor: colors.surfaceAlt,
            overflow: 'visible',
            justifyContent: 'center',
          }}
        >
          <Fill ratio={(facts.position ?? 0) / 100} color={colors.primary} radius={radius.pill} />

          {/* The cohort median sits on the same track as a plain tick. It is the
              number that tells the user whether their position is good, and it
              costs nothing to draw. */}
          <Tick left={medianPosition} color={colors.textSecondary} label={medianLabel} />
          <Marker left={facts.position ?? 0} color={colors.primary} label={youLabel} />
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Cell label={medianLabel} value={`${Math.round(facts.medianPoints)}`} />
        <Cell label={youLabel} value={`${Math.round(facts.myPoints)}`} accent={colors.primary} />
        {facts.pointsToNext != null ? (
          <Cell label={toNextLabel} value={`+${Math.round(facts.pointsToNext)}`} />
        ) : null}
      </View>

      <Pressable
        onPress={onOpenBoard}
        accessibilityRole="button"
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text variant="caption" weight="semiBold" color={colors.primary}>
          {boardLabel}
        </Text>
        <Ionicons name="chevron-forward" size={13} color={colors.primary} />
      </Pressable>
    </View>
  );
}

function Fill({ ratio, color, radius }: { ratio: number; color: string; radius: number }) {
  const { motion } = useTheme();
  const progress = useSharedValue(0);
  const target = Math.max(0, Math.min(1, ratio));

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: motion.emphasis, easing: Easing.out(Easing.cubic) });
  }, [target, motion.emphasis, progress]);

  const style = useAnimatedStyle(() => ({ width: `${target * progress.value * 100}%` }));

  return (
    <Animated.View
      style={[
        { position: 'absolute', left: 0, height: '100%', borderRadius: radius, backgroundColor: color },
        style,
      ]}
    />
  );
}

function Tick({ left, color, label }: { left: number; color: string; label: string }) {
  return (
    <View
      style={{ position: 'absolute', left: `${Math.max(0, Math.min(100, left))}%` }}
      pointerEvents="none"
      accessibilityLabel={label}
    >
      <View style={{ width: 2, height: TRACK_HEIGHT + 6, marginTop: -3, marginLeft: -1, backgroundColor: color, opacity: 0.55 }} />
    </View>
  );
}

function Marker({ left, color, label }: { left: number; color: string; label: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{ position: 'absolute', left: `${Math.max(0, Math.min(100, left))}%` }}
      pointerEvents="none"
      accessibilityLabel={label}
    >
      <View
        style={{
          width: MARKER,
          height: MARKER,
          marginLeft: -MARKER / 2,
          marginTop: -(MARKER - TRACK_HEIGHT) / 2,
          borderRadius: MARKER / 2,
          backgroundColor: color,
          borderWidth: 3,
          borderColor: colors.surface,
        }}
      />
    </View>
  );
}

function Cell({ label, value, accent }: { label: string; value: string; accent?: string }) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        gap: 1,
        padding: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: colors.surfaceAlt,
      }}
    >
      <Text variant="caption" secondary numberOfLines={1}>
        {label}
      </Text>
      <Text variant="body" weight="bold" color={accent} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
