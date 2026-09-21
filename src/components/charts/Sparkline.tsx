// Axis-less micro line for KPI tiles. Draws itself in once and then holds still.
import React, { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/src/core/theme';
import { areaPath, buildPoints, polylineLength, smoothPath, type ChartBox } from './chartMath';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export interface SparklineProps {
  values: number[];
  color: string;
  width?: number;
  height?: number;
  strokeWidth?: number;
  showArea?: boolean;
  /** Set false inside long lists where dozens would animate at once. */
  animate?: boolean;
  /** Pins the vertical scale, e.g. to compare two tiles against each other. */
  maxValue?: number;
}

export function Sparkline({
  values,
  color,
  width = 72,
  height = 28,
  strokeWidth = 2,
  showArea = true,
  animate = true,
  maxValue,
}: SparklineProps) {
  const { colors, motion } = useTheme();
  const progress = useSharedValue(animate ? 0 : 1);
  const gradientId = useMemo(() => `spark-${Math.random().toString(36).slice(2, 9)}`, []);

  const geometry = useMemo(() => {
    const box: ChartBox = {
      width,
      height,
      // Half the stroke on each side, or the peak and trough get shaved off.
      padding: { top: strokeWidth, right: strokeWidth, bottom: strokeWidth, left: strokeWidth },
    };
    const points = buildPoints(values, box, { maxValue });
    return {
      points,
      line: smoothPath(points),
      area: areaPath(points, height - strokeWidth),
      // Padded, because the polyline under-measures the smoothed curve and a
      // short dash would clip the end of the line permanently.
      length: polylineLength(points) * 1.15 || 1,
    };
  }, [values, width, height, strokeWidth, maxValue]);

  useEffect(() => {
    if (!animate) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, { duration: motion.emphasis, easing: Easing.out(Easing.cubic) });
  }, [animate, geometry.line, motion.emphasis, progress]);

  const lineProps = useAnimatedProps(() => ({
    strokeDashoffset: geometry.length * (1 - progress.value),
  }));

  const areaProps = useAnimatedProps(() => ({
    // Trails the line so the fill reads as a consequence of it, not a race.
    opacity: Math.max(0, progress.value * 1.6 - 0.6),
  }));

  // One point cannot describe a trend; a dot is honest, a flat line is not.
  if (values.length < 2) {
    return (
      <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={{
            width: 5,
            height: 5,
            borderRadius: 3,
            backgroundColor: values.length === 1 ? color : colors.textDisabled,
          }}
        />
      </View>
    );
  }

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.32} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>

      {showArea ? (
        <AnimatedPath d={geometry.area} fill={`url(#${gradientId})`} animatedProps={areaProps} />
      ) : null}

      <AnimatedPath
        d={geometry.line}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={[geometry.length, geometry.length]}
        animatedProps={lineProps}
      />
    </Svg>
  );
}
