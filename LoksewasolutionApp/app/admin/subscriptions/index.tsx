// Admin desk — list of pending subscription requests (manual payments
// awaiting verification). Tapping a row opens the review screen where the
// admin approves or rejects it.
import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchPendingSubscriptions } from '@/src/core/firebase/services/subscription';
import { SubpageScrollScreen } from '@/src/components/nav/SubpageScrollScreen';
import { Text } from '@/src/components/misc/Text';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';

export default function AdminSubscriptionsScreen() {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const { data, loading, refreshing, error, refetch, refresh } = useAsyncData(async () => {
    return fetchPendingSubscriptions();
  }, []);

  const requests = data ?? [];

  return (
    <>
      <SubpageScrollScreen title={t('subscription.adminReviewTitle')} refreshing={refreshing} onRefresh={refresh}>
        {loading ? null : error ? (
          <DataNotFound onRetry={refetch} />
        ) : requests.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm }}>
            <Ionicons name="checkmark-done-circle-outline" size={56} color={colors.textDisabled} />
            <Text variant="body" secondary>{t('subscription.adminNoPending')}</Text>
          </View>
        ) : (
          requests.map((req) => (
            <Pressable
              key={req.id}
              onPress={() => router.push(`/admin/subscriptions/${req.id}`)}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }]}
            >
              <View style={styles.row}>
                <View style={[styles.iconBox, { backgroundColor: `${colors.warning}17`, borderRadius: radius.md }]}>
                  <Ionicons name="time-outline" size={20} color={colors.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyLarge" weight="bold">{req.userName ?? req.userEmail ?? req.uid}</Text>
                  <Text variant="bodySmall" secondary>{req.planName} · Rs. {req.amount} · {req.method}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </View>
            </Pressable>
          ))
        )}
      </SubpageScrollScreen>
      <PageLoaderOverlay visible={loading || refreshing} label={t('subscription.loading')} />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  card: { borderWidth: StyleSheet.hairlineWidth },
  iconBox: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
});
