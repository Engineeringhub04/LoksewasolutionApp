import React from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/src/core/theme';

export interface CardProps {
  onPress?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Card({ onPress, children, style }: CardProps) {
  const { colors, radius, spacing, elevation } = useTheme();
  const Component = onPress ? Pressable : View;
  return (
    <Component
      onPress={onPress}
      style={({ pressed }: { pressed?: boolean } = {}) => [
        {
          backgroundColor: colors.card,
          borderRadius: radius.md,
          padding: spacing.cardPadding,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        elevation[1],
        style,
      ]}
    >
      {children}
    </Component>
  );
}
