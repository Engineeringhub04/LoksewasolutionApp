// Shared "button" style tile for 3x3 grids (Additional Feature, App Guide).
// Rendered as an actual solid-tinted button (not a bordered card) so it reads
// clearly as a tappable action — icon on a soft chip + label, filled
// background using the section's accent color at low opacity.
import React from 'react';
import { Pressable, View, StyleSheet, Dimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 10;
const HORIZONTAL_PADDING = 16;
// 3 columns, accounting for padding + 2 inner gaps
const TILE_WIDTH = (SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - GRID_GAP * 2) / 3;

export interface GridButtonProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  accentColor: string;
  onPress: () => void;
}

export function GridButton({ label, icon, accentColor, onPress }: GridButtonProps) {
  const { radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { width: TILE_WIDTH, backgroundColor: `${accentColor}17`, borderRadius: radius.md, opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] },
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

export { TILE_WIDTH, GRID_GAP };

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
