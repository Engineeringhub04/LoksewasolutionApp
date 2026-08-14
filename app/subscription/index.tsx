// Profile → App Settings → Subscription Details.
//
// Shows the current plan status (pending/active/rejected/expired — each
// request stays visible forever with a status tag, never removed), the
// available plan cards (each with its own colour identity from Firestore,
// animated entrance), and a centered "We Accept" strip with the eSewa /
// Khalti / Fonepay logos on a soft tinted background.
import React from 'react';
import { View, StyleSheet, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { useProfileStore } from '@/src/core/store/profileStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import {
  fetchSubscriptionPlans,
  fetchMySubscriptionHistory,
  expireIfPastDue,
  type SubscriptionPlan,
  type SubscriptionRecord,
} from '@/src/core/firebase/services/subscription';
import { fetchMyExamPurchases, type ExamPurchaseRecord } from '@/src/core/firebase/services/examPurchases';
import { SubpageScrollScreen } from '@/src/components/nav/SubpageScrollScreen';
import { Text } from '@/src/components/misc/Text';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';

const ESEWA_LOGO = 'https://i.ibb.co/HLpHmnQz/esewa-icon-large.png';
const KHALTI_LOGO = 'https://i.ibb.co/tMHZRHKQ/Khalti-Logo-New-3.png';
const FONEPAY_LOGO = 'https://i.ibb.co/YBT7bXZQ/fonepay-logo-png-seeklogo-385625.png';

export default function SubscriptionScreen() {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { profile } = useProfileStore();

  const { data, loading, refreshing, error, refetch, refresh } = useAsyncData(async () => {
    if (!user?.uid) return null;
    await expireIfPastDue(user.uid).catch(() => {});
    const [plans, history, examPurchases] = await Promise.all([
      fetchSubscriptionPlans(),
      fetchMySubscriptionHistory(user.uid),
      fetchMyExamPurchases(user.uid),
    ]);
    return { plans, history, examPurchases };
  }, [user?.uid]);

  const goToPayment = (plan: SubscriptionPlan) => {
    router.push({ pathname: '/subscription/checkout', params: { planId: plan.id } });
  };

  const history = data?.history ?? [];
  const examPurchases = data?.examPurchases ?? [];
  const activeRecord = history.find((r) => r.status === 'active') ?? null;

  return (
    <>
      <SubpageScrollScreen title={t('subscription.title')} refreshing={refreshing} onRefresh={refresh}>
        {loading ? null : error ? (
          <DataNotFound onRetry={refetch} />
        ) : (
          <>
            <View style={[styles.hero, { backgroundColor: `${colors.primary}14`, borderRadius: radius.lg, padding: spacing.md }]}>
              <Ionicons name="diamond" size={26} color={colors.primary} />
              <Text variant="bodySmall" secondary style={{ flex: 1 }}>{t('subscription.subtitle')}</Text>
            </View>

            {history.length > 0 || examPurchases.length > 0 ? (
              <View style={{ gap: spacing.sm }}>
                <Text variant="bodySmall" weight="semiBold" secondary>{t('subscription.yourRequests')}</Text>
                {history.map((record) => (
                  <RequestHistoryCard key={record.id} record={record} onPress={() => router.push(`/subscription/${record.id}`)} />
                ))}
                {examPurchases.map((record) => (
                  <ExamPurchaseHistoryCard key={record.id} record={record} onPress={() => router.push(`/subscription/exam-purchase/${record.id}`)} />
                ))}
              </View>
            ) : null}

            <View style={{ gap: spacing.md }}>
              {(data?.plans ?? []).map((plan, index) => (
                <Animated.View key={plan.id} entering={FadeInDown.delay(index * 90).duration(400)}>
                  <PlanCard
                    plan={plan}
                    isCurrent={!!activeRecord && activeRecord.planId === plan.id}
                    onSubscribe={() => goToPayment(plan)}
                  />
                </Animated.View>
              ))}
            </View>

            <WeAcceptSection />

            {profile?.isAdmin ? (
              <View style={[styles.adminBox, { borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm }]}>
                <Pressable onPress={() => router.push('/admin/subscriptions')} style={[styles.row, { gap: spacing.sm }]}>
                  <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
                  <Text variant="bodySmall" weight="semiBold" style={{ color: colors.primary, flex: 1 }}>{t('subscription.adminReviewTitle')}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                </Pressable>
              </View>
            ) : null}
          </>
        )}
      </SubpageScrollScreen>
      <PageLoaderOverlay visible={loading || refreshing} label={t('subscription.loading')} />

    </>
  );
}

