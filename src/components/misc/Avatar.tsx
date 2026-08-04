import React from 'react';
import { View, Image } from 'react-native';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';

export interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: number;
}

function initialsFor(name?: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export function Avatar({ uri, name, size = 44 }: AvatarProps) {
  const { colors } = useTheme();
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.surfaceAlt,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text weight="semiBold" style={{ color: colors.primary, fontSize: size * 0.38 }}>
        {initialsFor(name)}
      </Text>
    </View>
  );
}
