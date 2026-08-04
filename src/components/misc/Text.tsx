// Themed text primitive — every screen should use this instead of raw RN <Text>
// so typography tokens (PRD §7.3) stay centralized.
import React from 'react';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { useTheme } from '@/src/core/theme';

export type TextVariant = keyof ReturnType<typeof useTheme>['typography'];
type Weight = 'regular' | 'medium' | 'semiBold' | 'bold';

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  weight?: Weight;
  color?: string;
  secondary?: boolean;
}

const weightMap: Record<Weight, '400' | '500' | '600' | '700'> = {
  regular: '400',
  medium: '500',
  semiBold: '600',
  bold: '700',
};

export function Text({ variant = 'body', weight, color, secondary, style, ...rest }: TextProps) {
  const { typography, colors } = useTheme();
  const scale = typography[variant];
  return (
    <RNText
      style={[
        {
          fontSize: scale.fontSize,
          lineHeight: scale.lineHeight,
          fontWeight: weight ? weightMap[weight] : scale.fontWeight,
          color: color ?? (secondary ? colors.textSecondary : colors.textPrimary),
        },
        style,
      ]}
      {...rest}
    />
  );
}
