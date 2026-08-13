// Subscription → Checkout. Reached from a plan card's "Subscribe Now".
//
// Renders the method picker (eSewa / Khalti / Fonepay) and, depending on
// `subscriptionSettings.activeMode`:
//  - 'manual' → QR + bank details + instructions + reference/coupon form,
//               submitted for admin review (status: 'pending').
//  - 'auto'   → placeholder for the real eSewa/Khalti SDK flow. Wired up to
//               the same recordAutoPaymentSuccess() call the real gateway
//               callback will use once a verified merchant account exists —
//               see subscription.ts header comment for why this isn't live
//               yet.
import React, { useState } from 'react';
import { View, StyleSheet, Image, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
  submitManualPayment,
  recordAutoPaymentSuccess,
  validateCoupon,
  type PaymentMethod,
} from '@/src/core/firebase/services/subscription';
import * as ImagePicker from 'expo-image-picker';
import { uploadImageToCloudinary } from '@/src/core/media/cloudinary';
import { SubpageScrollScreen } from '@/src/components/nav/SubpageScrollScreen';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';
import { TextField } from '@/src/components/inputs/TextField';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { ConfirmDialog } from '@/src/components/feedback/ConfirmDialog';

const METHODS: { key: PaymentMethod; label: string; color: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'esewa', label: 'eSewa', color: '#60BB46', icon: 'phone-portrait-outline' },
  { key: 'khalti', label: 'Khalti', color: '#5C2D91', icon: 'wallet-outline' },
  { key: 'fonepay', label: 'Fonepay / Bank', color: '#EE3237', icon: 'qr-code-outline' },
];

