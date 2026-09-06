import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';

export interface BadgeProps {
  count?: number;
  label?: string;
  color?: string;
}

export function Badge({ count, label, color }: BadgeProps) {
  const { colors, radius } = useTheme();
  if (count === undefined && !label) return null;
  if (count !== undefined && count <= 0) return null;
  return (
    <View
      style={{
        minWidth: 18,
        height: 18,
        paddingHorizontal: 5,
        borderRadius: radius.pill,
        backgroundColor: color ?? colors.error,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: colors.onPrimary, fontSize: 10, fontWeight: '700' }}>
        {label ?? (count! > 99 ? '99+' : String(count))}
      </Text>
    </View>
  );
}
