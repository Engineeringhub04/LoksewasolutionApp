// Profile → App Settings → Subscription Details.
//
// THE FEATURE MATRIX IS THE PAGE. The old version listed a handful of plain
// checkmarks per plan, which told a reader what a plan HAS but never what it
// LACKS — so there was no visible reason to move from Monthly to Yearly. Every
// card now renders the SAME ordered catalogue of everything the app ships, with
// each row marked included or not-in-this-plan. Comparing plans becomes reading
// down two columns of marks instead of diffing two different lists.
//
// WHERE "INCLUDED" COMES FROM: the plan document's own `features: string[]` in
// Firestore, never the billing cycle. Grouping, ordering and the Nepali wording
// come from the client catalogue (PLAN_FEATURE_GROUPS) because those are
// presentation. An admin can therefore hand-tune one plan in Firestore and this
// page follows without a release.
//
// Anything the plan lists that the catalogue does not know about still renders,
// in its own trailing group, so a hand-written feature can never silently
// vanish from a paying customer's card.
//
// THE FREE CARD NEVER SAYS "Currently Active". It is the floor every account
// stands on, so claiming it as the active plan is wrong the moment someone is
// actually paying — two cards would both read active and neither would tell you
// what you bought. It says "Your Free Services" always; "Currently Active"
// belongs to the one paid plan the user is really on.
//
// COLOUR NOTE: the plan crown is a fixed saturated gradient in both themes, so
// the ink on it is fixed too — this is the one place a literal colour is the
// CORRECT answer, because the surface underneath does not follow the theme. The
// card BODY is a normal themed surface, which is why the feature rows use tone
// colours and read correctly in light and dark.
import React, { useMemo } from 'react';
import { View, StyleSheet, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import {
  fetchSubscriptionPlans,
  fetchMySubscriptionHistory,
  expireIfPastDue,
  planFeatureLabel,
  PLAN_FEATURE_GROUPS,
  type SubscriptionPlan,
  type SubscriptionRecord,
  type SubscriptionStatus,
} from '@/src/core/firebase/services/subscription';
import { SubpageScrollScreen } from '@/src/components/nav/SubpageScrollScreen';
import { Text } from '@/src/components/misc/Text';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { Preloading } from '@/src/components/Preloading';
import { SectionCard, StatusPill, QuotePanel, useTones, type Tone } from '@/src/components/premium';

const ESEWA_LOGO = 'https://i.ibb.co/HLpHmnQz/esewa-icon-large.png';
const KHALTI_LOGO = 'https://i.ibb.co/tMHZRHKQ/Khalti-Logo-New-3.png';
const FONEPAY_LOGO = 'https://i.ibb.co/YBT7bXZQ/fonepay-logo-png-seeklogo-385625.png';

/** Ink for anything drawn ON a plan gradient — fixed, because the gradient is. */
const ON_GRADIENT = '#FFFFFF';
const ON_GRADIENT_SOFT = 'rgba(255,255,255,0.88)';
const ON_GRADIENT_FAINT = 'rgba(255,255,255,0.62)';

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

/** Gradient a plan falls back to when Firestore has no colours for it. */
function fallbackGradient(plan: SubscriptionPlan): [string, string] {
  if (plan.billingCycle === 'free') return ['#64748B', '#334155'];
  if (plan.billingCycle === 'yearly') return ['#0F766E', '#4338CA'];
  return ['#7C3AED', '#DB2777'];
}

function planGradient(plan: SubscriptionPlan): [string, string] {
  if (plan.billingCycle !== 'free' && plan.colorFrom && plan.colorTo) return [plan.colorFrom, plan.colorTo];
  return fallbackGradient(plan);
}

export default function SubscriptionScreen() {
  const { spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const { data, settled, refreshing, error, refetch, refresh } = useAsyncData(async () => {
    if (!user?.uid) return null;
    await expireIfPastDue(user.uid).catch(() => {});
    const [plans, history] = await Promise.all([
      fetchSubscriptionPlans(),
      fetchMySubscriptionHistory(user.uid),
    ]);
    return { plans, history };
  }, [user?.uid]);

  const plans = useMemo(() => data?.plans ?? [], [data]);
  const history = useMemo(() => data?.history ?? [], [data]);
  const activeRecord = history.find((r) => r.status === 'active') ?? null;
  const pendingCount = history.filter((r) => r.status === 'pending').length;

  /**
   * Yearly's discount against paying monthly for twelve months. Computed from
   * the two live plans rather than stored, so it can never contradict the
   * prices printed right beside it.
   */
  const yearlySavePercent = useMemo(() => {
    const monthly = plans.find((p) => p.billingCycle === 'monthly');
    const yearly = plans.find((p) => p.billingCycle === 'yearly');
    if (!monthly?.price || !yearly?.price) return null;
    const twelve = monthly.price * 12;
    if (twelve <= yearly.price) return null;
    return Math.round(((twelve - yearly.price) / twelve) * 100);
  }, [plans]);

  return (
    <SubpageScrollScreen title={t('subscription.title')} refreshing={refreshing} onRefresh={refresh}>
      {!settled ? (
        <View style={{ flex: 1 }}>
          <Preloading tinted={false} label={t('subscription.loading')} hint={t('loadHints.purchases')} />
        </View>
      ) : error ? (
        <DataNotFound onRetry={refetch} />
      ) : (
        <>
          <PlanStatusHero record={activeRecord} pendingCount={pendingCount} />

          {history.length > 0 ? (
            <SectionCard
              icon="receipt-outline"
              title={t('subscription.yourRequests')}
              subtitle={t('subscription.yourRequestsHint')}
              tone="info"
              flush
            >
              <View style={{ paddingHorizontal: spacing.sm, paddingBottom: spacing.xs }}>
                {history.map((record, index) => (
                  <RequestRow
                    key={record.id}
                    record={record}
                    divider={index < history.length - 1}
                    onPress={() => router.push(`/subscription/${record.id}`)}
                  />
                ))}
              </View>
            </SectionCard>
          ) : null}

          <View style={{ gap: 4, marginTop: spacing.xs }}>
            <Text variant="h3" weight="bold">{t('subscription.choosePlan')}</Text>
            <Text variant="bodySmall" secondary>{t('subscription.choosePlanHint')}</Text>
          </View>

          <View style={{ gap: spacing.lg }}>
            {plans.map((plan, index) => (
              <Animated.View key={plan.id} entering={FadeInDown.delay(index * 110).duration(430)}>
                <PlanCard
                  plan={plan}
                  isCurrent={!!activeRecord && activeRecord.planId === plan.id}
                  savePercent={plan.billingCycle === 'yearly' ? yearlySavePercent : null}
                  onSubscribe={() => router.push({ pathname: '/subscription/checkout', params: { planId: plan.id } })}
                />
              </Animated.View>
            ))}
          </View>

          <WeAcceptSection />
        </>
      )}
    </SubpageScrollScreen>
  );
}

// ===================== Status hero =====================

function PlanStatusHero({ record, pendingCount }: { record: SubscriptionRecord | null; pendingCount: number }) {
  const { spacing, radius } = useTheme();
  const { t } = useTranslation();

  const premium = !!record;
  const gradient: [string, string, string] = premium
    ? ['#0F766E', '#1D4ED8', '#4338CA']
    : ['#1E293B', '#334155', '#475569'];

  const daysLeft = record?.expiryDate ? daysUntil(record.expiryDate) : null;

  return (
    <View style={[styles.heroWrap, { borderRadius: radius.lg }]}>
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: spacing.lg }}>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.glassEdge, { borderRadius: radius.lg }]} />

        <View style={styles.heroTopRow}>
          <View style={[styles.heroMedallion, styles.onGradientChip]}>
            <Ionicons name={premium ? 'diamond' : 'gift-outline'} size={22} color={ON_GRADIENT} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="overline" weight="bold" style={{ color: ON_GRADIENT_FAINT }}>
              {t('subscription.yourPlan')}
            </Text>
            <Text variant="h3" weight="bold" style={{ color: ON_GRADIENT }} numberOfLines={1}>
              {record ? record.planName : t('subscription.freePlan')}
            </Text>
          </View>
        </View>

        <View style={[styles.heroPillRow, { marginTop: spacing.md }]}>
          {record?.expiryDate ? (
            <>
              <GradientChip icon="calendar-outline" label={`${t('subscription.planActiveUntil')} · ${formatDate(record.expiryDate)}`} />
              {daysLeft !== null ? (
                <GradientChip
                  icon="hourglass-outline"
                  label={daysLeft <= 1 ? t('subscription.lastDay') : t('subscription.daysLeft', { count: daysLeft })}
                  urgent={daysLeft <= 7}
                />
              ) : null}
            </>
          ) : (
            <GradientChip icon="sparkles-outline" label={t('subscription.upgradeHint')} />
          )}
          {pendingCount > 0 ? (
            <GradientChip icon="time-outline" label={`${t('subscription.pendingReview')} · ${pendingCount}`} urgent />
          ) : null}
        </View>
      </LinearGradient>
    </View>
  );
}