// ===================== Request history card (status tag, never removed) =====================

function RequestHistoryCard({ record, onPress }: { record: SubscriptionRecord; onPress: () => void }) {
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

  const content = (
    <View style={[styles.historyCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }]}>
      <View style={styles.row}>
        <Text variant="bodyLarge" weight="bold" style={{ flex: 1 }}>{record.planName}</Text>
        <View style={[styles.tag, { backgroundColor: `${tag.color}17` }]}>
          <Ionicons name={tag.icon} size={12} color={tag.color} />
          <Text variant="caption" weight="bold" style={{ color: tag.color }}>{tag.label}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </View>
      <Text variant="caption" secondary style={{ marginTop: 4 }}>
        Rs. {record.amount} · {record.method.toUpperCase()} {record.submittedAt ? `· ${formatDate(record.submittedAt)}` : ''}
      </Text>
      {record.status === 'rejected' && record.rejectionReason ? (
        <Text variant="bodySmall" style={{ marginTop: 6, color: colors.error }}>{record.rejectionReason}</Text>
      ) : null}
      {record.status === 'active' && record.expiryDate ? (
        <Text variant="bodySmall" secondary style={{ marginTop: 6 }}>{t('subscription.expiresOn')}: {formatDate(record.expiryDate)}</Text>
      ) : null}
    </View>
  );

  return <Pressable onPress={onPress}>{content}</Pressable>;
}

function ExamPurchaseHistoryCard({ record, onPress }: { record: ExamPurchaseRecord; onPress: () => void }) {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const tag = record.status === 'active'
    ? { label: t('subscription.tagApproved'), color: colors.success, icon: 'checkmark-circle' as const }
    : record.status === 'rejected'
      ? { label: t('subscription.tagRejected'), color: colors.error, icon: 'close-circle' as const }
      : { label: t('subscription.pendingReview'), color: colors.warning, icon: 'time' as const };

  return (
    <Pressable onPress={onPress} style={[styles.historyCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }]}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text variant="bodyLarge" weight="bold">{record.examTitle || t('subscription.examPurchase')}</Text>
          <Text variant="caption" secondary style={{ marginTop: 4 }}>
            {t('subscription.examDetails')} · Rs. {record.amount} · {record.submittedAt ? formatDate(record.submittedAt) : '—'}
          </Text>
        </View>
        <View style={[styles.tag, { backgroundColor: `${tag.color}17` }]}>
          <Ionicons name={tag.icon} size={12} color={tag.color} />
          <Text variant="caption" weight="bold" style={{ color: tag.color }}>{tag.label}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </View>
      {record.adminMessage ? <Text variant="caption" style={{ marginTop: spacing.xs, color: colors.primary }}>{record.adminMessage}</Text> : null}
    </Pressable>
  );
}

// ===================== Plan Card =====================

