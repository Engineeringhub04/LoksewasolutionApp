import React, { useMemo, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchMyReportHistory, type ReportHistoryRecord } from '@/src/core/firebase/services/reportHistory';
import { SubpageScrollScreen } from '@/src/components/nav/SubpageScrollScreen';
import { Text } from '@/src/components/misc/Text';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';

const TRACKS = ['all', 'question', 'discussion'] as const;
type Track = (typeof TRACKS)[number];

export default function ReportHistoryScreen() {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const uid = useAuthStore((state) => state.user?.uid);
  const [track, setTrack] = useState<Track>('all');
  const { data, loading, refreshing, error, refetch, refresh } = useAsyncData(
    () => uid ? fetchMyReportHistory(uid) : Promise.resolve([]),
    [uid],
  );

  const records = useMemo(() => {
    const all = data ?? [];
    return track === 'all' ? all : all.filter((record) => track === 'question' ? record.source === 'question' : record.source !== 'question');
  }, [data, track]);

  return (
    <>
      <SubpageScrollScreen title={t('discussion.yourReportHistory')} refreshing={refreshing} onRefresh={refresh}>
        <View style={{ gap: spacing.md }}>
          <View style={[styles.intro, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}30`, borderRadius: radius.lg, padding: spacing.md }]}>
            <Ionicons name="flag-outline" size={24} color={colors.primary} />
            <Text variant="bodySmall" secondary style={{ flex: 1 }}>{t('discussion.reportHistorySubtitle')}</Text>
          </View>
          <View style={[styles.track, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, borderRadius: radius.md, padding: 4 }]}>
            {TRACKS.map((item) => {
              const active = track === item;
              return <Pressable key={item} onPress={() => setTrack(item)} style={[styles.trackItem, active && { backgroundColor: colors.primary, borderRadius: radius.sm }]}>
                <Ionicons name={item === 'all' ? 'layers-outline' : item === 'question' ? 'help-circle-outline' : 'chatbubbles-outline'} size={15} color={active ? colors.onPrimary : colors.textSecondary} />
                <Text variant="bodySmall" weight={active ? 'bold' : 'semiBold'} style={{ color: active ? colors.onPrimary : colors.textSecondary }}>{item === 'all' ? t('discussion.allReports') : item === 'question' ? t('discussion.questionReports') : t('discussion.discussionReports')}</Text>
              </Pressable>;
            })}
          </View>
          {loading ? null : error ? <DataNotFound onRetry={refetch} /> : records.length === 0 ? <EmptyReportState /> : (
            <View style={{ gap: spacing.sm }}>{records.map((record) => <ReportCard key={record.id} record={record} onPress={() => router.push(`/report-history/${record.id}`)} />)}</View>
          )}
        </View>
      </SubpageScrollScreen>
      <PageLoaderOverlay visible={loading || refreshing} label={t('common.loading')} />
    </>
  );

  function EmptyReportState() {
    return <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg }]}><Ionicons name="flag-outline" size={30} color={colors.textSecondary} /><Text variant="bodyLarge" weight="bold">{t('discussion.noReports')}</Text><Text variant="bodySmall" secondary style={{ textAlign: 'center' }}>{t('discussion.noReportsSubtitle')}</Text></View>;
  }
}

function ReportCard({ record, onPress }: { record: ReportHistoryRecord; onPress: () => void }) {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const status = record.status === 'resolved' ? { label: t('discussion.reportResolved'), color: colors.success } : record.status === 'dismissed' ? { label: t('discussion.reportDismissed'), color: colors.error } : { label: t('discussion.reportPending'), color: colors.warning };
  const sourceLabel = record.source === 'question' ? t('discussion.questionReport') : record.source === 'comment' ? t('discussion.commentReport') : t('discussion.discussionReport');
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, opacity: pressed ? 0.78 : 1 }]}>
    <View style={styles.cardTop}><View style={[styles.icon, { backgroundColor: `${colors.primary}15`, borderRadius: radius.md }]}><Ionicons name={record.source === 'question' ? 'help-circle-outline' : 'flag-outline'} size={21} color={colors.primary} /></View><View style={{ flex: 1, gap: 3 }}><Text variant="bodyLarge" weight="bold" numberOfLines={2}>{record.targetTitle ?? sourceLabel}</Text><Text variant="caption" secondary numberOfLines={1}>{sourceLabel} · {record.reason}</Text></View><Ionicons name="chevron-forward" size={19} color={colors.textSecondary} /></View>
    <View style={styles.cardBottom}><Text variant="caption" secondary>{record.createdAt?.toDate().toLocaleDateString() ?? '—'}</Text><View style={[styles.status, { backgroundColor: `${status.color}18` }]}><Text variant="caption" weight="bold" style={{ color: status.color }}>{status.label}</Text></View></View>
  </Pressable>;
}

const styles = StyleSheet.create({
  intro: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1 },
  track: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, gap: 4 },
  trackItem: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8 },
  empty: { alignItems: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth },
  card: { borderWidth: StyleSheet.hairlineWidth, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  status: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
});