function GradientChip({ icon, label, urgent }: { icon: keyof typeof Ionicons.glyphMap; label: string; urgent?: boolean }) {
  return (
    <View style={[styles.gradientChip, urgent ? styles.gradientChipUrgent : styles.onGradientChip]}>
      <Ionicons name={icon} size={12} color={urgent ? '#7C2D12' : ON_GRADIENT} />
      <Text variant="caption" weight="semiBold" style={{ color: urgent ? '#7C2D12' : ON_GRADIENT, flexShrink: 1 }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

// ===================== Request history row =====================

function RequestRow({ record, divider, onPress }: { record: SubscriptionRecord; divider: boolean; onPress: () => void }) {
  const { colors, spacing, radius } = useTheme();
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

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: pressed ? tone.bg : 'transparent',
          borderRadius: radius.md,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.xs,
          borderBottomWidth: divider ? StyleSheet.hairlineWidth : 0,
          borderBottomColor: colors.divider,
        },
      ]}
    >
      <View style={styles.requestRow}>
        <View style={[styles.requestIcon, { backgroundColor: tone.bg, borderColor: tone.border, borderRadius: radius.md }]}>
          <Ionicons name={statusIcon(record.status)} size={18} color={tone.fg} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="body" weight="bold" numberOfLines={1}>{record.planName}</Text>
          <Text variant="caption" secondary numberOfLines={1}>
            Rs. {record.amount} · {record.method.toUpperCase()}{record.submittedAt ? ` · ${formatDate(record.submittedAt)}` : ''}
          </Text>
          <StatusPill label={label} tone={statusTone(record.status)} size="sm" />
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textDisabled} />
      </View>

      {record.status === 'rejected' && record.rejectionReason ? (
        <QuotePanel tone="danger" icon="alert-circle-outline" style={{ marginTop: spacing.sm }}>
          <Text variant="bodySmall">{record.rejectionReason}</Text>
        </QuotePanel>
      ) : null}
    </Pressable>
  );
}

