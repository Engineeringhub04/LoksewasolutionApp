// "Accepted Payments" strip shown on the Subscription page — eSewa, Khalti,
// Fonepay as transparent text-only badges (no third-party logo assets are
// bundled, to avoid shipping trademarked artwork; each brand's own colour is
// used for recognizability instead).
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { Text } from '@/src/components/misc/Text';
import type { SubscriptionSettings } from '@/src/core/firebase/services/subscription';

const BRANDS = [
  { key: 'esewa', label: 'eSewa', color: '#60BB46' },
  { key: 'khalti', label: 'Khalti', color: '#5C2D91' },
  { key: 'fonepay', label: 'Fonepay', color: '#EE3237' },
] as const;

export function PaymentMethodBadges({ settings }: { settings: SubscriptionSettings | null }) {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="bodySmall" weight="semiBold" secondary>{t('subscription.acceptedPayments')}</Text>
      <View style={styles.row}>
        {BRANDS.map((brand) => (
          <View
            key={brand.key}
            style={[
              styles.badge,
              {
                borderColor: brand.color,
                borderRadius: radius.pill,
                backgroundColor: `${brand.color}12`,
              },
            ]}
          >
            <View style={[styles.dot, { backgroundColor: brand.color }]} />
            <Text variant="bodySmall" weight="bold" style={{ color: brand.color }}>{brand.label}</Text>
          </View>
        ))}
      </View>
      {settings?.activeMode === 'manual' ? (
        <Text variant="caption" secondary>
          Manual — payments are verified by an admin after you submit your reference.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
