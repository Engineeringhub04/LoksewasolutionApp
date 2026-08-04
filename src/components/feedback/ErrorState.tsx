// Global Error State (PRD §9.3): clear localized message + Retry, never raw technical text.
import React from 'react';
import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';

export interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm }}>
      <Ionicons name="alert-circle-outline" size={56} color={colors.error} />
      <Text variant="h3" weight="semiBold" style={{ textAlign: 'center', marginTop: spacing.sm }}>
        {message ?? t('common.somethingWentWrong')}
      </Text>
      {onRetry ? <Button label={t('common.retry')} onPress={onRetry} fullWidth={false} style={{ marginTop: spacing.md }} /> : null}
    </View>
  );
}
