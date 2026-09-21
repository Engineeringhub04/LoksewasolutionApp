// Two bar renderers that share a scale and a stagger.
//
// `BarChart` is the vertical, time-indexed one (daily effort). `RankedBars` is
// the horizontal, category-indexed one (accuracy by source, points breakdown) —
// different enough in layout to deserve its own renderer, close enough in intent
// to live beside it.
import React, { useEffect, useMemo } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { Text } from '@/src/components/misc/Text';
import { useTheme } from '@/src/core/theme';
import { useMeasuredWidth } from './ChartCard';
import {
  buildBars,
  compactNumber,
  extent,
  innerHeight,
  innerWidth,
  niceMax,
  type BarRect,
  type ChartBox,
} from './chartMath';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const PADDING = { top: 12, right: 6, bottom: 20, left: 34 };
/** The last bar starts moving when the first is halfway — a ripple, not a wave. */
const STAGGER_SPAN = 0.5;
const MAX_X_LABELS = 7;

export interface BarChartProps {
  values: number[];
  labels?: string[];
  color: string;
  height?: number;
  maxValue?: number;
  /** Draws a dashed reference line, e.g. the period average. */
  averageValue?: number;
  averageLabel?: string;
  /** Per-bar tint override — used to mark weekends. */
  accentIndices?: number[];
  accentColor?: string;
  /** Leading bars that are backfilled estimates; drawn dimmer. */
  seededCount?: number;
  selectedIndex?: number | null;
  onSelect?: (index: number) => void;
  formatValue?: (value: number) => string;
  emptyLabel?: string;
}

