// Seven dots for the last seven days — the smallest possible answer to "am I
// actually keeping this up?".
//
// Three states, not two. A day with no snapshot is drawn as a hollow ring rather
// than an empty dot, because "we have no record of this day" and "you did nothing
// this day" are different claims and only one of them is ours to make.
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { Text } from '@/src/components/misc/Text';
import { useTheme } from '@/src/core/theme';
import type { WeekDot } from './analyticsDerive';

const DOT = 28;

export interface WeekStripProps {
  dots: WeekDot[];
  /** Seven short weekday names in the active language, Sunday first. */
  weekdayLabels: string[];
  color: string;
}

export function WeekStrip({ dots, weekdayLabels, color }: WeekStripProps) {
  const { colors, motion } = useTheme();
  const progress = useSharedValue(0);

  const signature = dots.map((dot) => `${dot.activities > 0 ? 1 : 0}${dot.recorded ? 'r' : ''}`).join('');

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: motion.standard, easing: Easing.out(Easing.cubic) });
    // Keyed on the pattern, not the array: the parent hands us a fresh array on
    // every render and identity would replay this constantly.
  }, [signature, motion.standard, progress]);

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {dots.map((dot, index) => (
        <View key={dot.key} style={{ alignItems: 'center', gap: 4 }}>
          <Text variant="caption" secondary numberOfLines={1}>
            {weekdayLabels[dot.weekday] ?? ''}
          </Text>
          <Dot
            active={dot.activities > 0}
            recorded={dot.recorded}
            today={dot.today}
            color={color}
            colors={colors}
            progress={progress}
            index={index}
          />
        </View>
      ))}
    </View>
  );
}

function Dot({
  active,
  recorded,
  today,
  color,
  colors,
  progress,
  index,
}: {
  active: boolean;
  recorded: boolean;
  today: boolean;
  color: string;
  colors: { surfaceAlt: string; border: string; primary: string };
  progress: SharedValue<number>;
  index: number;
}) {
  // Each dot takes a slice of one shared timeline rather than owning a value, so
  // the strip pops in left to right off a single animation.
  const style = useAnimatedStyle(() => {
    const startAt = (index / 7) * 0.6;
    const span = 1 - startAt;
    const local = span <= 0 ? 1 : Math.max(0, Math.min(1, (progress.value - startAt) / span));
    return { transform: [{ scale: 0.6 + local * 0.4 }], opacity: local };
  });

  return (
    <Animated.View
      style={[
        {
          width: DOT,
          height: DOT,
          borderRadius: DOT / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: active ? color : recorded ? colors.surfaceAlt : 'transparent',
          borderWidth: active ? 0 : recorded ? 0 : 1,
          borderColor: colors.border,
          borderStyle: 'dashed',
        },
        style,
      ]}
    >
      {/* Today is marked with a ring rather than a different fill, so it can be
          both "today" and "done" at once. */}
      {today ? (
        <View
          style={{
            position: 'absolute',
            width: DOT + 6,
            height: DOT + 6,
            borderRadius: (DOT + 6) / 2,
            borderWidth: 1.5,
            borderColor: colors.primary,
          }}
        />
      ) : null}
      {active ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' }} /> : null}
    </Animated.View>
  );
}
