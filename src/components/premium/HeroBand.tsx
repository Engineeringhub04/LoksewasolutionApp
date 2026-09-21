// The identity block that sits directly under SubpageHeader on every redesigned
// page: a big soft medallion, the page's real purpose in one line, and an
// optional row of pills or stats.
//
// The blue header gradient above it is left exactly as it was (deliberate — it
// is the app's page signature). This band picks the gradient up in a much
// lighter tint so the two read as one piece instead of the header stopping dead
// against a grey page.
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';
import { useTones, type Tone } from '@/src/components/premium/tone';

export interface HeroBandProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  tone?: Tone;
  /** Pills, stats, or anything else — laid out in a wrapping row under the text. */
  footer?: React.ReactNode;
  /** Right-hand slot beside the title, e.g. a big value or a single pill. */
  trailing?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function HeroBand({ icon, title, subtitle, tone = 'primary', footer, trailing, style }: HeroBandProps) {
  const { colors, spacing, radius, elevation } = useTheme();
  const tones = useTones();
  const t = tones[tone];

  return (
    <View
      style={[
        styles.wrap,
        elevation[1],
        { borderColor: t.border, borderRadius: radius.lg, backgroundColor: colors.surface },
        style,
      ]}
    >
      <LinearGradient
        // Vertical, top-heavy: the tint is strongest where it meets the header
        // and fades out before the text, which keeps body copy on a plain
        // surface and therefore always readable.
        colors={[t.bg, `${colors.surface}00`] as const}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={[styles.inner, { padding: spacing.md }]}>
        <View style={styles.topRow}>
          <View style={[styles.medallion, { backgroundColor: t.bg, borderColor: t.border, borderRadius: radius.lg }]}>
            <Ionicons name={icon} size={26} color={t.fg} />
          </View>
          <View style={styles.text}>
            <Text variant="h2" weight="bold" numberOfLines={2}>{title}</Text>
            {subtitle ? <Text variant="bodySmall" secondary numberOfLines={3} style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {trailing}
        </View>
        {footer ? <View style={[styles.footer, { marginTop: spacing.md }]}>{footer}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  inner: { gap: 0 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  medallion: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  text: { flex: 1, gap: 3 },
  subtitle: { lineHeight: 17 },
  footer: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
});