export default function CheckoutScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { profile } = useProfileStore();

  const { data, loading, error, refetch } = useAsyncData(async () => {
    const [plans, settings] = await Promise.all([fetchSubscriptionPlans(), fetchSubscriptionSettings()]);
    const plan = plans.find((p) => p.id === planId) ?? null;
    return { plan, settings };
  }, [planId]);

  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [transactionRef, setTransactionRef] = useState('');
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [couponApplied, setCouponApplied] = useState<{ code: string; discountedAmount: number } | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const plan = data?.plan ?? null;
  const settings = data?.settings ?? null;
  const isAutoMode = settings?.activeMode === 'auto';
  const finalAmount = couponApplied ? couponApplied.discountedAmount : (plan?.price ?? 0);

  const handleApplyCoupon = async () => {
    if (!couponInput.trim() || !plan) return;
    setValidatingCoupon(true);
    try {
      const result = await validateCoupon(couponInput.trim(), plan.billingCycle, plan.price);
      if (!result.valid) {
        showToast(result.reason ?? t('subscription.couponInvalid'), 'error');
        return;
      }
      setCouponApplied({ code: couponInput.trim().toUpperCase(), discountedAmount: result.discountedAmount ?? plan.price });
      showToast(t('subscription.couponApplied'), 'success');
    } catch {
      showToast(t('subscription.couponInvalid'), 'error');
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handlePickScreenshot = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.7,
    });
    if (result.canceled || result.assets.length === 0) return;
    setScreenshotUri(result.assets[0].uri);
  };

  const handleSubmitManual = async () => {
    if (!user?.uid || !plan || !method) return;
    setShowConfirm(false);
    setSubmitting(true);
    try {
      let screenshotUrl: string | null = null;
      if (screenshotUri) {
        setUploadingScreenshot(true);
        screenshotUrl = await uploadImageToCloudinary(screenshotUri).catch(() => null);
        setUploadingScreenshot(false);
      }
      await submitManualPayment({
        uid: user.uid,
        userName: profile?.name ?? user.displayName ?? null,
        userEmail: profile?.email ?? user.email ?? null,
        planId: plan.id,
        planName: plan.name,
        billingCycle: plan.billingCycle,
        amount: finalAmount,
        method,
        transactionRef: transactionRef.trim(),
        screenshotUrl,
        couponCode: couponApplied?.code ?? null,
      });
      showToast(t('subscription.submitSuccess'), 'success');
      router.replace('/subscription');
    } catch {
      showToast(t('subscription.submitError'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Placeholder for the real eSewa/Khalti SDK flow. Once a verified merchant
   * account exists, this is where the provider's checkout would open and its
   * signed success callback would report the payment. Even then it still
   * lands as 'pending' (see recordAutoPaymentSuccess()'s doc comment) — no
   * client write path can set a subscription to 'active' directly, by
   * design, so this can never be used to self-activate premium for free.
   */
  const handleAutoPay = async () => {
    if (!user?.uid || !plan || !method || method === 'fonepay') return;
    setSubmitting(true);
    try {
      showToast('Connecting to ' + (method === 'esewa' ? 'eSewa' : 'Khalti') + '...', 'info');
      // Real integration point: launch provider SDK here and await its result
      // instead of this placeholder recordAutoPaymentSuccess() call.
      await recordAutoPaymentSuccess({
        uid: user.uid,
        userName: profile?.name ?? user.displayName ?? null,
        userEmail: profile?.email ?? user.email ?? null,
        planId: plan.id,
        planName: plan.name,
        billingCycle: plan.billingCycle,
        amount: finalAmount,
        method,
        transactionRef: `AUTO-${Date.now()}`,
        couponCode: couponApplied?.code ?? null,
      });
      showToast(t('subscription.submitSuccess'), 'success');
      router.replace('/subscription');
    } catch {
      showToast(t('subscription.submitError'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!loading && (error || !plan)) {
    return (
      <SubpageScrollScreen title={t('subscription.title')}>
        <DataNotFound onRetry={refetch} />
      </SubpageScrollScreen>
    );
  }

  return (
    <>
      <SubpageScrollScreen title={plan?.name ?? t('subscription.title')}>
        {loading || !plan ? null : (
          <>
            {/* Plan summary */}
            <View style={[styles.summary, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }]}>
              <View style={styles.row}>
                <Text variant="bodyLarge" weight="bold" style={{ flex: 1 }}>{plan.name}</Text>
                <Text variant="h3" weight="bold" style={{ color: colors.primary }}>Rs. {finalAmount}</Text>
              </View>
              {couponApplied ? (
                <Text variant="caption" secondary style={{ textDecorationLine: 'line-through' }}>Rs. {plan.price}</Text>
              ) : null}
            </View>

            {/* Coupon */}
            <View style={{ gap: spacing.xs }}>
              <Text variant="bodySmall" weight="medium" secondary>{t('subscription.couponCode')}</Text>
              <View style={styles.row}>
                <TextField
                  containerStyle={{ flex: 1 }}
                  placeholder={t('subscription.couponCodePlaceholder')}
                  value={couponApplied ? couponApplied.code : couponInput}
                  onChangeText={setCouponInput}
                  autoCapitalize="characters"
                  editable={!couponApplied}
                />
                {couponApplied ? (
                  <Button label={t('subscription.removeCoupon')} variant="secondary" onPress={() => { setCouponApplied(null); setCouponInput(''); }} fullWidth={false} />
                ) : (
                  <Button label={t('subscription.applyCoupon')} variant="secondary" loading={validatingCoupon} onPress={handleApplyCoupon} fullWidth={false} />
                )}
              </View>
            </View>

            {/* Method picker */}
            <View style={{ gap: spacing.sm }}>
              <Text variant="bodySmall" weight="semiBold" secondary>{t('subscription.choosePaymentMethod')}</Text>
              <View style={{ gap: spacing.sm }}>
                {METHODS.map((m) => (
                  <Pressable
                    key={m.key}
                    onPress={() => setMethod(m.key)}
                    style={[
                      styles.methodRow,
                      {
                        borderColor: method === m.key ? m.color : colors.border,
                        borderRadius: radius.md,
                        backgroundColor: method === m.key ? `${m.color}12` : colors.surface,
                        padding: spacing.md,
                      },
                    ]}
                  >
                    <Ionicons name={m.icon} size={22} color={m.color} />
                    <Text variant="bodyLarge" weight="semiBold" style={{ flex: 1, marginLeft: spacing.sm }}>{m.label}</Text>
                    <Ionicons
                      name={method === m.key ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={method === m.key ? m.color : colors.textSecondary}
                    />
                  </Pressable>
                ))}
              </View>
            </View>

            {method ? (
              isAutoMode && method !== 'fonepay' ? (
                <AutoPaySection method={method} submitting={submitting} onPay={handleAutoPay} />
              ) : (
                <ManualPaySection
                  settings={settings}
                  transactionRef={transactionRef}
                  onTransactionRefChange={setTransactionRef}
                  screenshotUri={screenshotUri}
                  onPickScreenshot={handlePickScreenshot}
                  uploadingScreenshot={uploadingScreenshot}
                  submitting={submitting}
                  canSubmit={transactionRef.trim().length > 0}
                  onSubmit={() => setShowConfirm(true)}
                />
              )
            ) : null}
          </>
        )}
      </SubpageScrollScreen>
      <PageLoaderOverlay visible={loading} label={t('subscription.loading')} />

      <ConfirmDialog
        visible={showConfirm}
        title={t('subscription.submitPayment')}
        message={t('subscription.submitPaymentConfirm')}
        onConfirm={handleSubmitManual}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}

function AutoPaySection({
  method,
  submitting,
  onPay,
}: {
  method: PaymentMethod;
  submitting: boolean;
  onPay: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={{ gap: 8 }}>
      <Button
        label={method === 'esewa' ? t('subscription.payWithEsewa') : t('subscription.payWithKhalti')}
        loading={submitting}
        onPress={onPay}
      />
    </View>
  );
}

function ManualPaySection({
  settings,
  transactionRef,
  onTransactionRefChange,
  screenshotUri,
  onPickScreenshot,
  uploadingScreenshot,
  submitting,
  canSubmit,
  onSubmit,
}: {
  settings: import('@/src/core/firebase/services/subscription').SubscriptionSettings | null;
  transactionRef: string;
  onTransactionRefChange: (v: string) => void;
  screenshotUri: string | null;
  onPickScreenshot: () => void;
  uploadingScreenshot: boolean;
  submitting: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
}) {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const manual = settings?.manual;

  return (
    <View style={{ gap: spacing.md }}>
      {manual?.qrImageUrl ? (
        <View style={[styles.qrBox, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }]}>
          <Text variant="bodyLarge" weight="bold">{t('subscription.scanQrTitle')}</Text>
          <Text variant="bodySmall" secondary style={{ marginTop: 4, marginBottom: spacing.sm }}>{t('subscription.scanQrHint')}</Text>
          <Image source={{ uri: manual.qrImageUrl }} style={styles.qrImage} resizeMode="contain" />
        </View>
      ) : null}

      {manual?.bankDetails ? (
        <View style={[styles.infoBox, { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md }]}>
          <Text variant="bodySmall" weight="bold" secondary>{t('subscription.bankDetails')}</Text>
          <Text variant="bodySmall" style={{ marginTop: 4 }}>{manual.bankDetails}</Text>
        </View>
      ) : null}

      {manual?.instructions ? (
        <View style={[styles.infoBox, { backgroundColor: `${colors.info}10`, borderRadius: radius.md, padding: spacing.md }]}>
          <View style={styles.row}>
            <Ionicons name="information-circle-outline" size={16} color={colors.info} />
            <Text variant="bodySmall" weight="bold" style={{ color: colors.info }}>{t('subscription.instructions')}</Text>
          </View>
          <Text variant="bodySmall" secondary style={{ marginTop: 4 }}>{manual.instructions}</Text>
        </View>
      ) : null}

      <TextField
        label={t('subscription.transactionRef')}
        helperText={t('subscription.transactionRefHint')}
        placeholder={t('subscription.transactionRefPlaceholder')}
        value={transactionRef}
        onChangeText={onTransactionRefChange}
        autoCapitalize="characters"
      />

      <View style={{ gap: spacing.xs }}>
        <Text variant="bodySmall" weight="medium" secondary>{t('subscription.uploadScreenshot')}</Text>
        <Text variant="caption" secondary>{t('subscription.uploadScreenshotHint')}</Text>
        {screenshotUri ? (
          <Image source={{ uri: screenshotUri }} style={styles.screenshotPreview} resizeMode="cover" />
        ) : null}
        <Button
          label={screenshotUri ? t('common.edit') : t('subscription.uploadScreenshot')}
          variant="secondary"
          onPress={onPickScreenshot}
          icon={<Ionicons name="image-outline" size={16} color={colors.primary} style={{ marginRight: 4 }} />}
        />
      </View>

      <Button
        label={t('subscription.submitPayment')}
        loading={submitting || uploadingScreenshot}
        disabled={!canSubmit}
        onPress={onSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summary: { borderWidth: StyleSheet.hairlineWidth, gap: 4 },
  methodRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5 },
  qrBox: { borderWidth: StyleSheet.hairlineWidth, alignItems: 'center' },
  qrImage: { width: 220, height: 220, borderRadius: 12 },
  infoBox: {},
  screenshotPreview: { width: '100%', height: 160, borderRadius: 12, marginTop: 4 },
});
