// Ring chart for compositional data — where study time went, how points were earned.
import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { Text } from '@/src/components/misc/Text';
import { useTheme } from '@/src/core/theme';
import { donutSlices } from './chartMath';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Degrees of breathing room between neighbouring arcs. */
const GAP_DEG = 2;

export interface DonutDatum {
  key: string;
  label: string;
  value: number;
  color: string;
  /** What the legend shows — "1h 20m", "340 PTS". Falls back to the share. */
  display?: string;
}

export interface DonutChartProps {
  data: DonutDatum[];
  size?: number;
  thickness?: number;
  centerValue: string;
  centerLabel: string;
  selectedKey?: string | null;
  onSelect?: (key: string) => void;
  showLegend?: boolean;
  emptyLabel?: string;
}

export function DonutChart({
  data,
  size = 140,
  thickness = 16,
  centerValue,
  centerLabel,
  selectedKey = null,
  onSelect,
  showLegend = true,
  emptyLabel,
}: DonutChartProps) {
  const { colors, motion, spacing, radius } = useTheme();
  const progress = useSharedValue(0);

  const geometry = useMemo(() => {
    // The selected arc thickens, so the radius is set from the THICKEST possible
    // stroke — otherwise selecting a slice would clip it against the viewbox.
    const maxThickness = thickness + 6;
    const ringRadius = (size - maxThickness) / 2;
    const circumference = 2 * Math.PI * ringRadius;
    const slices = donutSlices(data.map((item) => item.value), GAP_DEG);

    return {
      ringRadius,
      circumference,
      center: size / 2,
      arcs: slices.map((slice, index) => ({
        ...slice,
        key: data[index].key,
        color: data[index].color,
        // Rotate each arc to its own starting angle so its reveal is the same
        // single-scalar dash animation ProgressRing already uses.
        rotation: -90 + slice.startAngle,
        length: ((slice.endAngle - slice.startAngle) / 360) * circumference,
        startAt: (index / Math.max(1, slices.length)) * 0.4,
      })),
    };
  }, [data, size, thickness]);

  const total = useMemo(
    () => data.reduce((sum, item) => sum + (item.value > 0 ? item.value : 0), 0),
    [data],
  );
  const signature = useMemo(() => data.map((item) => `${item.key}:${item.value}`).join('|'), [data]);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: motion.emphasis, easing: Easing.out(Easing.cubic) });
    // Value-keyed: selecting a legend row re-renders with a new `data` array
    // identity, and that must not replay the sweep.
  }, [signature, motion.emphasis, progress]);

  if (total <= 0) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text variant="bodySmall" secondary>
          {emptyLabel}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          {/* Track, so the ring still reads as a ring while the arcs grow. */}
          <Circle
            cx={geometry.center}
            cy={geometry.center}
            r={geometry.ringRadius}
            stroke={colors.surfaceAlt}
            strokeWidth={thickness}
            fill="none"
          />
          {geometry.arcs.map((arc) => (
            <G key={arc.key} rotation={arc.rotation} origin={`${geometry.center}, ${geometry.center}`}>
              <AnimatedArc
                cx={geometry.center}
                cy={geometry.center}
                r={geometry.ringRadius}
                circumference={geometry.circumference}
                length={arc.length}
                color={arc.color}
                progress={progress}
                startAt={arc.startAt}
                thickness={selectedKey === arc.key ? thickness + 6 : thickness}
                opacity={selectedKey == null || selectedKey === arc.key ? 1 : 0.4}
              />
            </G>
          ))}
        </Svg>

        <View
          style={[StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center' }]}
          pointerEvents="none"
        >
          <Text variant="h3" weight="bold" numberOfLines={1}>
            {centerValue}
          </Text>
          <Text variant="caption" secondary numberOfLines={1}>
            {centerLabel}
          </Text>
        </View>
      </View>

      {showLegend ? (
        <View style={{ flex: 1, gap: 6 }}>
          {data.map((item, index) => {
            const share = total > 0 ? (item.value / total) * 100 : 0;
            const active = selectedKey === item.key;
            const row = (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.xs,
                  opacity: selectedKey == null || active ? 1 : 0.5,
                }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: radius.pill,
                    backgroundColor: item.color,
                  }}
                />
                <Text variant="caption" numberOfLines={1} style={{ flex: 1 }} weight={active ? 'semiBold' : 'regular'}>
                  {item.label}
                </Text>
                <Text variant="caption" secondary numberOfLines={1}>
                  {item.display ?? `${share.toFixed(0)}%`}
                </Text>
              </View>
            );

            return onSelect ? (
              <Pressable
                key={item.key}
                onPress={() => onSelect(item.key)}
                hitSlop={4}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                {row}
              </Pressable>
            ) : (
              <View key={`${item.key}-${index}`}>{row}</View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function AnimatedArc({
  cx,
  cy,
  r,
  circumference,
  length,
  color,
  progress,
  startAt,
  thickness,
  opacity,
}: {
  cx: number;
  cy: number;
  r: number;
  circumference: number;
  length: number;
  color: string;
  progress: SharedValue<number>;
  startAt: number;
  thickness: number;
  opacity: number;
}) {
  // With `strokeDasharray` fixed at one full circumference, the offset alone
  // controls how much of the arc is painted — only a single number animates,
  // which is the pattern react-native-svg handles most reliably.
  const animatedProps = useAnimatedProps(() => {
    const span = 1 - startAt;
    const local = span <= 0 ? 1 : Math.max(0, Math.min(1, (progress.value - startAt) / span));
    return { strokeDashoffset: circumference - length * local };
  });

  return (
    <AnimatedCircle
      cx={cx}
      cy={cy}
      r={r}
      stroke={color}
      strokeWidth={thickness}
      strokeLinecap="round"
      strokeDasharray={circumference}
      fill="none"
      opacity={opacity}
      animatedProps={animatedProps}
    />
  );
}
