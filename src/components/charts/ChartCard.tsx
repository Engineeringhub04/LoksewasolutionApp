// The container every analytics chart sits in: heading, optional action on the
// right, a fixed-height plot area, and the loading / empty states.
//
// Centralising the shell is what keeps fifteen sections looking like one page
// instead of fifteen separately-styled boxes, and it means a chart component
// only ever has to worry about drawing.
import React, { useCallback, useState } from 'react';
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { FadeIn } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Text } from '@/src/components/misc/Text';
import { Skeleton } from '@/src/components/feedback/Skeleton';
import { useTheme } from '@/src/core/theme';

export interface ChartCardProps {
  title: string;
  subtitle?: string;
  /** Rendered at the top-right — a range switcher, legend or total. */
  right?: React.ReactNode;
  /** Rendered under the plot area — legends, notes, footnotes. */
  footer?: React.ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyLabel?: string;
  emptyIcon?: React.ComponentProps<typeof Ionicons>['name'];
  /**
   * Plot-area height. Always reserved, even while loading or empty, so the page
   * does not reflow underneath the user as each section resolves.
   */
  height?: number;
  /** Removes the card surface — for sections that supply their own background. */
  plain?: boolean;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function ChartCard({
  title,
  subtitle,
  right,
  footer,
  loading = false,
  empty = false,
  emptyLabel,
  emptyIcon = 'bar-chart-outline',
  height = 180,
  plain = false,
  children,
  style,
}: ChartCardProps) {
  const { colors, radius, spacing } = useTheme();

  return (
    <View
      style={[
        {
          borderRadius: radius.lg,
          padding: spacing.cardPadding,
          gap: spacing.md,
        },
        plain
          ? null
          : {
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
            },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="h3" weight="semiBold" numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="caption" secondary numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right ? <View>{right}</View> : null}
      </View>

      <View style={{ height, justifyContent: 'center' }}>
        {loading ? (
          <ChartSkeleton height={height} />
        ) : empty ? (
          <View style={{ alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}>
            <Ionicons name={emptyIcon} size={28} color={colors.textDisabled} />
            <Text variant="bodySmall" secondary style={{ textAlign: 'center' }}>
              {emptyLabel}
            </Text>
          </View>
        ) : (
          <Animated.View entering={FadeIn.duration(240)} style={{ flex: 1 }}>
            {children}
          </Animated.View>
        )}
      </View>

      {footer && !loading && !empty ? footer : null}
    </View>
  );
}

/**
 * A skeleton shaped roughly like a chart rather than a plain grey block, so the
 * loading state already reads as "a graph is coming" — bars of varied height
 * against the same baseline the real chart will use.
 */
function ChartSkeleton({ height }: { height: number }) {
  const { spacing, radius } = useTheme();
  const ratios = [0.45, 0.7, 0.35, 0.85, 0.55, 0.95, 0.6];
  const barArea = Math.max(24, height - 24);

  return (
    <View style={{ flex: 1, justifyContent: 'flex-end', gap: spacing.sm }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          height: barArea,
          gap: spacing.xs,
        }}
      >
        {ratios.map((ratio, index) => (
          <Skeleton key={index} width="12%" height={barArea * ratio} radius={radius.sm} />
        ))}
      </View>
      <Skeleton width="40%" height={10} />
    </View>
  );
}

/**
 * Width of the chart's own slot, measured once it lays out.
 *
 * SVG needs a concrete pixel width and percentages are unreliable on Android, so
 * every chart measures itself. Sub-pixel layout changes are ignored: without
 * that guard a fractional width difference re-renders the chart forever.
 */
export function useMeasuredWidth(fallback = 280) {
  const [width, setWidth] = useState(0);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    setWidth((prev) => (Math.abs(prev - next) < 1 ? prev : next));
  }, []);

  return { width: width > 0 ? width : fallback, measured: width > 0, onLayout };
}
