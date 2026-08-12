import React from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

export function Chip({ label, selected, onPress }: ChipProps) {
  const { colors, radius, spacing } = useTheme();
  const Component = onPress ? Pressable : View;
  return (
    <Component
      onPress={onPress}
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs + 2,
        borderRadius: radius.pill,
        backgroundColor: selected ? colors.primary : colors.surfaceAlt,
        marginRight: spacing.sm,
      }}
    >
      <Text variant="bodySmall" weight="medium" style={{ color: selected ? colors.onPrimary : colors.textSecondary }}>
        {label}
      </Text>
    </Component>
  );
}
