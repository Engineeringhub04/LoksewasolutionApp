import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '@/src/core/theme';

export function Spinner({ fullScreen, size = 'large' }: { fullScreen?: boolean; size?: 'small' | 'large' }) {
  const { colors } = useTheme();
  if (fullScreen) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size={size} color={colors.primary} />
      </View>
    );
  }
  return <ActivityIndicator size={size} color={colors.primary} />;
}
