// Tappable row for link lists — Contact Us, App Info, Help entries.
//
// Presses give a real, visible response (the whole row tints and settles back)
// rather than only the OS ripple, and the row height is fixed by its content
// rather than by the presence of a subtitle, so a list does not jitter between
// rows that have one and rows that do not.
import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';
import { useTones, type Tone } from '@/src/components/premium/tone';

export interface ActionRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  tone?: Tone;
  /** Replaces the chevron — a StatusPill, a value, or anything else. */
  trailing?: React.ReactNode;
  /** Omit to render a non-interactive row (no chevron, no press state). */
  onPress?: () => void;
  divider?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ActionRow({ icon, title, subtitle, tone = 'primary', trailing, onPress, divider, style }: ActionRowProps) {
  const { colors, spacing, radius } = useTheme();
  const tones = useTones();
  const t = tones[tone];

  const body = (pressed: boolean) => (
    <View
      style={[
        styles.row,
        {
          paddingVertical: spacing.sm + 2,
          paddingHorizontal: spacing.sm,
          borderRadius: radius.md,
          backgroundColor: pressed ? t.bg : 'transparent',
          borderBottomWidth: divider ? StyleSheet.hairlineWidth : 0,
          borderBottomColor: colors.divider,
        },
        style,
      ]}
    >
      <View style={[styles.tile, { backgroundColor: t.bg, borderColor: t.border, borderRadius: radius.md }]}>
        <Ionicons name={icon} size={18} color={t.fg} />
      </View>
      <View style={styles.text}>
        <Text variant="body" weight="semiBold" numberOfLines={1}>{title}</Text>
        {subtitle ? <Text variant="bodySmall" secondary numberOfLines={2} style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {trailing ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textDisabled} /> : null)}
    </View>
  );

  if (!onPress) return body(false);

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>
      {({ pressed }) => body(pressed)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tile: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  text: { flex: 1, gap: 2 },
  subtitle: { lineHeight: 17 },
});
