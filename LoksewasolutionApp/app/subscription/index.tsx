// Profile → App Settings → Subscription Details.
//
// Shows 3 plan cards (Free / Monthly / Yearly), the currently accepted
// payment methods, and — depending on the user's current subscription
// record — either a "choose a plan" state, a Pending review card, a
// Rejected card (visible for 1 day per PRD), or an Active/Expired card.
//
// Real eSewa/Khalti auto-payment needs a verified business merchant
// account, which this app doesn't have yet (see subscription.ts header
// comment). Until then `subscriptionSettings.activeMode` decides which flow
// renders — Auto or Manual — and an admin flips that one field to go live
// later without a code change.
import React, { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { useProfileStore } from '@/src/core/store/profileStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { showToast } from '@/src/core/store/toastStore';
import {
  fetchSubscriptionPlans,
  fetchSubscriptionSettings,
  fetchMySubscription,
  expireIfPastDue,
  isRejectionStillVisible,
  seedSubscriptionData,
  type SubscriptionPlan,
  type SubscriptionRecord,
} from '@/src/core/firebase/services/subscription';
import { SubpageScrollScreen } from '@/src/components/nav/SubpageScrollScreen';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { ConfirmDialog } from '@/src/components/feedback/ConfirmDialog';
import { PaymentMethodBadges } from '@/src/components/subscription/PaymentMethodBadges';

export default function SubscriptionScreen() {
  const { colors, spacing, radius, gradients } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { profile } = useProfileStore();
  const [seeding, setSeeding] = useState(false);
  const [showSeedConfirm, setShowSeedConfirm] = useState(false);

  const { data, loading, refreshing, error, refetch, refresh } = useAsyncData(async () => {
    if (!user?.uid) return null;
    await expireIfPastDue(user.uid).catch(() => {});
    const [plans, settings, mySub] = await Promise.all([
      fetchSubscriptionPlans(),
      fetchSubscriptionSettings(),
      fetchMySubscription(user.uid),
    ]);
    return { plans, settings, mySub };
  }, [user?.uid]);

  const handleSeed = async () => {
    setShowSeedConfirm(false);
    setSeeding(true);
    try {
      await seedSubscriptionData();
      showToast(t('subscription.seedSuccess'), 'success');
      refetch();
    } catch {
      showToast(t('subscription.seedError'), 'error');
    } finally {
      setSeeding(false);
    }
  };

  const goToPayment = (plan: SubscriptionPlan) => {
    router.push({ pathname: '/subscription/checkout', params: { planId: plan.id } });
  };

  const mySub = data?.mySub ?? null;
  const isActive = mySub?.status === 'active';
  const isPending = mySub?.status === 'pending';
  const isRejectedVisible = mySub?.status === 'rejected' && isRejectionStillVisible(mySub.reviewedAt);

  return (
    <>
      <SubpageScrollScreen title={t('subscription.title')} refreshing={refreshing} onRefresh={refresh}>
        {loading ? null : error ? (
          <DataNotFound onRetry={refetch} />
        ) : (
          <>
            <View style={[styles.hero, { backgroundColor: `${colors.primary}14`, borderRadius: radius.lg, padding: spacing.md }]}>
              <Ionicons name="diamond" size={26} color={colors.primary} />
              <Text variant="bodySmall" secondary style={{ flex: 1 }}>
                {t('subscription.subtitle')}
              </Text>
            </View>

            {isPending && mySub ? <PendingCard record={mySub} /> : null}
            {isRejectedVisible && mySub ? <RejectedCard record={mySub} /> : null}
            {isActive && mySub ? <ActiveCard record={mySub} /> : null}
            {mySub?.status === 'expired' ? <ExpiredCard /> : null}

            <View style={{ gap: spacing.md }}>
              {(data?.plans ?? []).map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  isCurrent={isActive && mySub?.planId === plan.id}
                  onSubscribe={() => goToPayment(plan)}
                  gradients={gradients}
                />
              ))}
            </View>

            <PaymentMethodBadges settings={data?.settings ?? null} />

            {profile?.isAdmin ? (
              <View style={[styles.adminBox, { borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm }]}>
                <Pressable onPress={() => router.push('/admin/subscriptions')} style={[styles.row, { gap: spacing.sm }]}>
                  <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
                  <Text variant="bodySmall" weight="semiBold" style={{ color: colors.primary, flex: 1 }}>
                    {t('subscription.adminReviewTitle')}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                </Pressable>

                <View style={[styles.divider, { backgroundColor: colors.divider }]} />

                <Button label={t('subscription.seedButton')} variant="secondary" loading={seeding} onPress={() => setShowSeedConfirm(true)} />
              </View>
            ) : null}
          </>
        )}
      </SubpageScrollScreen>
      <PageLoaderOverlay visible={loading || refreshing} label={t('subscription.loading')} />

      <ConfirmDialog
        visible={showSeedConfirm}
        title={t('subscription.seedConfirmTitle')}
        message={t('subscription.seedConfirmMessage')}
        onConfirm={handleSeed}
        onCancel={() => setShowSeedConfirm(false)}
      />
    </>
  );
}

// ===================== Plan Card =====================

