import React, { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { useSharedValue, withTiming, useAnimatedProps, Easing } from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface ProgressRingProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  showLabel?: boolean;
}

export function ProgressRing({ progress, size = 80, strokeWidth = 8, color, showLabel = true }: ProgressRingProps) {
  const { colors, motion } = useTheme();
  const clamped = Math.max(0, Math.min(1, progress));
  const radiusValue = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radiusValue;
  const animatedProgress = useSharedValue(0);

  useEffect(() => {
    animatedProgress.value = withTiming(clamped, { duration: motion.emphasis, easing: Easing.out(Easing.cubic) });
  }, [clamped, motion.emphasis, animatedProgress]);

  const animatedPropsCircle = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animatedProgress.value),
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radiusValue} stroke={colors.surfaceAlt} strokeWidth={strokeWidth} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radiusValue}
          stroke={color ?? colors.primary}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedPropsCircle}
          strokeLinecap="round"
          rotation={-90}
          originX={size / 2}
          originY={size / 2}
        />
      </Svg>
      {showLabel ? (
        <View style={{ position: 'absolute' }}>
          <Text weight="bold" variant="h3">{Math.round(clamped * 100)}%</Text>
        </View>
      ) : null}
    </View>
  );
}