export function BarChart({
  values,
  labels,
  color,
  height = 180,
  maxValue,
  averageValue,
  averageLabel,
  accentIndices,
  accentColor,
  seededCount = 0,
  selectedIndex = null,
  onSelect,
  formatValue = compactNumber,
  emptyLabel,
}: BarChartProps) {
  const { colors, motion, radius } = useTheme();
  const { width, measured, onLayout } = useMeasuredWidth();
  const progress = useSharedValue(0);

  const accents = useMemo(() => new Set(accentIndices ?? []), [accentIndices]);
  const signature = useMemo(() => values.join(','), [values]);

  const geometry = useMemo(() => {
    const box: ChartBox = { width, height, padding: PADDING };
    const top = maxValue ?? niceMax(extent(values)?.max ?? 0);
    return {
      bars: buildBars(values, box, { maxValue: top, gapRatio: values.length > 40 ? 0.2 : 0.36 }),
      baseline: PADDING.top + innerHeight(box),
      plotWidth: innerWidth(box),
      top,
    };
  }, [values, width, height, maxValue]);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: motion.emphasis, easing: Easing.out(Easing.cubic) });
    // Keyed on the VALUES, not the array identity: a parent re-render (selecting
    // a bar, switching theme) passes a fresh array every time, and depending on
    // identity would restart the grow animation on every tap.
  }, [signature, motion.emphasis, progress]);

  if (!values.length) {
    return (
      <View onLayout={onLayout} style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text variant="bodySmall" secondary>
          {emptyLabel}
        </Text>
      </View>
    );
  }

  // See LineAreaChart: draw only once the real width is known, so the grow
  // animation runs exactly once.
  if (!measured) return <View onLayout={onLayout} style={{ height }} />;

  const averageY =
    averageValue != null && geometry.top > 0
      ? geometry.baseline - (Math.min(averageValue, geometry.top) / geometry.top) * (geometry.baseline - PADDING.top)
      : null;

  const labelStep = labels?.length ? Math.max(1, Math.ceil(labels.length / MAX_X_LABELS)) : 1;
  const slot = geometry.plotWidth / values.length;

  return (
    <View onLayout={onLayout}>
      <Svg width={width} height={height}>
        <Line
          x1={PADDING.left}
          y1={geometry.baseline}
          x2={width - PADDING.right}
          y2={geometry.baseline}
          stroke={colors.divider}
          strokeWidth={1}
        />

        <SvgText x={PADDING.left - 6} y={PADDING.top + 4} fill={colors.textDisabled} fontSize={9} textAnchor="end">
          {formatValue(geometry.top)}
        </SvgText>

        {geometry.bars.map((bar, index) => (
          <AnimatedBar
            key={index}
            bar={bar}
            baseline={geometry.baseline}
            progress={progress}
            startAt={(index / Math.max(1, geometry.bars.length)) * STAGGER_SPAN}
            radius={Math.min(radius.sm, bar.width / 2)}
            color={accents.has(index) && accentColor ? accentColor : color}
            // Estimated days read as background texture; the selected bar reads
            // as foreground. Everything else sits in between.
            opacity={index < seededCount ? 0.38 : selectedIndex == null || selectedIndex === index ? 1 : 0.45}
          />
        ))}

        {averageY != null ? (
          <G>
            <Line
              x1={PADDING.left}
              y1={averageY}
              x2={width - PADDING.right}
              y2={averageY}
              stroke={colors.textSecondary}
              strokeWidth={1}
              strokeDasharray={[4, 4]}
            />
            {averageLabel ? (
              <SvgText
                x={width - PADDING.right}
                y={averageY - 4}
                fill={colors.textSecondary}
                fontSize={9}
                textAnchor="end"
              >
                {averageLabel}
              </SvgText>
            ) : null}
          </G>
        ) : null}

        {labels?.map((label, index) => {
          if (!label) return null;
          const isLast = index === labels.length - 1;
          if (index % labelStep !== 0 && !isLast) return null;
          const bar = geometry.bars[index];
          if (!bar) return null;
          return (
            <SvgText
              key={index}
              x={bar.x + bar.width / 2}
              y={height - 5}
              fill={selectedIndex === index ? colors.textPrimary : colors.textDisabled}
              fontSize={9}
              textAnchor="middle"
            >
              {label}
            </SvgText>
          );
        })}
      </Svg>

      {/* Touch targets live above the SVG rather than on the bars themselves: a
          2 px-tall bar for a zero day is impossible to hit, but its whole column
          is comfortable. */}
      {onSelect ? (
        <View
          style={{
            position: 'absolute',
            left: PADDING.left,
            top: PADDING.top,
            width: geometry.plotWidth,
            height: geometry.baseline - PADDING.top,
            flexDirection: 'row',
          }}
        >
          {values.map((_, index) => (
            <Pressable
              key={index}
              onPress={() => onSelect(index)}
              hitSlop={{ top: 6, bottom: 14 }}
              style={{ width: slot }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function AnimatedBar({
  bar,
  baseline,
  progress,
  startAt,
  color,
  radius,
  opacity,
}: {
  bar: BarRect;
  baseline: number;
  progress: SharedValue<number>;
  startAt: number;
  color: string;
  radius: number;
  opacity: number;
}) {
  // Each bar derives its own slice of the shared timeline instead of owning a
  // shared value, so a 90-day chart still runs exactly one animation.
  const animatedProps = useAnimatedProps(() => {
    const span = 1 - startAt;
    const local = span <= 0 ? 1 : Math.max(0, Math.min(1, (progress.value - startAt) / span));
    const grown = bar.height * local;
    return { y: baseline - grown, height: Math.max(0, grown) };
  });

  return (
    <AnimatedRect
      x={bar.x}
      width={bar.width}
      rx={radius}
      fill={color}
      opacity={opacity}
      animatedProps={animatedProps}
    />
  );
}

export interface RankedBarRow {
  key: string;
  label: string;
  /** Drives the bar length, relative to `maxValue`. */
  value: number;
  /** What the user reads — "72%", "340 PTS". Defaults to the value. */
  display?: string;
  color?: string;
  /** Change against the previous period; null hides the arrow. */
  delta?: number | null;
  /** Dims the row and its label for sources never touched. */
  muted?: boolean;
}

export interface RankedBarsProps {
  rows: RankedBarRow[];
  color: string;
  maxValue?: number;
  /** Track height in px. */
  barHeight?: number;
  onSelect?: (key: string) => void;
  emptyLabel?: string;
}

/**
 * Horizontal category bars — one row per source, label above the track, value on
 * the right. Bars fill from the left with the same stagger as the vertical
 * chart, so the two read as one family.
 */
export function RankedBars({
  rows,
  color,
  maxValue,
  barHeight = 8,
  onSelect,
  emptyLabel,
}: RankedBarsProps) {
  const { colors, motion, spacing, radius } = useTheme();
  const progress = useSharedValue(0);

  const top = maxValue ?? niceMax(extent(rows.map((row) => row.value))?.max ?? 0);
  const signature = useMemo(() => rows.map((row) => `${row.key}:${row.value}`).join('|'), [rows]);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: motion.emphasis, easing: Easing.out(Easing.cubic) });
    // Value-keyed, so tapping a row to select it does not re-run the fill.
  }, [signature, motion.emphasis, progress]);

  if (!rows.length) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text variant="bodySmall" secondary>
          {emptyLabel}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.sm }}>
      {rows.map((row, index) => {
        const content = (
          <View style={{ gap: 4, opacity: row.muted ? 0.5 : 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Text variant="bodySmall" weight="medium" numberOfLines={1} style={{ flex: 1 }}>
                {row.label}
              </Text>
              {row.delta != null && row.delta !== 0 ? (
                <Text
                  variant="caption"
                  weight="semiBold"
                  color={row.delta > 0 ? colors.success : colors.error}
                >
                  {row.delta > 0 ? '▲' : '▼'} {Math.abs(row.delta).toFixed(0)}
                </Text>
              ) : null}
              <Text variant="bodySmall" weight="semiBold">
                {row.display ?? compactNumber(row.value)}
              </Text>
            </View>
            <View
              style={{
                height: barHeight,
                borderRadius: radius.pill,
                backgroundColor: colors.surfaceAlt,
                overflow: 'hidden',
              }}
            >
              <RankedBarFill
                ratio={top > 0 ? Math.max(0, Math.min(1, row.value / top)) : 0}
                progress={progress}
                startAt={(index / Math.max(1, rows.length)) * STAGGER_SPAN}
                color={row.color ?? color}
                radius={radius.pill}
              />
            </View>
          </View>
        );

        return onSelect ? (
          <Pressable
            key={row.key}
            onPress={() => onSelect(row.key)}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            {content}
          </Pressable>
        ) : (
          <View key={row.key}>{content}</View>
        );
      })}
    </View>
  );
}

function RankedBarFill({
  ratio,
  progress,
  startAt,
  color,
  radius,
}: {
  ratio: number;
  progress: SharedValue<number>;
  startAt: number;
  color: string;
  radius: number;
}) {
  const style = useAnimatedStyle(() => {
    const span = 1 - startAt;
    const local = span <= 0 ? 1 : Math.max(0, Math.min(1, (progress.value - startAt) / span));
    return { width: `${ratio * local * 100}%` };
  });

  return (
    <Animated.View style={[{ height: '100%', borderRadius: radius, backgroundColor: color }, style]} />
  );
}
