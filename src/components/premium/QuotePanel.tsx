// Tinted panel for quoted content: the item a user reported, an admin's reply,
// a notice body.
//
// This is what replaces the hardcoded panels (#1E2A5A / #8A3F0A / #EEF2FF) on
// the report screens. Those fixed the panel to one brightness and then let the
// theme move the text, which is exactly how body copy ended up invisible in one
// mode. Here both the fill and the text come from the same tone, so the pair
// moves together.
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';
import { useTones, type Tone } from '@/src/components/premium/tone';

export interface QuotePanelProps {
  /** Small eyebrow above the body, e.g. "Reported content" or "Our reply". */
  caption?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: Tone;
  /** Right side of the caption row — a timestamp or a StatusPill. */
  trailing?: React.ReactNode;
  /** A vertical accent bar on the leading edge, for reply/quote nesting. */
  spine?: boolean;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function QuotePanel({ caption, icon, tone = 'primary', trailing, spine, children, style }: QuotePanelProps) {
  const { spacing, radius } = useTheme();
  const tones = useTones();
  const t = tones[tone];
  const hasCaption = Boolean(caption || icon || trailing);

  return (
    <View
      style={[
        styles.panel,
        {
          backgroundColor: t.bg,
          borderColor: t.border,
          borderRadius: radius.md,
          padding: spacing.md,
          borderLeftWidth: spine ? 3 : StyleSheet.hairlineWidth,
          borderLeftColor: spine ? t.solid : t.border,
        },
        style,
      ]}
    >
      {hasCaption ? (
        <View style={styles.captionRow}>
          {icon ? <Ionicons name={icon} size={14} color={t.fg} /> : null}
          {caption ? (
            <Text variant="overline" weight="bold" numberOfLines={1} style={[styles.caption, { color: t.fg }]}>
              {caption.toUpperCase()}
            </Text>
          ) : null}
          {trailing}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: StyleSheet.hairlineWidth, gap: 8 },
  captionRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  caption: { flex: 1, letterSpacing: 0.6 },
});
