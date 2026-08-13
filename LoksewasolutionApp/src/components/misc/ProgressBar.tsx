import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useSharedValue, withTiming, useAnimatedStyle } from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';

export interface ProgressBarProps {
  progress: number;
  height?: number;
  color?: string;
}

export function ProgressBar({ progress, height = 8, color }: ProgressBarProps) {
  const { colors, radius, motion } = useTheme();
  const clamped = Math.max(0, Math.min(1, progress));
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(clamped * 100, { duration: motion.standard });
  }, [clamped, motion.standard, width]);

  const animatedStyle = useAnimatedStyle(() => ({ width: `${width.value}%` }));

  return (
    <View style={{ height, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
      <Animated.View style={[{ height: '100%', backgroundColor: color ?? colors.primary, borderRadius: radius.pill }, animatedStyle]} />
    </View>
  );
}