function PlanCard({
  plan,
  isCurrent,
  onSubscribe,
  gradients,
}: {
  plan: SubscriptionPlan;
  isCurrent: boolean;
  onSubscribe: () => void;
  gradients: ReturnType<typeof useTheme>['gradients'];
}) {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const isFree = plan.billingCycle === 'free';
  const isYearly = plan.billingCycle === 'yearly';
  const cardGradient = isFree ? (['#64748B', '#475569'] as const) : (gradients.premiumGold as unknown as [string, string]);

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
          <Text variant="display" weight="bold" style={{ color: '#FFF' }}>
            {isFree ? t('subscription.free') : `Rs. ${plan.price}`}
          </Text>
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
            <Text variant="bodyLarge" weight="bold" style={{ color: colors.textPrimary }}>{t('subscription.subscribeNow')}</Text>
          </Pressable>
        )}
      </LinearGradient>
    </View>
  );
}

// ===================== Status Cards =====================

function PendingCard({ record }: { record: SubscriptionRecord }) {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <View style={[cardStyles.box, { backgroundColor: `${colors.warning}14`, borderColor: colors.warning, borderRadius: radius.lg, padding: spacing.md }]}>
      <View style={styles.row}>
        <Ionicons name="time-outline" size={20} color={colors.warning} />
        <Text variant="bodyLarge" weight="bold" style={{ color: colors.warning, flex: 1 }}>{t('subscription.pendingTitle')}</Text>
      </View>
      <Text variant="bodySmall" secondary style={{ marginTop: spacing.xs }}>{t('subscription.pendingMessage')}</Text>
      <View style={{ marginTop: spacing.sm, gap: 4 }}>
        <InfoLine label={t('subscription.pendingPlan')} value={record.planName} />
        <InfoLine label={t('subscription.pendingAmount')} value={`Rs. ${record.amount}`} />
        <InfoLine label={t('subscription.pendingMethod')} value={record.method} />
        {record.transactionRef ? <InfoLine label={t('subscription.pendingRef')} value={record.transactionRef} /> : null}
      </View>
      <Pressable onPress={() => router.push('/contact-us')} style={{ marginTop: spacing.sm }}>
        <Text variant="bodySmall" weight="semiBold" style={{ color: colors.primary }}>
          {t('subscription.contactForFastApproval')}
        </Text>
      </Pressable>
    </View>
  );
}

function RejectedCard({ record }: { record: SubscriptionRecord }) {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <View style={[cardStyles.box, { backgroundColor: `${colors.error}14`, borderColor: colors.error, borderRadius: radius.lg, padding: spacing.md }]}>
      <View style={styles.row}>
        <Ionicons name="close-circle-outline" size={20} color={colors.error} />
        <Text variant="bodyLarge" weight="bold" style={{ color: colors.error, flex: 1 }}>{t('subscription.rejectedTitle')}</Text>
      </View>
      <Text variant="bodySmall" secondary style={{ marginTop: spacing.xs }}>{t('subscription.rejectedMessage')}</Text>
      {record.rejectionReason ? (
        <Text variant="bodySmall" style={{ marginTop: spacing.xs, color: colors.error }}>
          {t('subscription.rejectedReason')}: {record.rejectionReason}
        </Text>
      ) : null}
      <View style={[styles.row, { gap: spacing.sm, marginTop: spacing.sm }]}>
        <Button label={t('subscription.viewDetails')} variant="secondary" onPress={() => router.push(`/subscription/${record.id}`)} style={{ flex: 1 }} />
        <Button label={t('subscription.contactSupport')} onPress={() => router.push('/contact-us')} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

function ActiveCard({ record }: { record: SubscriptionRecord }) {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={[cardStyles.box, { backgroundColor: `${colors.success}14`, borderColor: colors.success, borderRadius: radius.lg, padding: spacing.md }]}>
      <View style={styles.row}>
        <Ionicons name="shield-checkmark" size={20} color={colors.success} />
        <Text variant="bodyLarge" weight="bold" style={{ color: colors.success, flex: 1 }}>{t('subscription.activeTitle')}</Text>
      </View>
      <View style={{ marginTop: spacing.sm, gap: 4 }}>
        <InfoLine label={t('subscription.pendingPlan')} value={record.planName} />
        {record.startDate ? <InfoLine label={t('subscription.activeSince')} value={formatDate(record.startDate)} /> : null}
        {record.expiryDate ? <InfoLine label={t('subscription.expiresOn')} value={formatDate(record.expiryDate)} /> : null}
      </View>
      <Text variant="caption" secondary style={{ marginTop: spacing.sm }}>{t('subscription.autoRenewNote')}</Text>
    </View>
  );
}

function ExpiredCard() {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={[cardStyles.box, { backgroundColor: `${colors.textSecondary}14`, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }]}>
      <View style={styles.row}>
        <Ionicons name="alert-circle-outline" size={20} color={colors.textSecondary} />
        <Text variant="bodyLarge" weight="bold" style={{ flex: 1 }}>{t('subscription.expiredTitle')}</Text>
      </View>
      <Text variant="bodySmall" secondary style={{ marginTop: spacing.xs }}>{t('subscription.expiredMessage')}</Text>
    </View>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text variant="caption" secondary style={{ width: 110 }}>{label}</Text>
      <Text variant="bodySmall" weight="semiBold" style={{ flex: 1, color: colors.textPrimary }}>{value}</Text>
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
  planCardWrap: { overflow: 'hidden' },
  planCard: { gap: 2 },
  planHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  planIconBox: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 10 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginBottom: 4 },
  currentPill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12 },
  subscribeBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 13 },
});

const cardStyles = StyleSheet.create({
  box: { borderWidth: 1 },
});
