// Six-axis skill radar. Shape at a glance: a lopsided hexagon is a lopsided
// study habit, which is the point of the section.
import React, { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';

import { Text } from '@/src/components/misc/Text';
import { useTheme } from '@/src/core/theme';
import { useMeasuredWidth } from './ChartCard';
import { polarPoint, radarPath } from './chartMath';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const RING_STEPS = [0.2, 0.4, 0.6, 0.8, 1];
/** Room outside the outer ring for the axis labels. */
const LABEL_INSET = 30;
const LABEL_WIDTH = 62;

export interface RadarAxis {
  key: string;
  label: string;
  /** 0..max. */
  value: number;
  /** Never-touched sources plot at zero but say so through a dimmed label. */
  untouched?: boolean;
}

export interface RadarChartProps {
  axes: RadarAxis[];
  color: string;
  maxValue?: number;
  /** Optional second outline, e.g. the subcourse average. */
  compareAxes?: RadarAxis[] | null;
  compareColor?: string;
  maxSize?: number;
  emptyLabel?: string;
}

export function RadarChart({
  axes,
  color,
  maxValue = 100,
  compareAxes = null,
  compareColor,
  maxSize = 230,
  emptyLabel,
}: RadarChartProps) {
  const { colors, motion } = useTheme();
  const { width, measured, onLayout } = useMeasuredWidth();
  const progress = useSharedValue(0);

  const size = Math.max(120, Math.min(width, maxSize));
  const center = size / 2;
  const radius = Math.max(20, center - LABEL_INSET);

  const ratios = useMemo(
    () =>
      axes.map((axis) => {
        const safe = Number.isFinite(axis.value) ? axis.value : 0;
        return Math.max(0, Math.min(1, safe / (maxValue > 0 ? maxValue : 1)));
      }),
    [axes, maxValue],
  );

  const labelPoints = useMemo(
    () => axes.map((_, index) => polarPoint(center, center, radius + 16, (360 / axes.length) * index)),
    [axes.length, center, radius],
  );

  const spokes = useMemo(
    () => axes.map((_, index) => polarPoint(center, center, radius, (360 / axes.length) * index)),
    [axes.length, center, radius],
  );

  const signature = useMemo(() => ratios.join(','), [ratios]);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: motion.emphasis, easing: Easing.out(Easing.cubic) });
    // Value-keyed: toggling the cohort overlay must not replay the grow-out.
  }, [signature, motion.emphasis, progress]);

  // The polygon grows out of the centre, so its geometry has to be rebuilt every
  // frame. Doing that inside the worklet keeps it on the UI thread — the path
  // helpers in chartMath are ordinary functions and cannot be called from here.
  const animatedProps = useAnimatedProps(() => {
    const count = ratios.length;
    const scale = progress.value;
    let d = '';
    for (let i = 0; i < count; i += 1) {
      const angle = ((360 / count) * i - 90) * (Math.PI / 180);
      const distance = radius * ratios[i] * scale;
      const x = center + distance * Math.cos(angle);
      const y = center + distance * Math.sin(angle);
      d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)} `;
    }
    return { d: `${d}Z` };
  });

  if (axes.length < 3) {
    return (
      <View onLayout={onLayout} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text variant="bodySmall" secondary>
          {emptyLabel}
        </Text>
      </View>
    );
  }

  // The polygon's geometry is derived from the measured width, so drawing before
  // the slot is measured would grow it out at one size and then resize it.
  if (!measured) return <View onLayout={onLayout} style={{ height: maxSize }} />;

  const comparePath = compareAxes?.length
    ? radarPath(
        compareAxes.map((axis) => axis.value),
        maxValue,
        center,
        center,
        radius,
      )
    : '';

  return (
    <View onLayout={onLayout} style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          {RING_STEPS.map((step) => (
            <Path
              key={step}
              d={radarPath(axes.map(() => step), 1, center, center, radius)}
              fill="none"
              stroke={colors.divider}
              strokeWidth={1}
            />
          ))}

          {spokes.map((point, index) => (
            <Line
              key={index}
              x1={center}
              y1={center}
              x2={point.x}
              y2={point.y}
              stroke={colors.divider}
              strokeWidth={1}
            />
          ))}

          {comparePath ? (
            <Path
              d={comparePath}
              fill="none"
              stroke={compareColor ?? colors.textSecondary}
              strokeWidth={1.5}
              strokeDasharray={[4, 4]}
            />
          ) : null}

          <AnimatedPath
            animatedProps={animatedProps}
            fill={color}
            fillOpacity={0.25}
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
          />

          <Circle cx={center} cy={center} r={2} fill={colors.textDisabled} />
        </Svg>

        {/* Labels are real Text, not SvgText: they render in Nepali as well as
            English and pick up the app's font handling for Devanagari. */}
        {axes.map((axis, index) => {
          const point = labelPoints[index];
          return (
            <View
              key={axis.key}
              pointerEvents="none"
              style={{
                position: 'absolute',
                width: LABEL_WIDTH,
                left: point.x - LABEL_WIDTH / 2,
                top: point.y - 8,
              }}
            >
              <Text
                variant="caption"
                weight={axis.untouched ? 'regular' : 'medium'}
                color={axis.untouched ? colors.textDisabled : colors.textSecondary}
                numberOfLines={1}
                style={{ textAlign: 'center' }}
              >
                {axis.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
