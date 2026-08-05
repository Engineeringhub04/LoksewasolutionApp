// Shared "button" style tile for 3x3 grids (Additional Feature, App Guide).
// Rendered as an actual solid-tinted button (not a bordered card) so it reads
// clearly as a tappable action — icon on a soft chip + label, filled
// background using the section's accent color at low opacity.
import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';

export interface GridButtonProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  accentColor: string;
  onPress: () => void;
  /**
   * Exact tile width, measured and supplied by <Grid3>. This used to be computed
   * inside this component from Dimensions + hardcoded padding, which mismatched
   * the real container width on narrower Android phones and wrapped the 3rd tile
   * onto its own row.
   */
  width: number;
}

export function GridButton({ label, icon, accentColor, onPress, width }: GridButtonProps) {
  const { radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { width, backgroundColor: `${accentColor}17`, borderRadius: radius.md, opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] },
      ]}
    >
      <View style={[styles.iconBox, { backgroundColor: accentColor, borderRadius: radius.pill }]}>
        <Ionicons name={icon} size={20} color="#FFF" />
      </View>
      <Text variant="caption" weight="semiBold" style={{ color: accentColor, textAlign: 'center' }} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 6,
  },
  iconBox: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
});
