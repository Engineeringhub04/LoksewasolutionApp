import React, { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchUserProfile, type UserProfile } from '@/src/core/firebase/services/profile';
import { fetchAllExamPurchases, type ExamPurchaseRecord } from '@/src/core/firebase/services/examPurchases';
import { SubpageScrollScreen } from '@/src/components/nav/SubpageScrollScreen';
import { Text } from '@/src/components/misc/Text';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';

const TRACKS = ['all', 'exam'] as const;
type Track = (typeof TRACKS)[number];

type RequestWithProfile = { record: ExamPurchaseRecord; profile: UserProfile | null };

export default function AdminPurchaseDetailsScreen() {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [track, setTrack] = useState<Track>('all');

  const { data, loading, refreshing, error, refetch, refresh } = useAsyncData(async () => {
    const records = await fetchAllExamPurchases();
    const profiles = await Promise.all(records.map((record) => fetchUserProfile(record.uid).catch(() => null)));
    return records.map((record, index) => ({ record, profile: profiles[index] ?? null }));
  }, []);

  const requests = useMemo(() => data ?? [], [data]);
  const visibleRequests = track === 'all' || track === 'exam' ? requests : [];

  return (
    <>
      <SubpageScrollScreen title={t('subscription.purchaseRequestControl')} refreshing={refreshing} onRefresh={refresh}>
        <View style={{ gap: spacing.md }}>
          <View style={[styles.intro, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}30`, borderRadius: radius.lg, padding: spacing.md }]}> 
            <Ionicons name="shield-checkmark-outline" size={24} color={colors.primary} />
            <Text variant="bodySmall" secondary style={{ flex: 1 }}>{t('subscription.purchaseRequestControlHint')}</Text>
          </View>

          <View style={[styles.track, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, borderRadius: radius.md, padding: 4 }]}> 
            {TRACKS.map((item) => {
              const active = track === item;
              return (
                <Pressable key={item} onPress={() => setTrack(item)} style={[styles.trackItem, active && { backgroundColor: colors.primary, borderRadius: radius.sm }]}> 
                  <Ionicons name={item === 'all' ? 'layers-outline' : 'document-text-outline'} size={15} color={active ? colors.onPrimary : colors.textSecondary} />
                  <Text variant="bodySmall" weight={active ? 'bold' : 'semiBold'} style={{ color: active ? colors.onPrimary : colors.textSecondary }}>
                    {item === 'all' ? t('subscription.allRequests') : t('subscription.examDetails')}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {loading ? null : error ? (
            <DataNotFound onRetry={refetch} />
          ) : visibleRequests.length === 0 ? (
            <View style={[styles.empty, { borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg }]}> 
              <Ionicons name="receipt-outline" size={32} color={colors.textSecondary} />
              <Text variant="bodyLarge" weight="bold">{t('subscription.noExamPurchases')}</Text>
            </View>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {visibleRequests.map((item) => (
                <AdminPurchaseCard key={item.record.id} item={item} onPress={() => router.push(`/admin/exam-purchases/${item.record.id}`)} />
              ))}
            </View>
          )}
        </View>
      </SubpageScrollScreen>
      <PageLoaderOverlay visible={loading || refreshing} label={t('subscription.loading')} />
    </>
  );
}

function AdminPurchaseCard({ item, onPress }: { item: RequestWithProfile; onPress: () => void }) {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const { record, profile } = item;
  const status = record.status === 'active'
    ? { label: t('subscription.tagApproved'), color: colors.success, icon: 'checkmark-circle' as const }
    : record.status === 'rejected'
      ? { label: t('subscription.tagRejected'), color: colors.error, icon: 'close-circle' as const }
      : { label: t('subscription.tagNew'), color: colors.warning, icon: 'time-outline' as const };

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, opacity: pressed ? 0.78 : 1 }]}> 
      <View style={styles.cardTop}>
        {profile?.photoURL ? <Image source={{ uri: profile.photoURL }} style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: `${colors.primary}15` }]}><Ionicons name="person" size={20} color={colors.primary} /></View>}
        <View style={{ flex: 1, gap: 3 }}>
          <Text variant="bodyLarge" weight="bold" numberOfLines={2}>{record.examTitle}</Text>
          <Text variant="bodySmall" secondary numberOfLines={1}>{profile?.name || record.userName || '—'}</Text>
          <Text variant="caption" secondary numberOfLines={1}>{profile?.email || record.userEmail || '—'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={19} color={colors.textSecondary} />
      </View>
      <View style={styles.metaRow}>
        <Text variant="caption" secondary>{record.courseName || '—'} · {record.subcourseName || '—'}</Text>
        <View style={[styles.status, { backgroundColor: `${status.color}18` }]}><Ionicons name={status.icon} size={12} color={status.color} /><Text variant="caption" weight="bold" style={{ color: status.color }}>{status.label}</Text></View>
      </View>
      <Text variant="caption" secondary>Rs. {record.amount} · {record.submittedAt ? formatDate(record.submittedAt) : '—'}</Text>
    </Pressable>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  intro: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1 },
  track: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, gap: 4 },
  trackItem: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8 },
  empty: { alignItems: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth },
  card: { borderWidth: StyleSheet.hairlineWidth, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
});
