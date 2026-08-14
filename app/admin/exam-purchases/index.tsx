import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchAllExamPurchases, type ExamPurchaseRecord, type ExamPurchaseStatus } from '@/src/core/firebase/services/examPurchases';
import { SubpageScrollScreen } from '@/src/components/nav/SubpageScrollScreen';
import { Text } from '@/src/components/misc/Text';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';

type Filter = 'all' | ExamPurchaseStatus;

export default function AdminExamPurchasesScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const { data, loading, refreshing, error, refetch, refresh } = useAsyncData(fetchAllExamPurchases, []);
  const records = useMemo(() => data ?? [], [data]);
  const filtered = useMemo(() => filter === 'all' ? records : records.filter((record) => record.status === filter), [filter, records]);

  return (
    <>
      <SubpageScrollScreen title={t('subscription.examPurchaseReview')} refreshing={refreshing} onRefresh={refresh}>
        {loading ? null : error ? <DataNotFound onRetry={refetch} /> : (
          <>
            <View style={styles.tabsRow}>
              <Chip label={t('subscription.allRequests')} active={filter === 'all'} color={colors.primary} onPress={() => setFilter('all')} />
              <Chip label={t('subscription.tagNew')} active={filter === 'pending'} color={colors.warning} onPress={() => setFilter('pending')} count={records.filter((record) => record.status === 'pending').length} />
              <Chip label={t('subscription.tagApproved')} active={filter === 'active'} color={colors.success} onPress={() => setFilter('active')} />
              <Chip label={t('subscription.tagRejected')} active={filter === 'rejected'} color={colors.error} onPress={() => setFilter('rejected')} />
            </View>
            {filtered.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm }}>
                <Ionicons name="receipt-outline" size={56} color={colors.textDisabled} />
                <Text variant="body" secondary>{t('subscription.noExamPurchases')}</Text>
              </View>
            ) : filtered.map((record) => <PurchaseCard key={record.id} record={record} onPress={() => router.push(`/admin/exam-purchases/${record.id}`)} />)}
          </>
        )}
      </SubpageScrollScreen>
      <PageLoaderOverlay visible={loading || refreshing} label={t('subscription.loading')} />
    </>
  );
}

function Chip({ label, active, color, onPress, count }: { label: string; active: boolean; color: string; onPress: () => void; count?: number }) {
  return <Pressable onPress={onPress} style={[styles.chip, { borderColor: color, backgroundColor: active ? color : `${color}12` }]}><Text variant="caption" weight="bold" style={{ color: active ? '#FFF' : color }}>{label}{typeof count === 'number' ? ` (${count})` : ''}</Text></Pressable>;
}

function PurchaseCard({ record, onPress }: { record: ExamPurchaseRecord; onPress: () => void }) {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const status = record.status === 'active'
    ? { label: t('subscription.tagApproved'), color: colors.success, icon: 'checkmark-circle' as const }
    : record.status === 'rejected'
      ? { label: t('subscription.tagRejected'), color: colors.error, icon: 'close-circle' as const }
      : { label: t('subscription.tagNew'), color: colors.warning, icon: 'time' as const };

  return <Pressable onPress={onPress} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }]}>
    <View style={styles.row}>
      <View style={[styles.iconBox, { backgroundColor: `${status.color}17`, borderRadius: radius.md }]}><Ionicons name={status.icon} size={20} color={status.color} /></View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyLarge" weight="bold">{record.examTitle}</Text>
        <Text variant="caption" secondary>{record.userName ?? record.userEmail ?? record.uid}</Text>
        <Text variant="caption" secondary>{record.courseName ?? '—'} · {record.subcourseName ?? '—'} · Rs. {record.amount}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}><View style={[styles.tag, { backgroundColor: `${status.color}17` }]}><Text variant="caption" weight="bold" style={{ color: status.color }}>{status.label}</Text></View><Ionicons name="chevron-forward" size={16} color={colors.textSecondary} /></View>
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  card: { borderWidth: StyleSheet.hairlineWidth, marginBottom: 10 },
  iconBox: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  tabsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  tag: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
});
