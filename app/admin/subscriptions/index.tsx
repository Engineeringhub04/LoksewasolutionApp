// Admin desk — every subscription request, newest first. A request is NEVER
// removed from this list after review; it just changes tag (New → Approved
// / Rejected), so the admin always has a full audit trail here.
import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchAllSubscriptions, type SubscriptionRecord, type SubscriptionStatus } from '@/src/core/firebase/services/subscription';
import { SubpageScrollScreen } from '@/src/components/nav/SubpageScrollScreen';
import { Text } from '@/src/components/misc/Text';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';

type FilterTab = 'all' | SubscriptionStatus;

export default function AdminSubscriptionsScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [filter, setFilter] = useState<FilterTab>('all');

  const { data, loading, refreshing, error, refetch, refresh } = useAsyncData(async () => {
    return fetchAllSubscriptions();
  }, []);

  const all = useMemo(() => data ?? [], [data]);
  const filtered = useMemo(() => (filter === 'all' ? all : all.filter((r) => r.status === filter)), [all, filter]);
  const pendingCount = all.filter((r) => r.status === 'pending').length;

  return (
    <>
      <SubpageScrollScreen title={t('subscription.adminReviewTitle')} refreshing={refreshing} onRefresh={refresh}>
        {loading ? null : error ? (
          <DataNotFound onRetry={refetch} />
        ) : (
          <>
            <Pressable
              onPress={() => router.push('/admin/purchase-details')}
              style={[styles.examPurchaseLink, { borderColor: colors.primary, backgroundColor: `${colors.primary}12`, borderRadius: 14, padding: spacing.md }]}
            >
              <Ionicons name="receipt-outline" size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text variant="bodySmall" weight="bold" style={{ color: colors.primary }}>{t('subscription.purchaseRequestControl')}</Text>
                <Text variant="caption" secondary>{t('subscription.purchaseRequestControlHint')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.primary} />
            </Pressable>

            <View style={styles.tabsRow}>
              <FilterChip label={t('subscription.tagNew')} count={pendingCount} active={filter === 'pending'} onPress={() => setFilter(filter === 'pending' ? 'all' : 'pending')} color={colors.warning} />
              <FilterChip label={t('subscription.tagApproved')} active={filter === 'active'} onPress={() => setFilter(filter === 'active' ? 'all' : 'active')} color={colors.success} />
              <FilterChip label={t('subscription.tagRejected')} active={filter === 'rejected'} onPress={() => setFilter(filter === 'rejected' ? 'all' : 'rejected')} color={colors.error} />
            </View>

            {filtered.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm }}>
                <Ionicons name="checkmark-done-circle-outline" size={56} color={colors.textDisabled} />
                <Text variant="body" secondary>{t('subscription.adminNoPending')}</Text>
              </View>
            ) : (
              filtered.map((req) => <RequestCard key={req.id} record={req} onPress={() => router.push(`/admin/subscriptions/${req.id}`)} />)
            )}
          </>
        )}
      </SubpageScrollScreen>
      <PageLoaderOverlay visible={loading || refreshing} label={t('subscription.loading')} />
    </>
  );
}

function FilterChip({ label, count, active, onPress, color }: { label: string; count?: number; active: boolean; onPress: () => void; color: string }) {
  const { radius } = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.chip, { borderRadius: radius.pill, borderColor: color, backgroundColor: active ? color : `${color}12` }]}>
      <Text variant="caption" weight="bold" style={{ color: active ? '#FFF' : color }}>
        {label}{typeof count === 'number' ? ` (${count})` : ''}
      </Text>
    </Pressable>
  );
}

function RequestCard({ record, onPress }: { record: SubscriptionRecord; onPress: () => void }) {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();

  const tag =
    record.status === 'active'
      ? { label: t('subscription.tagApproved'), color: colors.success, icon: 'checkmark-circle' as const }
      : record.status === 'rejected'
        ? { label: t('subscription.tagRejected'), color: colors.error, icon: 'close-circle' as const }
        : record.status === 'expired'
          ? { label: t('subscription.tagExpired'), color: colors.textSecondary, icon: 'time' as const }
          : { label: t('subscription.tagNew'), color: colors.warning, icon: 'sparkles' as const };

  return (
    <Pressable onPress={onPress} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }]}>
      <View style={styles.row}>
        <View style={[styles.iconBox, { backgroundColor: `${tag.color}17`, borderRadius: radius.md }]}>
          <Ionicons name={tag.icon} size={20} color={tag.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyLarge" weight="bold">{record.userName ?? record.userEmail ?? record.uid}</Text>
          <Text variant="bodySmall" secondary>{record.planName} · Rs. {record.amount} · {record.method.toUpperCase()}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <View style={[styles.tag, { backgroundColor: `${tag.color}17` }]}>
            <Text variant="caption" weight="bold" style={{ color: tag.color }}>{tag.label}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  card: { borderWidth: StyleSheet.hairlineWidth },
  iconBox: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  tabsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  examPurchaseLink: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5 },
  chip: { borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 6 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
});