// ===================== Feature matrix =====================

interface MatrixRow {
  id: string;
  label: string;
  included: boolean;
}

interface MatrixGroup {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  rows: MatrixRow[];
  includedCount: number;
}

/**
 * Builds the grouped matrix for one plan.
 *
 * The catalogue supplies structure and order; the plan's stored `features`
 * supply truth. Anything stored that the catalogue does not recognise is kept
 * in a trailing "extras" group — dropping it would silently hide a feature an
 * admin deliberately typed onto a paid plan.
 */
function usePlanMatrix(planFeatures: string[], language: string): { groups: MatrixGroup[]; included: number; total: number } {
  return useMemo(() => {
    const owned = new Set(planFeatures ?? []);
    const known = new Set<string>();

    const groups: MatrixGroup[] = PLAN_FEATURE_GROUPS.map((group) => {
      const rows = group.features.map((feature) => {
        known.add(feature.id);
        return {
          id: feature.id,
          label: planFeatureLabel(feature.id, language),
          included: owned.has(feature.id),
        };
      });
      return {
        key: group.key,
        icon: group.icon as keyof typeof Ionicons.glyphMap,
        title: language === 'ne' ? group.titleNe : group.titleEn,
        rows,
        includedCount: rows.filter((row) => row.included).length,
      };
    });

    const extras = (planFeatures ?? []).filter((feature) => !known.has(feature));
    if (extras.length > 0) {
      groups.push({
        key: 'extras',
        icon: 'add-circle-outline',
        title: language === 'ne' ? 'थप सुविधा' : 'Also included',
        rows: extras.map((feature) => ({ id: feature, label: feature, included: true })),
        includedCount: extras.length,
      });
    }

    const total = groups.reduce((sum, group) => sum + group.rows.length, 0);
    const included = groups.reduce((sum, group) => sum + group.includedCount, 0);
    return { groups, included, total };
  }, [planFeatures, language]);
}

function FeatureRow({ row }: { row: MatrixRow }) {
  const { colors } = useTheme();
  const tones = useTones();
  const tone = row.included ? tones.success : tones.neutral;

  return (
    <View style={styles.featureRow}>
      <View
        style={[
          styles.featureMark,
          {
            backgroundColor: row.included ? tone.bg : 'transparent',
            borderColor: row.included ? tone.border : colors.border,
          },
        ]}
      >
        <Ionicons
          name={row.included ? 'checkmark-sharp' : 'close-sharp'}
          size={14}
          color={row.included ? tone.fg : colors.textDisabled}
        />
      </View>
      {/* Excluded rows stay fully legible — dimmed, never struck through. A
          strike-through reads as "removed", but these features are simply on a
          different plan and the reader is deciding whether to buy them. */}
      <Text
        variant="body"
        weight={row.included ? 'medium' : 'regular'}
        style={{ flex: 1, color: row.included ? colors.textPrimary : colors.textDisabled }}
      >
        {row.label}
      </Text>
    </View>
  );
}

