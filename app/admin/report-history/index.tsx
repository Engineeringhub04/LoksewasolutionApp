import React, { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchAllReportHistory, type ReportHistoryRecord } from '@/src/core/firebase/services/reportHistory';
import { SubpageScrollScreen } from '@/src/components/nav/SubpageScrollScreen';
import { Text } from '@/src/components/misc/Text';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';

const TRACKS = ['all', 'question', 'discussion'] as const;
type Track = (typeof TRACKS)[number];

export default function AdminReportHistoryScreen() {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [track, setTrack] = useState<Track>('all');
  const { data, loading, refreshing, error, refetch, refresh } = useAsyncData(fetchAllReportHistory, []);

  const records = useMemo(() => {
    const all = data ?? [];
    if (track === 'all') return all;
    return all.filter((record) => track === 'question' ? record.source === 'question' : record.source !== 'question');
  }, [data, track]);

  return (
    <>
      <SubpageScrollScreen title={t('discussion.reportDetailsControl')} refreshing={refreshing} onRefresh={refresh}>
        <View style={{ gap: spacing.md }}>
          <View style={[styles.intro, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}30`, borderRadius: radius.lg, padding: spacing.md }]}>
            <Ionicons name="shield-checkmark-outline" size={24} color={colors.primary} />
            <Text variant="bodySmall" secondary style={{ flex: 1 }}>{t('discussion.reportDetailsControlHint')}</Text>
          </View>
          <View style={[styles.track, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, borderRadius: radius.md, padding: 4 }]}>
            {TRACKS.map((item) => {
              const active = track === item;
              return (
                <Pressable key={item} onPress={() => setTrack(item)} style={[styles.trackItem, active && { backgroundColor: colors.primary, borderRadius: radius.sm }]}>
                  <Ionicons name={item === 'all' ? 'layers-outline' : item === 'question' ? 'help-circle-outline' : 'chatbubbles-outline'} size={15} color={active ? colors.onPrimary : colors.textSecondary} />
                  <Text variant="bodySmall" weight={active ? 'bold' : 'semiBold'} style={{ color: active ? colors.onPrimary : colors.textSecondary }}>
                    {item === 'all' ? t('discussion.allReports') : item === 'question' ? t('discussion.questionReports') : t('discussion.discussionReports')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {loading ? null : error ? <DataNotFound onRetry={refetch} /> : records.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg }]}>
              <Ionicons name="flag-outline" size={32} color={colors.textSecondary} />
              <Text variant="bodyLarge" weight="bold">{t('discussion.noReports')}</Text>
              <Text variant="bodySmall" secondary style={{ textAlign: 'center' }}>{t('discussion.noReportsSubtitle')}</Text>
            </View>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {records.map((record) => <AdminReportCard key={record.id} record={record} onPress={() => router.push(`/admin/report-history/${record.id}`)} />)}
            </View>
          )}
        </View>
      </SubpageScrollScreen>
      <PageLoaderOverlay visible={loading || refreshing} label={t('common.loading')} />
    </>
  );
}

function AdminReportCard({ record, onPress }: { record: ReportHistoryRecord; onPress: () => void }) {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const isNew = record.status === 'pending';
  const statusColor = isNew ? colors.warning : record.status === 'resolved' ? colors.success : record.status === 'dismissed' ? colors.error : colors.primary;
  const sourceLabel = record.source === 'question' ? t('discussion.questionReport') : record.source === 'comment' ? t('discussion.commentReport') : t('discussion.discussionReport');
  const targetLabel = record.targetTitle || record.targetPreview || sourceLabel;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, opacity: pressed ? 0.78 : 1 }]}>
      <View style={styles.cardTop}>
        {record.reporterPhoto ? <Image source={{ uri: record.reporterPhoto }} style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: `${colors.primary}15` }]}><Ionicons name="person" size={20} color={colors.primary} /></View>}
        <View style={{ flex: 1, gap: 3 }}>
          <Text variant="bodyLarge" weight="bold" numberOfLines={1}>{record.reporterName}</Text>
          <Text variant="caption" secondary numberOfLines={1}>{record.reporterEmail || '—'}</Text>
          <Text variant="caption" secondary numberOfLines={1}>{record.reporterCourseId || '—'} · {record.reporterSubcourseId || '—'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={19} color={colors.textSecondary} />
      </View>
      <View style={styles.targetRow}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text variant="caption" secondary>{sourceLabel}</Text>
          <Text variant="bodySmall" weight="semiBold" numberOfLines={2}>{targetLabel}</Text>
        </View>
        <View style={[styles.status, { backgroundColor: `${statusColor}18` }]}>
          <Ionicons name={isNew ? 'sparkles-outline' : 'flag-outline'} size={12} color={statusColor} />
          <Text variant="caption" weight="bold" style={{ color: statusColor }}>{isNew ? t('discussion.reportNew') : record.status}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  intro: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1 },
  track: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, gap: 4 },
  trackItem: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 6 },
  empty: { alignItems: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth },
  card: { borderWidth: StyleSheet.hairlineWidth, gap: 11 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  targetRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999 },
});

