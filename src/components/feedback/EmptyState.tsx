// Global Empty State (PRD §9.2): illustration + short explanation + optional CTA.
//
// Deliberately matches DataNotFound's layout: vertically centred in the
// available space with a small centred pill action, instead of the old
// top-aligned block with a full-size button.
import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';

export interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
  /** Icon shown inside the CTA pill. */
  ctaIcon?: keyof typeof Ionicons.glyphMap;
}

export function EmptyState({
  icon = 'file-tray-outline',
  title,
  description,
  ctaLabel,
  onCtaPress,
  ctaIcon = 'refresh',
}: EmptyStateProps) {
  const { colors, spacing } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm }}>
      <Ionicons name={icon} size={64} color={colors.textDisabled} />
      <Text variant="h3" weight="semiBold" style={{ textAlign: 'center', marginTop: spacing.sm }}>
        {title}
      </Text>
      {description ? (
        <Text variant="body" secondary style={{ textAlign: 'center' }}>
          {description}
        </Text>
      ) : null}
      {ctaLabel && onCtaPress ? (
        <Pressable
          onPress={onCtaPress}
          style={({ pressed }) => [styles.ctaBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
        >
          <Ionicons name={ctaIcon} size={15} color={colors.onPrimary} />
          <Text variant="bodySmall" weight="bold" style={{ color: colors.onPrimary }}>{ctaLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ctaBtn: {
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
