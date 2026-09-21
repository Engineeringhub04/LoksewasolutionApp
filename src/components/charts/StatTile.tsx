// KPI tile: one number, its movement, and the shape behind it.
//
// The delta is the part that earns the tile its space — "4h 20m" alone says
// nothing about whether the user is doing better than last week.
import React from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Text } from '@/src/components/misc/Text';
import { useTheme } from '@/src/core/theme';
import { useMeasuredWidth } from './ChartCard';
import { Sparkline } from './Sparkline';

export interface StatTileProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  accent: string;
  /** Percentage change against the previous equivalent period. */
  delta?: number | null;
  /** Qualifies the delta — "this week", "vs last 30 days". */
  deltaLabel?: string;
  /** For metrics where a fall is the good outcome. */
  higherIsBetter?: boolean;
  trend?: number[];
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function StatTile({
  icon,
  label,
  value,
  accent,
  delta = null,
  deltaLabel,
  higherIsBetter = true,
  trend,
  onPress,
  style,
}: StatTileProps) {
  const { colors, radius, spacing } = useTheme();
  const { width, onLayout } = useMeasuredWidth(120);

  const hasDelta = delta != null && Number.isFinite(delta) && Math.round(Math.abs(delta)) !== 0;
  const improving = hasDelta ? (delta as number) > 0 === higherIsBetter : false;
  const deltaColor = hasDelta ? (improving ? colors.success : colors.error) : colors.textSecondary;

  const base: StyleProp<ViewStyle> = [
    {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      gap: 6,
    },
    style,
  ];

  const body = (
    <>
      {/* The icon is tinted inline rather than sitting in its own tinted square —
          a box this small reads as clutter next to the number it introduces. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name={icon} size={14} color={accent} />
        <Text variant="caption" secondary numberOfLines={1} style={{ flex: 1 }}>
          {label}
        </Text>
      </View>

      <Text variant="h2" weight="bold" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.xs }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          {hasDelta ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons
                name={(delta as number) > 0 ? 'arrow-up' : 'arrow-down'}
                size={11}
                color={deltaColor}
              />
              <Text variant="caption" weight="semiBold" color={deltaColor}>
                {Math.abs(delta as number).toFixed(0)}%
              </Text>
            </View>
          ) : (
            <Text variant="caption" color={colors.textDisabled} numberOfLines={1}>
              —
            </Text>
          )}
          {deltaLabel ? (
            <Text variant="caption" color={colors.textDisabled} numberOfLines={1} style={{ fontSize: 9 }}>
              {deltaLabel}
            </Text>
          ) : null}
        </View>

        {trend && trend.length > 1 ? (
          <Sparkline
            values={trend}
            color={accent}
            // Roughly half the tile, so the number stays the dominant element.
            width={Math.max(40, Math.min(72, width * 0.42))}
            height={24}
            strokeWidth={1.8}
          />
        ) : null}
      </View>
    </>
  );

  // Pressable resolves a function style; View does not — passing one to a plain
  // View silently drops every style on the tile.
  if (!onPress) {
    return (
      <View onLayout={onLayout} style={base}>
        {body}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      onLayout={onLayout}
      style={({ pressed }) => [base, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}
    >
      {body}
    </Pressable>
  );
}
