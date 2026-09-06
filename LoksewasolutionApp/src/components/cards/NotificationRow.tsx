import React from 'react';
import { View, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';

export interface NotificationRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  preview: string;
  timestamp: string;
  unread: boolean;
  onPress: () => void;
}

export function NotificationRow({ icon, title, preview, timestamp, unread, onPress }: NotificationRowProps) {
  const { colors, spacing, radius } = useTheme();
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', gap: spacing.sm, padding: spacing.md, alignItems: 'flex-start' }}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radius.pill,
          backgroundColor: colors.surfaceAlt,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body" weight={unread ? 'semiBold' : 'regular'} numberOfLines={1}>{title}</Text>
        <Text variant="bodySmall" secondary numberOfLines={2}>{preview}</Text>
        <Text variant="caption" secondary>{timestamp}</Text>
      </View>
      {unread ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 4 }} /> : null}
    </Pressable>
  );
}
