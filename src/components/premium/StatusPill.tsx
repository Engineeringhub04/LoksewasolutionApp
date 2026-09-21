// Small status/label pill used everywhere in the redesigned pages.
//
// Replaces a pile of one-off inline badges that each picked their own hardcoded
// colours. Colour comes from the tone system, so the same pill is legible in
// light and dark without any per-screen correction.
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';
import { useTones, type Tone } from '@/src/components/premium/tone';

export interface StatusPillProps {
  label: string;
  tone?: Tone;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Solid fills the pill with the tone colour — use sparingly, for one hero state. */
  variant?: 'soft' | 'solid' | 'outline';
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}

export function StatusPill({ label, tone = 'neutral', icon, variant = 'soft', size = 'md', style }: StatusPillProps) {
  const { radius } = useTheme();
  const tones = useTones();
  const t = tones[tone];

  const background = variant === 'solid' ? t.solid : variant === 'outline' ? 'transparent' : t.bg;
  const foreground = variant === 'solid' ? t.onSolid : t.fg;
  const small = size === 'sm';

  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: background,
          borderColor: variant === 'solid' ? 'transparent' : t.border,
          borderRadius: radius.pill,
          paddingHorizontal: small ? 8 : 11,
          paddingVertical: small ? 3 : 5,
        },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={small ? 11 : 13} color={foreground} /> : null}
      <Text variant={small ? 'overline' : 'caption'} weight="bold" numberOfLines={1} style={{ color: foreground, flexShrink: 1 }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // maxWidth + a shrinkable label: a pill carrying a long value (a timestamp, a
  // custom report category) ellipsises instead of pushing past its row. RN's
  // flexShrink defaults to 0, so without this it would simply overflow.
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
});
