// Additional Features tile — flat rounded card with a soft-tinted icon box and
// label side-by-side, distinct from both the old grid style and Quick Links'
// solid-color circular icons.
import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';

export interface FeatureTileProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

export function FeatureTile({ label, icon, onPress }: FeatureTileProps) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md }]}
    >
      <View style={[styles.iconBox, { backgroundColor: colors.surfaceAlt, borderRadius: radius.sm }]}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <Text variant="bodySmall" weight="medium" style={{ flex: 1, color: colors.textPrimary }} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderWidth: 1,
    width: '48%',
    marginBottom: 10,
  },
  iconBox: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
