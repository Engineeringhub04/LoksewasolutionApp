// Compact number + label tile for hero stat strips.
//
// Fixed minimum width so a strip of tiles stays aligned whether the value is "3"
// or "1,248", and the value never wraps — it shrinks the label instead.
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';
import { useTones, type Tone } from '@/src/components/premium/tone';

export interface StatTileProps {
  value: string | number;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: Tone;
  /** Lets a row of tiles divide the width evenly instead of sizing to content. */
  grow?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function StatTile({ value, label, icon, tone = 'primary', grow, style }: StatTileProps) {
  const { colors, spacing, radius } = useTheme();
  const tones = useTones();
  const t = tones[tone];

  return (
    <View
      style={[
        styles.tile,
        {
          backgroundColor: t.bg,
          borderColor: t.border,
          borderRadius: radius.md,
          paddingVertical: spacing.sm + 2,
          paddingHorizontal: spacing.sm + 2,
        },
        grow ? styles.grow : null,
        style,
      ]}
    >
      <View style={styles.valueRow}>
        {icon ? <Ionicons name={icon} size={14} color={t.fg} /> : null}
        <Text variant="h3" weight="bold" numberOfLines={1} style={{ color: t.fg }}>
          {String(value)}
        </Text>
      </View>
      <Text variant="overline" weight="semiBold" numberOfLines={2} style={{ color: colors.textSecondary }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { minWidth: 92, gap: 3, borderWidth: StyleSheet.hairlineWidth },
  grow: { flex: 1, minWidth: 0 },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
