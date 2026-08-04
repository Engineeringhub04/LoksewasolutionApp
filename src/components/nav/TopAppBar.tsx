// Global Top App Bar (PRD §8.3): title, back, action icons slot.
import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';
import { IconButton } from '@/src/components/buttons/IconButton';

export interface TopAppBarProps {
  title?: string;
  showBack?: boolean;
  onBackPress?: () => void;
  actions?: React.ReactNode;
}

export function TopAppBar({ title, showBack = true, onBackPress, actions }: TopAppBarProps) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: insets.top + spacing.xs,
        paddingBottom: spacing.sm,
        paddingHorizontal: spacing.sm,
        backgroundColor: colors.background,
      }}
    >
      {showBack ? (
        <IconButton
          name="chevron-back"
          accessibilityLabel="Back"
          onPress={onBackPress ?? (() => router.back())}
        />
      ) : (
        <View style={{ width: 40 }} />
      )}
      <Text variant="h3" weight="semiBold" style={{ flex: 1, marginLeft: spacing.xs }} numberOfLines={1}>
        {title}
      </Text>
      <View style={{ flexDirection: 'row' }}>{actions}</View>
    </View>
  );
}
