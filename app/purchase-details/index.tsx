// Profile → App Settings → Purchase Details.
//
// One list of everything the student has bought individually: exam papers plus
// subject / unit / chapter content. Filter by track, tap through to the request.
//
// UI only — fetching, the track filter and both detail routes are unchanged.
// What changed: the two purchase cards were near-identical copies that had
// already drifted apart, so they now share one presentational shell; the 3-up
// segmented control (which squeezed "Content Details" into a third of the
// screen) became a scrollable FilterTrack with counts; and the content card no
// longer prints raw Firestore ids at the user ("chapter · gk-2081"), it shows a
// translated content-type pill instead.
//
// This page is purely the student's own record. The admin "Purchase Request
// Control" link that used to sit above the filter now lives only in
// Profile → Admin, so admin tools are found in one place rather than hidden
// inside whichever user-facing list they happen to relate to.
import React, { useMemo, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchMyExamPurchases, type ExamPurchaseRecord } from '@/src/core/firebase/services/examPurchases';
import { fetchMyContentPurchases, type ContentPurchaseRecord, type ContentPurchaseType } from '@/src/core/firebase/services/contentPurchases';
import { SubpageScrollScreen } from '@/src/components/nav/SubpageScrollScreen';
import { Text } from '@/src/components/misc/Text';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { Preloading } from '@/src/components/Preloading';
import {
  HeroBand,
  SectionCard,
  StatusPill,
  StatTile,
  FilterTrack,
  QuotePanel,
  useTones,
  type Tone,
} from '@/src/components/premium';

const TRACKS = ['all', 'exam', 'content'] as const;
type Track = (typeof TRACKS)[number];

type PurchaseStatus = 'pending' | 'active' | 'rejected';

function statusTone(status: PurchaseStatus): Tone {
  if (status === 'active') return 'success';
  if (status === 'rejected') return 'danger';
  return 'warning';
}

function statusIcon(status: PurchaseStatus): keyof typeof Ionicons.glyphMap {
  if (status === 'active') return 'checkmark-circle';
  if (status === 'rejected') return 'close-circle';
  return 'time';
}

function contentTypeKey(type: ContentPurchaseType): string {
  if (type === 'subject') return 'subscription.typeSubject';
  if (type === 'unit') return 'subscription.typeUnit';
  return 'subscription.typeChapter';
}

export default function PurchaseDetailsScreen() {
  const { spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [track, setTrack] = useState<Track>('all');

  const { data, loading, settled, refreshing, error, refetch, refresh } = useAsyncData(
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

  // Purely presentational: the hero counts what the two lists already hold.
  const tally = useMemo(() => {
    const all: PurchaseStatus[] = [...examRecords.map((r) => r.status), ...contentRecords.map((r) => r.status)];
    return {
      total: all.length,
      pending: all.filter((s) => s === 'pending').length,
      active: all.filter((s) => s === 'active').length,
    };
  }, [examRecords, contentRecords]);

  const filterItems = [
    { value: 'all' as Track, label: t('subscription.allRequests'), count: examRecords.length + contentRecords.length },
    { value: 'exam' as Track, label: t('subscription.examDetails'), count: examRecords.length },
    { value: 'content' as Track, label: t('subscription.contentDetailsTrack'), count: contentRecords.length },
  ];

  return (
    <>
      <SubpageScrollScreen title={t('subscription.purchaseDetails')} refreshing={refreshing} onRefresh={refresh}>
        {/* Everything between the header and the loader gate is data-driven —
            the hero counts the fetched records — so it hides with the rest
            until the first load settles. Otherwise the page opened on a card
            full of zeroes and the loader only covered the list. */}
        {!settled ? (
          <View style={{ flex: 1 }}>
            <Preloading tinted={false} label={t('subscription.loading')} hint={t('loadHints.purchases')} />
          </View>
        ) : (
        <>
        <HeroBand
          icon="receipt"
          title={t('subscription.purchaseDetails')}
          subtitle={t('subscription.purchaseDetailsSubtitle')}
          tone="primary"
          footer={
            <>
              <StatTile value={tally.total} label={t('subscription.allRequests')} icon="layers-outline" grow />
              <StatTile value={tally.pending} label={t('subscription.pendingReview')} icon="time-outline" tone="warning" grow />
              <StatTile value={tally.active} label={t('subscription.tagApproved')} icon="checkmark-circle" tone="success" grow />
            </>
          }
        />

        {/* FilterTrack re-adds screenPadding inside its own scroll content, so it
            is pulled out to the screen edge to bleed correctly. */}
        <View style={{ marginHorizontal: -spacing.screenPadding }}>
          <FilterTrack items={filterItems} value={track} onChange={setTrack} />
        </View>

        {/* Blank while the FIRST load is in flight — never show empty/demo
            content behind the loader only to swap it later. Refetches keep the
            current list on screen instead of blanking it. */}
        {error ? (
          <DataNotFound onRetry={refetch} />
        ) : visibleExamRecords.length + visibleContentRecords.length === 0 ? (
          <EmptyPurchases track={track} />
        ) : (
          <View style={{ gap: spacing.md }}>
            {visibleExamRecords.map((record) => (
              <ExamPurchaseCard key={`exam-${record.id}`} record={record} onPress={() => router.push(`/subscription/exam-purchase/${record.id}`)} />
            ))}
            {visibleContentRecords.map((record) => (
              <ContentPurchaseCard key={`content-${record.id}`} record={record} onPress={() => router.push(`/purchase-details/content/${record.id}`)} />
            ))}
          </View>
        )}
        </>
        )}
      </SubpageScrollScreen>
    </>
  );
}

// ===================== One card shell, two record shapes =====================

interface PurchaseCardShellProps {
  icon: keyof typeof Ionicons.glyphMap;
  tone: Tone;
  title: string;
  meta: string;
  badge?: React.ReactNode;
  status: PurchaseStatus;
  statusLabel: string;
  amount: number;
  date: string | null;
  adminMessage: string | null;
  onPress: () => void;
}

function PurchaseCardShell({ icon, tone, title, meta, badge, status, statusLabel, amount, date, adminMessage, onPress }: PurchaseCardShellProps) {
  const { colors, spacing, radius } = useTheme();
  const tones = useTones();
  const kind = tones[tone];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          // Tint on press rather than fade: fading a whole card dims its text
          // too, which reads as "disabled" on the exact tap you just made.
          backgroundColor: pressed ? kind.bg : colors.surface,
          borderColor: colors.border,
          borderRadius: radius.lg,
          padding: spacing.md,
        },
      ]}
    >
      <View style={styles.cardTop}>
        <View style={[styles.cardIcon, { backgroundColor: kind.bg, borderColor: kind.border, borderRadius: radius.md }]}>
          <Ionicons name={icon} size={20} color={kind.fg} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text variant="bodyLarge" weight="bold" numberOfLines={2}>{title}</Text>
          {meta ? <Text variant="caption" secondary numberOfLines={1}>{meta}</Text> : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textDisabled} />
      </View>

      <View style={styles.cardBottom}>
        <View style={styles.badgeRow}>
          <StatusPill label={statusLabel} tone={statusTone(status)} icon={statusIcon(status)} size="sm" />
          {badge}
        </View>
        <Text variant="caption" weight="semiBold" secondary numberOfLines={1}>
          Rs. {amount}{date ? ` · ${date}` : ''}
        </Text>
      </View>

      {adminMessage ? (
        <QuotePanel tone={statusTone(status)} icon="chatbubble-ellipses-outline" spine>
          <Text variant="bodySmall">{adminMessage}</Text>
        </QuotePanel>
      ) : null}
    </Pressable>
  );
}

