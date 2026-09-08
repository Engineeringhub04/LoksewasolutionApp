// Shown instead of a generic ErrorState/EmptyState when a subpage's data
// simply failed to load or doesn't exist yet — used app-wide for consistency.
import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';

export interface DataNotFoundProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  /**
   * Overrides for the action button. Defaults to "Try Again" + refresh, which is
   * right when the data merely failed to load — but wrong when the content is
   * deliberately unavailable (a Daily Test that has not unlocked yet), where the
   * only sensible action is to go back. A button that says "Try Again" and then
   * navigates away would be a lie, so the caller can relabel it.
   */
  retryLabel?: string;
  retryIcon?: keyof typeof Ionicons.glyphMap;
}

export function DataNotFound({ title = 'Data Not Found', description = "We couldn't load this content. Please try again.", onRetry, retryLabel = 'Try Again', retryIcon = 'refresh' }: DataNotFoundProps) {
  const { colors, spacing } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm }}>
      <Ionicons name="cloud-offline-outline" size={64} color={colors.textDisabled} />
      <Text variant="h3" weight="semiBold" style={{ textAlign: 'center', marginTop: spacing.sm }}>{title}</Text>
      <Text variant="body" secondary style={{ textAlign: 'center' }}>{description}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} style={[styles.retryBtn, { backgroundColor: colors.primary }]}>
          <Ionicons name={retryIcon} size={15} color={colors.onPrimary} />
          <Text variant="bodySmall" weight="bold" style={{ color: colors.onPrimary }}>{retryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
    marginTop: 12,
  },
});