function FeatureGroupBlock({ group }: { group: MatrixGroup }) {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const tones = useTones();
  const complete = group.includedCount === group.rows.length;
  const tone = complete ? tones.success : tones.neutral;

  return (
    <View style={{ gap: spacing.xs }}>
      <View style={styles.groupHeader}>
        <View style={[styles.groupIcon, { backgroundColor: tone.bg, borderColor: tone.border, borderRadius: radius.sm }]}>
          <Ionicons name={group.icon} size={13} color={tone.fg} />
        </View>
        <Text variant="overline" weight="bold" style={{ flex: 1, color: colors.textSecondary }} numberOfLines={1}>
          {group.title}
        </Text>
        <Text variant="caption" weight="bold" style={{ color: tone.fg }}>
          {t('subscription.featureGroupCount', { included: group.includedCount, total: group.rows.length })}
        </Text>
      </View>
      <View style={{ gap: 2 }}>
        {group.rows.map((row) => (
          <FeatureRow key={row.id} row={row} />
        ))}
      </View>
    </View>
  );
}

// ===================== Plan card =====================

function PlanCard({
  plan,
  isCurrent,
  savePercent,
  onSubscribe,
}: {
  plan: SubscriptionPlan;
  isCurrent: boolean;
  savePercent: number | null;
  onSubscribe: () => void;
}) {
  const { colors, spacing, radius, elevation } = useTheme();
  const { t, language } = useTranslation();
  const isFree = plan.billingCycle === 'free';
  const isYearly = plan.billingCycle === 'yearly';
  const gradient = planGradient(plan);
  const { groups, included, total } = usePlanMatrix(plan.features, language);

  const priceSuffix = plan.billingCycle === 'monthly'
    ? t('subscription.perMonth')
    : isYearly
      ? t('subscription.perYear')
      : '';

  return (
    <View
      style={[
        styles.planCard,
        elevation[2],
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          // The active plan wears the theme's primary ring; everyone else gets a
          // hairline in their own gradient colour, so the cards stay visually
          // distinct without three competing border weights.
          borderWidth: isCurrent ? 2 : StyleSheet.hairlineWidth,
          borderColor: isCurrent ? colors.primary : colors.border,
        },
      ]}
    >
      {/* ===== Crown: fixed gradient, fixed ink ===== */}
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: spacing.lg }}>
        <View style={styles.crownTopRow}>
          <View style={[styles.planIconBox, styles.onGradientChip]}>
            <Ionicons name={isFree ? 'gift-outline' : isYearly ? 'diamond' : 'flash'} size={20} color={ON_GRADIENT} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="h3" weight="bold" style={{ color: ON_GRADIENT }} numberOfLines={1}>{plan.name}</Text>
            <Text variant="caption" style={{ color: ON_GRADIENT_FAINT }}>
              {t('subscription.featureCount', { included, total })}
            </Text>
          </View>
          {isYearly ? (
            <View style={[styles.crownBadge, styles.onGradientChip]}>
              <Ionicons name="star" size={10} color={ON_GRADIENT} />
              <Text variant="overline" weight="bold" style={{ color: ON_GRADIENT }}>{t('subscription.bestValue')}</Text>
            </View>
          ) : !isFree ? (
            <View style={[styles.crownBadge, styles.onGradientChip]}>
              <Ionicons name="flame" size={10} color={ON_GRADIENT} />
              <Text variant="overline" weight="bold" style={{ color: ON_GRADIENT }}>{t('subscription.mostPopular')}</Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.priceRow, { marginTop: spacing.md }]}>
          <Text variant="display" weight="bold" style={{ color: ON_GRADIENT }}>
            {isFree ? t('subscription.free') : `Rs. ${plan.price}`}
          </Text>
          {priceSuffix ? (
            <Text variant="body" style={{ color: ON_GRADIENT_SOFT, marginBottom: 5 }}>{priceSuffix}</Text>
          ) : null}
          {savePercent ? (
            <View style={[styles.saveChip, { marginBottom: 6 }]}>
              <Text variant="caption" weight="bold" style={{ color: '#7C2D12' }}>
                {t('subscription.savePercent', { percent: savePercent })}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Progress of the matrix, drawn on the crown: the bar is the fastest
            read of "how much of the app does this plan open". */}
        <View style={[styles.meterTrack, { marginTop: spacing.md }]}>
          <View style={[styles.meterFill, { width: `${total > 0 ? Math.round((included / total) * 100) : 0}%` }]} />
        </View>
      </LinearGradient>

      {/* ===== Body: themed surface, tone-coloured marks ===== */}
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        {groups.map((group) => (
          <FeatureGroupBlock key={group.key} group={group} />
        ))}

        {/* Three states, and the free card is deliberately NOT one of them.
            "Currently Active" answers "which plan am I paying for?", so it can
            only ever sit on one card. The free tier is not a plan you are on —
            it is the floor under every account, premium or not — so it always
            reads "Your Free Services" and never competes for that answer. */}
        {isFree ? (
          <View style={[styles.statePill, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, borderRadius: radius.md }]}>
            <Ionicons name="gift-outline" size={17} color={colors.textSecondary} />
            <Text variant="bodySmall" weight="semiBold" secondary>{t('subscription.freeServices')}</Text>
          </View>
        ) : isCurrent ? (
          <ActivePlanPill />
        ) : (
          <SubscribeButton gradient={gradient} label={t('subscription.subscribeNow')} onPress={onSubscribe} />
        )}
      </View>
    </View>
  );
}

