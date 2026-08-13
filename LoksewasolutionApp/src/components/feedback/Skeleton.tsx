// Shimmer skeleton loader (PRD §8.4, §10.2). Left-to-right shimmer sweep.
import React, { useEffect } from 'react';
import { View, type DimensionValue } from 'react-native';
import Animated, { useSharedValue, withRepeat, withTiming, useAnimatedStyle, Easing } from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: object;
}

export function Skeleton({ width = '100%', height = 16, radius, style }: SkeletonProps) {
  const { colors, radius: radiusTokens } = useTheme();
  const shimmer = useSharedValue(0.4);

  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [shimmer]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: shimmer.value }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius ?? radiusTokens.sm,
          backgroundColor: colors.surfaceAlt,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

export function SkeletonCard() {
  const { spacing, radius } = useTheme();
  return (
    <View style={{ padding: spacing.md, borderRadius: radius.md, gap: spacing.sm }}>
      <Skeleton height={100} radius={radius.md} />
      <Skeleton width="70%" height={14} />
      <Skeleton width="40%" height={12} />
    </View>
  );
}
