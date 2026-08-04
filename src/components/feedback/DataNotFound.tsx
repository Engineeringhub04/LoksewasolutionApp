// Shown instead of a generic ErrorState/EmptyState when a subpage's data
// simply failed to load or doesn't exist yet — used app-wide for consistency.
import React from 'react';
import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';

export interface DataNotFoundProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function DataNotFound({ title = 'Data Not Found', description = "We couldn't load this content. Please try again.", onRetry }: DataNotFoundProps) {
  const { colors, spacing } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm }}>
      <Ionicons name="cloud-offline-outline" size={64} color={colors.textDisabled} />
      <Text variant="h3" weight="semiBold" style={{ textAlign: 'center', marginTop: spacing.sm }}>{title}</Text>
      <Text variant="body" secondary style={{ textAlign: 'center' }}>{description}</Text>
      {onRetry ? <Button label="Try Again" onPress={onRetry} fullWidth={false} style={{ marginTop: spacing.md }} /> : null}
    </View>
  );
}
