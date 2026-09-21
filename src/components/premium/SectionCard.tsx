// The standard content block for every redesigned page.
//
// Deliberately NOT built on Card: Card is a plain padded surface with no header
// and radius.md, while these pages needed one consistent titled block — icon
// medallion, title, optional trailing action — at radius.lg with a hairline
// border. Having one component own that removes the per-screen "sectionHeading"
// View + Ionicons + Text trio that was copy-pasted across a dozen files.
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';
import { useTones, type Tone } from '@/src/components/premium/tone';

export interface SectionCardProps {
  title?: string;
  /** Small line under the title. Keep it short — it wraps to two lines at most. */
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Colours the medallion. The card body itself always stays on the page surface. */
  tone?: Tone;
  /** Rendered on the right of the header row, e.g. a StatusPill or a link. */
  trailing?: React.ReactNode;
  /** Removes the body padding so a list can run edge to edge inside the card. */
  flush?: boolean;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function SectionCard({ title, subtitle, icon, tone = 'primary', trailing, flush, children, style }: SectionCardProps) {
  const { colors, spacing, radius, elevation } = useTheme();
  const tones = useTones();
  const t = tones[tone];
  const hasHeader = Boolean(title || icon || trailing);

  return (
    <View
      style={[
        styles.card,
        elevation[1],
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.lg,
          padding: flush ? 0 : spacing.md,
        },
        style,
      ]}
    >
      {hasHeader ? (
        <View style={[styles.header, flush ? { paddingHorizontal: spacing.md, paddingTop: spacing.md } : null]}>
          {icon ? (
            <View style={[styles.medallion, { backgroundColor: t.bg, borderColor: t.border, borderRadius: radius.md }]}>
              <Ionicons name={icon} size={19} color={t.fg} />
            </View>
          ) : null}
          <View style={styles.headerText}>
            {title ? <Text variant="h3" weight="bold" numberOfLines={2}>{title}</Text> : null}
            {subtitle ? <Text variant="bodySmall" secondary numberOfLines={2} style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {trailing}
        </View>
      ) : null}
      {children ? (
        <View style={hasHeader ? { marginTop: flush ? spacing.sm : spacing.md } : null}>{children}</View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  medallion: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  headerText: { flex: 1, gap: 2 },
  subtitle: { lineHeight: 17 },
});
