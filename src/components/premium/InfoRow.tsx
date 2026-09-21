// Label ↔ value line for spec/detail pages (Subscription, Purchase, App Info,
// report meta). Handles the two things that kept going wrong by hand: a long
// value squeezing the label to nothing, and a "field name" leaking through
// untranslated.
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';
import { useTones, type Tone } from '@/src/components/premium/tone';

export interface InfoRowProps {
  label: string;
  /** Pass a node for a pill or a link; a string is rendered as emphasised text. */
  value?: React.ReactNode;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: Tone;
  /** Stacks label above value — use when the value is a sentence, not a datum. */
  stacked?: boolean;
  /** Hairline separator under the row. Omit on the last row of a group. */
  divider?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function InfoRow({ label, value, icon, tone = 'neutral', stacked, divider, style }: InfoRowProps) {
  const { colors, spacing } = useTheme();
  const tones = useTones();
  const t = tones[tone];

  const renderedValue =
    typeof value === 'string' || typeof value === 'number' ? (
      <Text
        variant="body"
        weight="semiBold"
        // Right-aligned only in the side-by-side layout; a stacked sentence
        // reads as a paragraph and must stay left-aligned.
        style={[stacked ? undefined : styles.valueInline, tone === 'neutral' ? undefined : { color: t.fg }]}
      >
        {String(value)}
      </Text>
    ) : (
      value ?? null
    );

  return (
    <View
      style={[
        stacked ? styles.stacked : styles.inline,
        {
          paddingVertical: spacing.sm,
          borderBottomWidth: divider ? StyleSheet.hairlineWidth : 0,
          borderBottomColor: colors.divider,
        },
        style,
      ]}
    >
      <View style={styles.labelWrap}>
        {icon ? <Ionicons name={icon} size={15} color={t.fg} /> : null}
        <Text variant="bodySmall" secondary numberOfLines={2} style={stacked ? undefined : styles.labelInline}>
          {label}
        </Text>
      </View>
      {stacked ? <View style={styles.stackedValue}>{renderedValue}</View> : <View style={styles.valueWrap}>{renderedValue}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  inline: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stacked: { gap: 4 },
  labelWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // Caps the label so a long value can never crush it, and vice versa.
  labelInline: { flexShrink: 1 },
  valueWrap: { flex: 1, alignItems: 'flex-end' },
  stackedValue: { alignItems: 'flex-start' },
  valueInline: { textAlign: 'right' },
});
