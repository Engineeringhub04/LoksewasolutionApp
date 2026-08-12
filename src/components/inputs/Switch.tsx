import React from 'react';
import { Switch as RNSwitch } from 'react-native';
import { useTheme } from '@/src/core/theme';

export interface SwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

export function Switch({ value, onValueChange, disabled }: SwitchProps) {
  const { colors } = useTheme();
  return (
    <RNSwitch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: colors.border, true: colors.primary }}
      thumbColor={colors.onPrimary}
    />
  );
}