function ExamPurchaseCard({ record, onPress }: { record: ExamPurchaseRecord; onPress: () => void }) {
  const { t } = useTranslation();
  const statusLabel = record.status === 'active'
    ? t('subscription.tagApproved')
    : record.status === 'rejected'
      ? t('subscription.tagRejected')
      : t('subscription.purchasePending');

  return (
    <PurchaseCardShell
      icon="document-text-outline"
      tone="primary"
      title={record.examTitle || t('subscription.examPurchase')}
      meta={[record.courseName, record.subcourseName].filter(Boolean).join(' · ')}
      badge={<StatusPill label={t('subscription.examDetails')} tone="primary" icon="school-outline" size="sm" />}
      status={record.status}
      statusLabel={statusLabel}
      amount={record.amount}
      date={record.submittedAt ? formatDate(record.submittedAt) : null}
      adminMessage={record.adminMessage}
      onPress={onPress}
    />
  );
}

function ContentPurchaseCard({ record, onPress }: { record: ContentPurchaseRecord; onPress: () => void }) {
  const { t, language } = useTranslation();
  const title = language === 'ne' ? record.contentTitleNe || record.contentTitle : record.contentTitle;
  const statusLabel = record.status === 'active'
    ? t('subscription.tagApproved')
    : record.status === 'rejected'
      ? t('subscription.tagRejected')
      : t('subscription.purchasePending');

  return (
    <PurchaseCardShell
      icon="book-outline"
      tone="accent"
      title={title || t('subscription.contentPurchase')}
      meta=""
      // The old card printed `contentType · subjectId` — a raw enum next to a
      // raw document id. The type is the only part a student can read, so it
      // becomes a translated pill.
      badge={<StatusPill label={t(contentTypeKey(record.contentType))} tone="accent" icon="layers-outline" size="sm" />}
      status={record.status}
      statusLabel={statusLabel}
      amount={record.amount}
      date={record.submittedAt ? formatDate(record.submittedAt) : null}
      adminMessage={record.adminMessage}
      onPress={onPress}
    />
  );
}

// ===================== Empty state =====================

function EmptyPurchases({ track }: { track: Track }) {
  const { spacing, radius } = useTheme();
  const { t } = useTranslation();
  const tones = useTones();
  const tone = tones.primary;

  return (
    <SectionCard>
      <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md }}>
        <View style={[styles.emptyBadge, { backgroundColor: tone.bg, borderColor: tone.border, borderRadius: radius.lg }]}>
          <Ionicons name="receipt-outline" size={30} color={tone.fg} />
        </View>
        <Text variant="bodyLarge" weight="bold" style={{ textAlign: 'center' }}>
          {track === 'content' ? t('subscription.noContentPurchases') : t('subscription.noExamPurchases')}
        </Text>
        {/* The old page used the same string for the title AND the description
            on the content track, so the empty state said the same thing twice. */}
        <Text variant="bodySmall" secondary style={{ textAlign: 'center' }}>{t('subscription.purchaseDetailsEmpty')}</Text>
      </View>
    </SectionCard>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, gap: 11 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  cardIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  emptyBadge: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
});
