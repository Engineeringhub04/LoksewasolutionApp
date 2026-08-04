// Global Empty State (PRD §9.2): illustration + short explanation + optional CTA.
import React from 'react';
import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';

export interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
}

export function EmptyState({ icon = 'file-tray-outline', title, description, ctaLabel, onCtaPress }: EmptyStateProps) {
  const { colors, spacing } = useTheme();
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm }}>
      <Ionicons name={icon} size={56} color={colors.textDisabled} />
      <Text variant="h3" weight="semiBold" style={{ textAlign: 'center', marginTop: spacing.sm }}>
        {title}
      </Text>
      {description ? (
        <Text variant="body" secondary style={{ textAlign: 'center' }}>
          {description}
        </Text>
      ) : null}
      {ctaLabel && onCtaPress ? (
        <Button label={ctaLabel} onPress={onCtaPress} fullWidth={false} style={{ marginTop: spacing.md }} />
      ) : null}
    </View>
  );
}
