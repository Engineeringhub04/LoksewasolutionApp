// The 7D / 30D / 90D / All control that every range-scoped section reads from.
//
// One control drives five sections, so it lives at the top of the page rather
// than inside any single card — a per-chart switcher would let two charts show
// different windows and quietly invite the user to compare them.
import React, { useCallback, useState } from 'react';
import { Pressable, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { Text } from '@/src/components/misc/Text';
import { useTheme } from '@/src/core/theme';
import type { AnalyticsRange } from '@/src/core/services/analyticsSnapshot';

/** Inset of the sliding pill inside the track, on every side. */
const TRACK_PADDING = 3;

export interface RangeOption {
  value: AnalyticsRange;
  label: string;
}

export interface RangeSwitcherProps {
  options: RangeOption[];
  value: AnalyticsRange;
  onChange: (value: AnalyticsRange) => void;
  style?: StyleProp<ViewStyle>;
}

export function RangeSwitcher({ options, value, onChange, style }: RangeSwitcherProps) {
  const { colors, radius, motion } = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);

  // Same sub-pixel guard the charts use: without it a fractional layout
  // difference re-renders — and so re-animates — the pill forever.
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    setTrackWidth((prev) => (Math.abs(prev - next) < 1 ? prev : next));
  }, []);

  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const segment =
    options.length > 0 ? Math.max(0, (trackWidth - TRACK_PADDING * 2) / options.length) : 0;

  // `withTiming` inside the style means the pill animates to each new position
  // instead of teleporting, without the parent owning a shared value for it.
  const indicatorStyle = useAnimatedStyle(
    () => ({
      transform: [
        {
          translateX: withTiming(activeIndex * segment, {
            duration: motion.standard,
            easing: Easing.out(Easing.cubic),
          }),
        },
      ],
    }),
    [activeIndex, segment, motion.standard],
  );

  return (
    <View
      onLayout={onLayout}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          padding: TRACK_PADDING,
          borderRadius: radius.pill,
          backgroundColor: colors.surfaceAlt,
          borderWidth: 1,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {/* Drawn before the labels so it sits behind them. Width comes from the
          measured track, so it is zero for the first frame and simply invisible. */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: TRACK_PADDING,
            top: TRACK_PADDING,
            bottom: TRACK_PADDING,
            width: segment,
            borderRadius: radius.pill,
            backgroundColor: colors.primary,
          },
          indicatorStyle,
        ]}
      />

      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={{ flex: 1, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text
              variant="caption"
              weight={selected ? 'bold' : 'medium'}
              // White on the primary pill, secondary elsewhere — a theme text
              // colour over the filled pill loses contrast in one theme or the other.
              color={selected ? '#FFFFFF' : colors.textSecondary}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
