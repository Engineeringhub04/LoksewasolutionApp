import React, { useMemo, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { useProfileStore } from '@/src/core/store/profileStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchMyExamPurchases, type ExamPurchaseRecord } from '@/src/core/firebase/services/examPurchases';
import { fetchMyContentPurchases, type ContentPurchaseRecord } from '@/src/core/firebase/services/contentPurchases';
import { SubpageScrollScreen } from '@/src/components/nav/SubpageScrollScreen';
import { Text } from '@/src/components/misc/Text';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';

const TRACKS = ['all', 'exam', 'content'] as const;
type Track = (typeof TRACKS)[number];

export default function PurchaseDetailsScreen() {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isAdmin = useProfileStore((state) => state.profile?.isAdmin === true);
  const [track, setTrack] = useState<Track>('all');

  const { data, loading, refreshing, error, refetch, refresh } = useAsyncData(
    async () => {
      if (!user?.uid) return { exams: [] as ExamPurchaseRecord[], content: [] as ContentPurchaseRecord[] };
      const [exams, content] = await Promise.all([
        fetchMyExamPurchases(user.uid),
        fetchMyContentPurchases(user.uid),
      ]);
      return { exams, content };
    },
    [user?.uid]
  );

  const examRecords = useMemo(() => data?.exams ?? [], [data?.exams]);
  const contentRecords = useMemo(() => data?.content ?? [], [data?.content]);
  const visibleExamRecords = track === 'exam' || track === 'all' ? examRecords : [];
  const visibleContentRecords = track === 'content' || track === 'all' ? contentRecords : [];

  return (
    <>
      <SubpageScrollScreen title={t('subscription.purchaseDetails')} refreshing={refreshing} onRefresh={refresh}>
        <View style={{ gap: spacing.md }}>
          {isAdmin ? (
            <Pressable onPress={() => router.push('/admin/purchase-details')} style={[styles.controlButton, { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md }]}> 
              <Ionicons name="shield-checkmark-outline" size={19} color={colors.onPrimary} />
              <Text variant="bodySmall" weight="bold" style={{ color: colors.onPrimary, flex: 1 }}>{t('subscription.purchaseRequestControl')}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.onPrimary} />
            </Pressable>
          ) : null}
          <View style={[styles.intro, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}30`, borderRadius: radius.lg, padding: spacing.md }]}> 
            <Ionicons name="receipt-outline" size={24} color={colors.primary} />
            <Text variant="bodySmall" secondary style={{ flex: 1 }}>{t('subscription.purchaseDetailsSubtitle')}</Text>
          </View>

          <View style={[styles.track, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, borderRadius: radius.md, padding: 4 }]}> 
            {TRACKS.map((item) => {
              const active = track === item;
              return (
                <Pressable
                  key={item}
                  onPress={() => setTrack(item)}
                  style={[styles.trackItem, active && { backgroundColor: colors.primary, borderRadius: radius.sm }]}
                >
                  <Ionicons name={item === 'all' ? 'layers-outline' : 'document-text-outline'} size={15} color={active ? colors.onPrimary : colors.textSecondary} />
                  <Text variant="bodySmall" weight={active ? 'bold' : 'semiBold'} style={{ color: active ? colors.onPrimary : colors.textSecondary }}>
                    {item === 'all' ? t('subscription.allRequests') : item === 'exam' ? t('subscription.examDetails') : t('subscription.contentDetailsTrack')}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {loading ? null : error ? (
            <DataNotFound onRetry={refetch} />
          ) : visibleExamRecords.length + visibleContentRecords.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg }]}> 
              <Ionicons name="receipt-outline" size={30} color={colors.textSecondary} />
              <Text variant="bodyLarge" weight="bold">{track === 'content' ? t('subscription.noContentPurchases') : t('subscription.noExamPurchases')}</Text>
              <Text variant="bodySmall" secondary style={{ textAlign: 'center' }}>{track === 'content' ? t('subscription.noContentPurchases') : t('subscription.purchaseDetailsEmpty')}</Text>
            </View>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {visibleExamRecords.map((record) => (
                <PurchaseCard key={`exam-${record.id}`} record={record} onPress={() => router.push(`/subscription/exam-purchase/${record.id}`)} />
              ))}
              {visibleContentRecords.map((record) => (
                <ContentPurchaseCard key={`content-${record.id}`} record={record} onPress={() => router.push(`/purchase-details/content/${record.id}`)} />
              ))}
            </View>
          )}
        </View>
      </SubpageScrollScreen>
      <PageLoaderOverlay visible={loading || refreshing} label={t('subscription.loading')} />
    </>
  );
}

function PurchaseCard({ record, onPress }: { record: ExamPurchaseRecord; onPress: () => void }) {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const status = record.status === 'active'
    ? { label: t('subscription.tagApproved'), color: colors.success, icon: 'checkmark-circle' as const }
    : record.status === 'rejected'
      ? { label: t('subscription.tagRejected'), color: colors.error, icon: 'close-circle' as const }
      : { label: t('subscription.purchasePending'), color: colors.warning, icon: 'time-outline' as const };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, opacity: pressed ? 0.78 : 1 }]}
    >
      <View style={styles.cardTop}>
        <View style={[styles.cardIcon, { backgroundColor: `${colors.primary}15`, borderRadius: radius.md }]}> 
          <Ionicons name="document-text-outline" size={21} color={colors.primary} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text variant="bodyLarge" weight="bold" numberOfLines={2}>{record.examTitle || t('subscription.examPurchase')}</Text>
          <Text variant="caption" secondary numberOfLines={1}>{record.courseName ?? '—'} · {record.subcourseName ?? '—'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={19} color={colors.textSecondary} />
      </View>
      <View style={styles.cardBottom}>
        <Text variant="caption" secondary>Rs. {record.amount} · {record.submittedAt ? formatDate(record.submittedAt) : '—'}</Text>
        <View style={[styles.status, { backgroundColor: `${status.color}18` }]}> 
          <Ionicons name={status.icon} size={12} color={status.color} />
          <Text variant="caption" weight="bold" style={{ color: status.color }}>{status.label}</Text>
        </View>
      </View>
      {record.adminMessage ? <Text variant="caption" style={{ color: colors.primary, marginTop: spacing.xs }}>{record.adminMessage}</Text> : null}
    </Pressable>
  );
}

function ContentPurchaseCard({ record, onPress }: { record: ContentPurchaseRecord; onPress: () => void }) {
  const { colors, spacing, radius } = useTheme();
  const { t, language } = useTranslation();
  const status = record.status === 'active'
    ? { label: t('subscription.tagApproved'), color: colors.success, icon: 'checkmark-circle' as const }
    : record.status === 'rejected'
      ? { label: t('subscription.tagRejected'), color: colors.error, icon: 'close-circle' as const }
      : { label: t('subscription.purchasePending'), color: colors.warning, icon: 'time-outline' as const };
  const title = language === 'ne' ? record.contentTitleNe || record.contentTitle : record.contentTitle;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, opacity: pressed ? 0.78 : 1 }]}>
      <View style={styles.cardTop}>
        <View style={[styles.cardIcon, { backgroundColor: `${colors.secondary}15`, borderRadius: radius.md }]}><Ionicons name="book-outline" size={21} color={colors.secondary} /></View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text variant="bodyLarge" weight="bold" numberOfLines={2}>{title || t('subscription.contentPurchase')}</Text>
          <Text variant="caption" secondary numberOfLines={1}>{record.contentType} · {record.subjectId}</Text>
        </View>
        <Ionicons name="chevron-forward" size={19} color={colors.textSecondary} />
      </View>
      <View style={styles.cardBottom}>
        <Text variant="caption" secondary>Rs. {record.amount} · {record.submittedAt ? formatDate(record.submittedAt) : '—'}</Text>
        <View style={[styles.status, { backgroundColor: `${status.color}18` }]}><Ionicons name={status.icon} size={12} color={status.color} /><Text variant="caption" weight="bold" style={{ color: status.color }}>{status.label}</Text></View>
      </View>
      {record.adminMessage ? <Text variant="caption" style={{ color: colors.primary, marginTop: spacing.xs }}>{record.adminMessage}</Text> : null}
    </Pressable>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  controlButton: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  intro: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1 },
  track: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, gap: 4 },
  trackItem: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8 },
  empty: { alignItems: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth },
  card: { borderWidth: StyleSheet.hairlineWidth, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
});