function PlanCard({ plan, isCurrent, onSubscribe }: { plan: SubscriptionPlan; isCurrent: boolean; onSubscribe: () => void }) {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const isFree = plan.billingCycle === 'free';
  const isYearly = plan.billingCycle === 'yearly';
  const cycleGradient: [string, string] = isFree
    ? ['#64748B', '#334155']
    : isYearly
      ? ['#0F766E', '#4338CA']
      : ['#7C3AED', '#DB2777'];
  const cardGradient: [string, string] = isFree
    ? cycleGradient
    : plan.colorFrom && plan.colorTo
      ? [plan.colorFrom, plan.colorTo]
      : cycleGradient;

  const priceSuffix = plan.billingCycle === 'monthly' ? t('subscription.perMonth') : plan.billingCycle === 'yearly' ? t('subscription.perYear') : '';

  return (
    <View style={[styles.planCardWrap, { borderRadius: radius.lg }, isCurrent && { borderWidth: 2, borderColor: colors.primary }]}>
      <LinearGradient colors={cardGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.planCard, { borderRadius: radius.lg, padding: spacing.lg }]}>
        {isYearly ? (
          <View style={[styles.badge, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
            <Ionicons name="star" size={11} color="#FFF" />
            <Text variant="overline" weight="bold" style={{ color: '#FFF' }}>{t('subscription.bestValue')}</Text>
          </View>
        ) : !isFree ? (
          <View style={[styles.badge, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
            <Ionicons name="flame" size={11} color="#FFF" />
            <Text variant="overline" weight="bold" style={{ color: '#FFF' }}>{t('subscription.mostPopular')}</Text>
          </View>
        ) : null}

        <View style={styles.planHeaderRow}>
          <View style={[styles.planIconBox, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Ionicons name={isFree ? 'gift-outline' : 'diamond'} size={20} color="#FFF" />
          </View>
          <Text variant="h3" weight="bold" style={{ color: '#FFF', flex: 1 }}>{plan.name}</Text>
        </View>

        <View style={styles.priceRow}>
          <Text variant="display" weight="bold" style={{ color: '#FFF' }}>{isFree ? t('subscription.free') : `Rs. ${plan.price}`}</Text>
          {priceSuffix ? <Text variant="body" style={{ color: 'rgba(255,255,255,0.85)', marginBottom: 4 }}>{priceSuffix}</Text> : null}
        </View>

        <View style={{ gap: 6, marginTop: spacing.sm, marginBottom: spacing.md }}>
          {plan.features.map((feature) => (
            <View key={feature} style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={16} color="#FFF" />
              <Text variant="bodySmall" style={{ color: 'rgba(255,255,255,0.95)', flex: 1 }}>{feature}</Text>
            </View>
          ))}
        </View>

        {isFree ? (
          <View style={[styles.currentPill, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Text variant="bodySmall" weight="semiBold" style={{ color: '#FFF' }}>{t('subscription.currentlyActive')}</Text>
          </View>
        ) : isCurrent ? (
          <View style={[styles.currentPill, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
            <Ionicons name="checkmark-circle" size={16} color="#FFF" />
            <Text variant="bodySmall" weight="bold" style={{ color: '#FFF' }}>{t('subscription.activePlan')}</Text>
          </View>
        ) : (
          <Pressable onPress={onSubscribe} style={[styles.subscribeBtn, { backgroundColor: '#FFF', borderRadius: radius.md }]}>
            <Ionicons name="diamond-outline" size={16} color={colors.textPrimary} style={{ marginRight: 6 }} />
            <Text variant="bodyLarge" weight="bold" style={{ color: colors.textPrimary }}>{t('subscription.subscribeNow')}</Text>
          </Pressable>
        )}
      </LinearGradient>
    </View>
  );
}

// ===================== We Accept section =====================

function WeAcceptSection() {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={[styles.weAcceptBox, { backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, padding: spacing.lg }]}>
      <Text variant="bodySmall" weight="bold" secondary style={styles.weAcceptTitle}>{t('subscription.weAccept')}</Text>
      <View style={styles.weAcceptLogos}>
        <Image source={{ uri: ESEWA_LOGO }} style={styles.weAcceptLogo} resizeMode="contain" />
        <Image source={{ uri: KHALTI_LOGO }} style={styles.weAcceptLogo} resizeMode="contain" />
        <Image source={{ uri: FONEPAY_LOGO }} style={styles.weAcceptLogo} resizeMode="contain" />
      </View>
    </View>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  divider: { height: StyleSheet.hairlineWidth },
  adminBox: { borderWidth: StyleSheet.hairlineWidth },
  historyCard: { borderWidth: StyleSheet.hairlineWidth },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  planCardWrap: { overflow: 'hidden', shadowColor: '#0F172A', shadowOpacity: 0.16, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  planCard: { gap: 2 },
  planHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  planIconBox: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 10 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginBottom: 4 },
  currentPill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12 },
  subscribeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 13 },
  weAcceptBox: { alignItems: 'center' },
  weAcceptTitle: { letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },
  weAcceptLogos: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22 },
  weAcceptLogo: { width: 56, height: 32 },
});