/** The one card the user is actually paying for. Only ever renders on a paid plan. */
function ActivePlanPill() {
  const { radius } = useTheme();
  const { t } = useTranslation();
  const tones = useTones();
  return (
    <View style={[styles.statePill, { backgroundColor: tones.success.bg, borderColor: tones.success.border, borderRadius: radius.md }]}>
      <Ionicons name="checkmark-circle" size={18} color={tones.success.fg} />
      <Text variant="bodySmall" weight="bold" style={{ color: tones.success.fg }}>{t('subscription.currentlyActive')}</Text>
    </View>
  );
}

/**
 * The CTA carries the plan's own gradient, so the button a reader presses is
 * visibly the same object as the crown they just read. The press spring is on
 * the UI thread — no JS work per frame.
 */
function SubscribeButton({ gradient, label, onPress }: { gradient: [string, string]; label: string; onPress: () => void }) {
  const { radius } = useTheme();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 18, stiffness: 320 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 16, stiffness: 260 }); }}
        accessibilityRole="button"
      >
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.subscribeBtn, { borderRadius: radius.md }]}
        >
          <Ionicons name="diamond-outline" size={17} color={ON_GRADIENT} style={{ marginRight: 7 }} />
          <Text variant="bodyLarge" weight="bold" style={{ color: ON_GRADIENT }}>{label}</Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

// ===================== We Accept =====================

function WeAcceptSection() {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  return (
    <SectionCard icon="card-outline" title={t('subscription.weAccept')} tone="success">
      <View style={[styles.weAcceptLogos, { gap: spacing.sm }]}>
        {[ESEWA_LOGO, KHALTI_LOGO, FONEPAY_LOGO].map((uri) => (
          // A fixed light chip per logo: these are brand marks drawn for a light
          // background, so they must not sit directly on a themed surface.
          <View key={uri} style={[styles.logoChip, { borderRadius: radius.md, borderColor: colors.border }]}>
            <Image source={{ uri }} style={styles.weAcceptLogo} resizeMode="contain" />
          </View>
        ))}
      </View>
    </SectionCard>
  );
}

// ===================== helpers =====================

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysUntil(iso: string): number | null {
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return null;
  return Math.max(0, Math.ceil((target - Date.now()) / (24 * 60 * 60 * 1000)));
}

const styles = StyleSheet.create({
  // Hero
  heroWrap: { overflow: 'hidden', shadowColor: '#0F172A', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroMedallion: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  heroPillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gradientChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, maxWidth: '100%' },
  gradientChipUrgent: { backgroundColor: '#FBBF24' },
  onGradientChip: { backgroundColor: 'rgba(255,255,255,0.20)' },
  glassEdge: { borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.22)' },

  // Requests
  requestRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  requestIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },

  // Plan card
  planCard: { overflow: 'hidden' },
  crownTopRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  planIconBox: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  crownBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 7, flexWrap: 'wrap' },
  saveChip: { backgroundColor: '#FBBF24', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  meterTrack: { height: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.22)', overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 999, backgroundColor: ON_GRADIENT },

  // Feature matrix
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  groupIcon: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  featureMark: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },

  statePill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 13, borderWidth: StyleSheet.hairlineWidth },
  subscribeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },

  // We accept
  weAcceptLogos: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  logoChip: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth },
  weAcceptLogo: { width: 56, height: 30 },
});
