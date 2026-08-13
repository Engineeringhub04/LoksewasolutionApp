// Subscription → View Details (for a rejected request). Only linked from the
// Rejected card on the main Subscription page, and only visible there for 1
// day after review (see isRejectionStillVisible in subscription.ts) — this
// screen itself has no such gate since a direct link staying resolvable is
// harmless, but nothing in the app links here after the window closes.
import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchSubscriptionById } from '@/src/core/firebase/services/subscription';
import { SubpageScrollScreen } from '@/src/components/nav/SubpageScrollScreen';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';

export default function SubscriptionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const { data: record, loading, error, refetch } = useAsyncData(async () => {
    if (!id) return null;
    return fetchSubscriptionById(id);
  }, [id]);

  return (
    <>
      <SubpageScrollScreen title={t('subscription.viewDetails')}>
        {loading ? null : error || !record ? (
          <DataNotFound onRetry={refetch} />
        ) : (
          <>
            <View style={[styles.statusBox, { backgroundColor: `${colors.error}14`, borderColor: colors.error, borderRadius: radius.lg, padding: spacing.md }]}>
              <View style={styles.row}>
                <Ionicons name="close-circle" size={22} color={colors.error} />
                <Text variant="bodyLarge" weight="bold" style={{ color: colors.error }}>{t('subscription.rejectedTitle')}</Text>
              </View>
              {record.rejectionReason ? (
                <Text variant="body" style={{ marginTop: spacing.sm, color: colors.error }}>{record.rejectionReason}</Text>
              ) : null}
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
              <Row label={t('subscription.pendingPlan')} value={record.planName} />
              <Divider />
              <Row label={t('subscription.pendingAmount')} value={`Rs. ${record.amount}`} />
              <Divider />
              <Row label={t('subscription.pendingMethod')} value={record.method} />
              <Divider />
              <Row label={t('subscription.pendingRef')} value={record.transactionRef ?? '—'} />
              {record.couponCode ? (
                <>
                  <Divider />
                  <Row label={t('subscription.couponCode')} value={record.couponCode} />
                </>
              ) : null}
            </View>

            {record.screenshotUrl ? (
              <View style={{ gap: spacing.xs }}>
                <Text variant="bodySmall" weight="semiBold" secondary>{t('subscription.uploadScreenshot')}</Text>
                <Image source={{ uri: record.screenshotUrl }} style={styles.screenshot} resizeMode="cover" />
              </View>
            ) : null}

            <Button label={t('subscription.contactSupport')} onPress={() => router.push('/contact-us')} />
            <Button label={t('subscription.renewNow')} variant="secondary" onPress={() => router.replace('/subscription')} />
          </>
        )}
      </SubpageScrollScreen>
      <PageLoaderOverlay visible={loading} label={t('subscription.loading')} />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md }}>
      <Text variant="bodySmall" secondary style={{ width: 110 }}>{label}</Text>
      <Text variant="bodyLarge" weight="semiBold" style={{ flex: 1 }}>{value}</Text>
    </View>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={[styles.divider, { backgroundColor: colors.divider }]} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusBox: { borderWidth: 1 },
  card: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  screenshot: { width: '100%', height: 200, borderRadius: 12 },
});
