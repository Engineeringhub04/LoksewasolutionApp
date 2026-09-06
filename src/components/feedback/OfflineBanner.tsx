// Persistent, non-blocking offline banner (PRD §9.4). Mounted once near root layout.
import React from 'react';
import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useNetworkStatus } from '@/src/core/hooks/useNetworkStatus';
import { Text } from '@/src/components/misc/Text';

export function OfflineBanner() {
  const { isOffline } = useNetworkStatus();
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();

  if (!isOffline) return null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        backgroundColor: colors.warning,
        paddingVertical: spacing.xs + 2,
        paddingHorizontal: spacing.md,
      }}
    >
      <Ionicons name="cloud-offline-outline" size={14} color={colors.onPrimary} />
      <Text variant="caption" weight="semiBold" style={{ color: colors.onPrimary }}>
        {t('common.offlineBanner')}
      </Text>
    </View>
  );
}
