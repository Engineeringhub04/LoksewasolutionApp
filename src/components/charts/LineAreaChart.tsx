// The page's main trend chart: gridlines, y-axis labels, sparse x labels, a
// gradient area fill and a stroke that draws itself in once.
import React, { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';

import { Text } from '@/src/components/misc/Text';
import { useTheme } from '@/src/core/theme';
import { useMeasuredWidth } from './ChartCard';
import {
  areaPath,
  buildPoints,
  compactNumber,
  extent,
  innerHeight,
  linePath,
  niceMax,
  niceTicks,
  polylineLength,
  smoothPath,
  type ChartBox,
} from './chartMath';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export interface LineAreaChartProps {
  values: number[];
  /** One entry per value; empty strings are simply not drawn. */
  labels?: string[];
  color: string;
  height?: number;
  strokeWidth?: number;
  showArea?: boolean;
  showDots?: boolean;
  /** Pins the scale. Leave unset to fit the data. */
  maxValue?: number;
  /** Formats the y-axis labels — percentages, durations, counts. */
  formatValue?: (value: number) => string;
  /**
   * How many leading points are backfilled estimates rather than recorded days.
   * They are drawn dashed and dimmed so an estimate never passes for a
   * measurement.
   */
  seededCount?: number;
  emptyLabel?: string;
}

const PADDING = { top: 12, right: 8, bottom: 22, left: 38 };
const MAX_X_LABELS = 6;

export function LineAreaChart({
  values,
  labels,
  color,
  height = 190,
  strokeWidth = 2.5,
  showArea = true,
  showDots = false,
  maxValue,
  formatValue = compactNumber,
  seededCount = 0,
  emptyLabel,
}: LineAreaChartProps) {
  const { colors, motion } = useTheme();
  const { width, measured, onLayout } = useMeasuredWidth();
  const progress = useSharedValue(0);
  const gradientId = useMemo(() => `line-${Math.random().toString(36).slice(2, 9)}`, []);

  const geometry = useMemo(() => {
    const box: ChartBox = { width, height, padding: PADDING };
    const dataMax = extent(values)?.max ?? 0;
    const top = maxValue ?? niceMax(dataMax);
    const points = buildPoints(values, box, { maxValue: top });
    const baseline = PADDING.top + innerHeight(box);

    // The seeded prefix and the observed remainder overlap by one point,
    // otherwise the two strokes meet with a visible gap at the boundary.
    const cut = Math.max(0, Math.min(seededCount, points.length));
    const seededPoints = cut >= 2 ? points.slice(0, cut) : [];
    const livePoints = cut >= 1 ? points.slice(Math.max(0, cut - 1)) : points;

    return {
      points,
      baseline,
      ticks: niceTicks(top, 4),
      top,
      seededLine: seededPoints.length >= 2 ? smoothPath(seededPoints) : '',
      liveLine: livePoints.length >= 2 ? smoothPath(livePoints) : linePath(livePoints),
      area: showArea ? areaPath(points, baseline) : '',
      length: polylineLength(livePoints) * 1.15 || 1,
      liveStart: Math.max(0, cut - 1),
    };
  }, [values, width, height, maxValue, seededCount, showArea]);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: motion.emphasis, easing: Easing.out(Easing.cubic) });
  }, [geometry.liveLine, motion.emphasis, progress]);

  const lineProps = useAnimatedProps(() => ({
    strokeDashoffset: geometry.length * (1 - progress.value),
  }));

  const fadeProps = useAnimatedProps(() => ({
    opacity: Math.max(0, progress.value * 1.6 - 0.6),
  }));

  const seededProps = useAnimatedProps(() => ({
    opacity: Math.max(0, progress.value * 1.6 - 0.6) * 0.55,
  }));

  // x labels are thinned rather than rotated — a 90-day range would otherwise
  // stack 90 unreadable strings along the axis.
  const labelStep = labels?.length ? Math.max(1, Math.ceil(labels.length / MAX_X_LABELS)) : 1;

  if (values.length < 2) {
    return (
      <View onLayout={onLayout} style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text variant="bodySmall" secondary>
          {emptyLabel}
        </Text>
      </View>
    );
  }

  // One frame of empty space while the slot measures. Drawing at the fallback
  // width first would start the reveal, then restart it at the real width — a
  // visible stutter every time the chart mounts.
  if (!measured) return <View onLayout={onLayout} style={{ height }} />;

  return (
    <View onLayout={onLayout}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.3} />
            <Stop offset="1" stopColor={color} stopOpacity={0.02} />
          </LinearGradient>
        </Defs>

        {/* Gridlines and their labels, drawn from the top down so the axis reads
            high-to-low the way the values do. */}
        {geometry.ticks.map((tick, index) => {
          const ratio = geometry.top > 0 ? tick / geometry.top : 0;
          const y = geometry.baseline - ratio * (geometry.baseline - PADDING.top);
          return (
            <G key={index}>
              <Line
                x1={PADDING.left}
                y1={y}
                x2={width - PADDING.right}
                y2={y}
                stroke={colors.divider}
                strokeWidth={1}
                strokeDasharray={index === 0 ? undefined : [3, 5]}
              />
              <SvgText
                x={PADDING.left - 6}
                y={y + 3.5}
                fill={colors.textDisabled}
                fontSize={9}
                textAnchor="end"
              >
                {formatValue(tick)}
              </SvgText>
            </G>
          );
        })}

        {showArea ? (
          <AnimatedPath d={geometry.area} fill={`url(#${gradientId})`} animatedProps={fadeProps} />
        ) : null}

        {geometry.seededLine ? (
          <AnimatedPath
            d={geometry.seededLine}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={[5, 4]}
            animatedProps={seededProps}
          />
        ) : null}

        <AnimatedPath
          d={geometry.liveLine}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={[geometry.length, geometry.length]}
          animatedProps={lineProps}
        />

        {showDots
          ? geometry.points.map((point, index) =>
              index >= geometry.liveStart ? (
                <Circle
                  key={index}
                  cx={point.x}
                  cy={point.y}
                  r={2.5}
                  fill={colors.card}
                  stroke={color}
                  strokeWidth={1.5}
                />
              ) : null,
            )
          : null}

        {/* The most recent value always gets a marker — it is the number the
            user actually came to check. */}
        <Circle
          cx={geometry.points[geometry.points.length - 1].x}
          cy={geometry.points[geometry.points.length - 1].y}
          r={3.5}
          fill={color}
          stroke={colors.card}
          strokeWidth={2}
        />

        {labels?.map((label, index) => {
          if (!label) return null;
          const isLast = index === labels.length - 1;
          if (index % labelStep !== 0 && !isLast) return null;
          const point = geometry.points[index];
          if (!point) return null;
          return (
            <SvgText
              key={index}
              x={point.x}
              y={height - 6}
              fill={colors.textDisabled}
              fontSize={9}
              textAnchor={index === 0 ? 'start' : isLast ? 'end' : 'middle'}
            >
              {label}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}
