// Admin desk — every subscription request, newest first. A request is NEVER
// removed from this list after review; it just changes tag (New → Approved
// / Rejected), so the admin always has a full audit trail here.
//
// UI ONLY in this round: the queries, the statuses and the detail route are
// untouched. What changed is that the page now opens with the numbers an admin
// actually came for (how many are waiting), the filter is the shared
// FilterTrack rather than three bespoke chips, and each row leads with WHO is
// asking instead of a status glyph — the admin already filtered by status, so
// repeating it as the first thing on every card wasted the strongest position.
//
// The "Purchase Request Control" link that used to sit at the top of this page
// moved to Profile → Admin. Admin tools are gathered in one section now, rather
// than each one hiding inside whichever list it happens to be related to.
import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchAllSubscriptions, type SubscriptionRecord, type SubscriptionStatus } from '@/src/core/firebase/services/subscription';
import { SubpageScrollScreen } from '@/src/components/nav/SubpageScrollScreen';
import { Text } from '@/src/components/misc/Text';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { Preloading } from '@/src/components/Preloading';
import { HeroBand, StatTile, StatusPill, FilterTrack, useTones, type Tone } from '@/src/components/premium';

type FilterTab = 'all' | SubscriptionStatus;

function statusTone(status: SubscriptionStatus): Tone {
  if (status === 'active') return 'success';
  if (status === 'rejected') return 'danger';
  if (status === 'expired') return 'neutral';
  return 'warning';
}

function statusIcon(status: SubscriptionStatus): keyof typeof Ionicons.glyphMap {
  if (status === 'active') return 'checkmark-circle';
  if (status === 'rejected') return 'close-circle';
  if (status === 'expired') return 'time';
  return 'sparkles';
}

export default function AdminSubscriptionsScreen() {
  const { spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [filter, setFilter] = useState<FilterTab>('all');

  const { data, settled, refreshing, error, refetch, refresh } = useAsyncData(async () => {
    return fetchAllSubscriptions();
  }, []);

  const all = useMemo(() => data ?? [], [data]);
  const tally = useMemo(
    () => ({
      total: all.length,
      pending: all.filter((r) => r.status === 'pending').length,
      active: all.filter((r) => r.status === 'active').length,
      rejected: all.filter((r) => r.status === 'rejected').length,
    }),
    [all],
  );
  const filtered = useMemo(() => (filter === 'all' ? all : all.filter((r) => r.status === filter)), [all, filter]);

  const filterItems = [
    { value: 'all' as FilterTab, label: t('subscription.adminTotalRequests'), count: tally.total },
    { value: 'pending' as FilterTab, label: t('subscription.tagNew'), count: tally.pending },
    { value: 'active' as FilterTab, label: t('subscription.tagApproved'), count: tally.active },
    { value: 'rejected' as FilterTab, label: t('subscription.tagRejected'), count: tally.rejected },
  ];

  return (
    <SubpageScrollScreen title={t('subscription.adminReviewTitle')} refreshing={refreshing} onRefresh={refresh}>
      {/* The hero counts fetched records, so it must stay behind the loader gate
          with everything else — otherwise the page opens on a band of zeroes
          that rewrites itself a moment later. */}
      {!settled ? (
        <View style={{ flex: 1 }}>
          <Preloading tinted={false} label={t('subscription.loading')} hint={t('loadHints.purchases')} />
        </View>
      ) : (
        <>
          <HeroBand
            icon="shield-checkmark"
            title={t('subscription.adminReviewTitle')}
            subtitle={t('subscription.adminReviewHint')}
            tone="info"
            footer={
              <>
                <StatTile value={tally.total} label={t('subscription.adminTotalRequests')} icon="layers-outline" grow />
                <StatTile value={tally.pending} label={t('subscription.adminAwaiting')} icon="time-outline" tone="warning" grow />
                <StatTile value={tally.active} label={t('subscription.tagApproved')} icon="checkmark-circle" tone="success" grow />
              </>
            }
          />

          {/* FilterTrack re-adds screenPadding inside its own scroll content, so
              it is pulled out to the screen edge to bleed correctly. */}
          <View style={{ marginHorizontal: -spacing.screenPadding }}>
            <FilterTrack items={filterItems} value={filter} onChange={setFilter} />
          </View>

          {error ? (
            <DataNotFound onRetry={refetch} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="checkmark-done-circle-outline"
              title={t('subscription.adminNoPending')}
              description={filter === 'all' ? undefined : t('subscription.adminReviewHint')}
            />
          ) : (
            <View style={{ gap: spacing.sm }}>
              {filtered.map((record, index) => (
                <Animated.View key={record.id} entering={FadeInDown.delay(Math.min(index, 8) * 55).duration(360)}>
                  <RequestCard record={record} onPress={() => router.push(`/admin/subscriptions/${record.id}`)} />
                </Animated.View>
              ))}
            </View>
          )}
        </>
      )}
    </SubpageScrollScreen>
  );
}

function RequestCard({ record, onPress }: { record: SubscriptionRecord; onPress: () => void }) {
  const { colors, spacing, radius, elevation } = useTheme();
  const { t } = useTranslation();
  const tones = useTones();
  const tone = tones[statusTone(record.status)];

  const label =
    record.status === 'active'
      ? t('subscription.tagApproved')
      : record.status === 'rejected'
        ? t('subscription.tagRejected')
        : record.status === 'expired'
          ? t('subscription.tagExpired')
          : t('subscription.tagNew');

  const who = record.userName ?? record.userEmail ?? record.uid;
  const initial = (who || '?').trim().charAt(0).toUpperCase();

  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.98, { damping: 18, stiffness: 320 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 16, stiffness: 260 }); }}
        style={[
          styles.card,
          elevation[1],
          { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md },
        ]}
      >
        {/* A tone spine instead of a tone-filled icon box: the status still reads
            at a glance down the left edge of the list, but the strongest slot on
            the row goes to the person, which is what the admin is scanning for. */}
        <View style={[styles.spine, { backgroundColor: tone.solid }]} />

        <View style={styles.row}>
          <View style={[styles.avatar, { backgroundColor: tone.bg, borderColor: tone.border }]}>
            <Text variant="bodyLarge" weight="bold" style={{ color: tone.fg }}>{initial}</Text>
          </View>

          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="bodyLarge" weight="bold" numberOfLines={1}>{who}</Text>
            <Text variant="caption" secondary numberOfLines={1}>
              {record.planName} · Rs. {record.amount} · {record.method.toUpperCase()}
            </Text>
            <View style={styles.metaRow}>
              <StatusPill label={label} tone={statusTone(record.status)} size="sm" icon={statusIcon(record.status)} />
              {record.submittedAt ? (
                <Text variant="caption" style={{ color: colors.textDisabled }} numberOfLines={1}>
                  {formatDate(record.submittedAt)}
                </Text>
              ) : null}
            </View>
          </View>

          <Ionicons name="chevron-forward" size={18} color={colors.textDisabled} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  spine: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 6 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
});
