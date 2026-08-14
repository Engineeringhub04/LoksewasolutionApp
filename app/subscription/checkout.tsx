// Subscription → Checkout. Reached from a plan card's "Subscribe Now".
//
// Three payment methods are always shown: eSewa, Khalti, QR (Manual).
//  - eSewa/Khalti render as live, tappable cards ONLY when their `enabled`
//    flag is true in app_subscription_settings/config; otherwise they're
//    dimmed with a "Coming Soon" badge and tapping shows a toast.
//  - QR (Manual) never has an on/off switch — it's always available.
// Selecting eSewa/Khalti shows a single "Continue to Payment Gateway"
// button that opens the provider's hosted checkout (wired to their official
// sandbox/test credentials — see paymentGateway.ts). Selecting QR opens the
// bank-transfer/QR form that was previously the only flow.
import React, { useState } from 'react';
import { View, StyleSheet, Image, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { useProfileStore } from '@/src/core/store/profileStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { showToast } from '@/src/core/store/toastStore';
import {
  fetchSubscriptionPlans,
  fetchSubscriptionSettings,
  submitPayment,
  validateCoupon,
  type PaymentMethod,
} from '@/src/core/firebase/services/subscription';
import { openEsewaCheckout, openKhaltiCheckout } from '@/src/core/media/paymentGateway';
import { downloadImageToDevice } from '@/src/core/media/imageDownload';
import * as ImagePicker from 'expo-image-picker';
import { uploadImageToCloudinary } from '@/src/core/media/cloudinary';
import * as Clipboard from 'expo-clipboard';
import { SubpageScrollScreen } from '@/src/components/nav/SubpageScrollScreen';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';
import { TextField } from '@/src/components/inputs/TextField';
import { Skeleton } from '@/src/components/feedback/Skeleton';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { ConfirmDialog } from '@/src/components/feedback/ConfirmDialog';

const ESEWA_LOGO = 'https://i.ibb.co/HLpHmnQz/esewa-icon-large.png';
const KHALTI_LOGO = 'https://i.ibb.co/tMHZRHKQ/Khalti-Logo-New-3.png';

const QR_DOWNLOAD_NAME = 'Ls-qr.png';

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
    return { plan, settings, bank: settings.manual };
  }, [planId]);

  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [transactionRef, setTransactionRef] = useState('');
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const [customerMessage, setCustomerMessage] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [couponApplied, setCouponApplied] = useState<{ code: string; discountedAmount: number; label: string } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [gatewayOpening, setGatewayOpening] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [qrLoaded, setQrLoaded] = useState(false);
  const [downloadingQr, setDownloadingQr] = useState(false);

  const plan = data?.plan ?? null;
  const settings = data?.settings ?? null;
  const bank = data?.bank ?? null;
  const finalAmount = couponApplied ? couponApplied.discountedAmount : (plan?.price ?? 0);

  const esewaReady = !!settings?.esewa.enabled;
  const khaltiReady = !!settings?.khalti.enabled;

  const handleApplyCoupon = async () => {
    if (!couponInput.trim() || !plan) return;
    setValidatingCoupon(true);
    setCouponError(null);
    try {
      const result = await validateCoupon(couponInput.trim(), plan.billingCycle, plan.price);
      if (!result.valid) {
        setCouponError(result.reason ?? t('subscription.couponInvalid'));
        return;
      }
      setCouponApplied({
        code: couponInput.trim().toUpperCase(),
        discountedAmount: result.discountedAmount ?? plan.price,
        label: result.discountLabel ?? '',
      });
      showToast(t('subscription.couponApplied'), 'success');
    } catch {
      setCouponError(t('subscription.couponInvalid'));
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handlePickScreenshot = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.7 });
    if (result.canceled || result.assets.length === 0) return;
    setScreenshotUri(result.assets[0].uri);
  };

  const handleDownloadQr = async () => {
    if (!bank?.qrImageUrl) {
      showToast('QR image is not configured yet.', 'info');
      return;
    }
    setDownloadingQr(true);
    try {
      const result = await downloadImageToDevice(bank.qrImageUrl, QR_DOWNLOAD_NAME);
      showToast(result.saved ? 'QR code saved' : 'Download cancelled', result.saved ? 'success' : 'info');
    } catch {
      showToast('Could not download the QR code.', 'error');
    } finally {
      setDownloadingQr(false);
    }
  };

  const handleCopyBankField = async (value: string) => {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    showToast('Copied', 'success');
  };

  const uploadScreenshot = async (): Promise<string | null> => {
    if (!screenshotUri) return null;
    setUploadingScreenshot(true);
    try {
      return await uploadImageToCloudinary(screenshotUri);
    } finally {
      setUploadingScreenshot(false);
    }
  };

  const handleSubmitManual = async () => {
    if (!user?.uid || !plan || !method) return;
    setShowConfirm(false);
    setSubmitting(true);
    try {
      const screenshotUrl = await uploadScreenshot();
      if (!screenshotUrl) {
        showToast(t('subscription.uploadScreenshot') + ' required', 'error');
        return;
      }
      await submitPayment({
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
        customerMessage: customerMessage.trim() || null,
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

  /** Opens the provider's hosted checkout. The user completes payment there, screenshots the receipt, then comes back and submits it like any manual payment — this app has no backend to receive a verified callback yet, so admin review is still the final step either way. */
  const handleOpenGateway = async () => {
    if (!user?.uid || !plan || !method || method === 'qr') return;
    setGatewayOpening(true);
    try {
      const redirectUrl = 'loksewasolutionapp://subscription';
      if (method === 'esewa') {
        await openEsewaCheckout({
          amount: finalAmount,
          successUrl: redirectUrl,
          failureUrl: redirectUrl,
          merchantCode: settings?.esewa.merchantCode,
          secretKey: settings?.esewa.secretKey,
        });
      } else if (method === 'khalti') {
        if (!settings?.khalti.secretKey) {
          showToast('Khalti sandbox key is not configured yet.', 'error');
          return;
        }
        await openKhaltiCheckout({
          amount: finalAmount,
          purchaseOrderName: plan.name,
          returnUrl: redirectUrl,
          websiteUrl: 'https://loksewasolution.app',
          customerName: profile?.name ?? user.displayName ?? null,
          customerEmail: profile?.email ?? user.email ?? null,
          secretKey: settings.khalti.secretKey,
        });
      }
      showToast('Complete the payment, then come back and submit your receipt below.', 'info');
    } catch {
      showToast('Could not open the payment gateway.', 'error');
    } finally {
      setGatewayOpening(false);
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
            <CouponSection
              couponInput={couponInput}
              onCouponInputChange={setCouponInput}
              couponApplied={couponApplied}
              couponError={couponError}
              validating={validatingCoupon}
              onApply={handleApplyCoupon}
              onRemove={() => { setCouponApplied(null); setCouponInput(''); setCouponError(null); }}
            />

            {/* Method picker */}
            <View style={{ gap: spacing.sm }}>
              <Text variant="bodySmall" weight="semiBold" secondary>{t('subscription.choosePaymentMethod')}</Text>
              <View style={{ gap: spacing.sm }}>
                <MethodCard
                  logo={ESEWA_LOGO}
                  label="eSewa"
                  color="#60BB46"
                  ready={esewaReady}
                  selected={method === 'esewa'}
                  onPress={() => (esewaReady ? setMethod('esewa') : showToast(t('subscription.comingSoonToast'), 'info'))}
                />
                <MethodCard
                  logo={KHALTI_LOGO}
                  label="Khalti"
                  color="#5C2D91"
                  ready={khaltiReady}
                  selected={method === 'khalti'}
                  onPress={() => (khaltiReady ? setMethod('khalti') : showToast(t('subscription.comingSoonToast'), 'info'))}
                />
                <MethodCard
                  icon="qr-code-outline"
                  label={t('subscription.qrMethodLabel')}
                  color="#0EA5E9"
                  ready
                  selected={method === 'qr'}
                  onPress={() => setMethod('qr')}
                />
              </View>
            </View>

            {method === 'esewa' || method === 'khalti' ? (
              <Animated.View entering={FadeInDown.duration(220)} style={{ gap: spacing.sm }}>
                <Button
                  label={t('subscription.continueToGateway')}
                  loading={gatewayOpening}
                  onPress={handleOpenGateway}
                  icon={<Ionicons name="open-outline" size={16} color="#FFF" style={{ marginRight: 6 }} />}
                />
                <Text variant="caption" secondary>{t('subscription.gatewayReturnHint')}</Text>

                <ReceiptSubmitForm
                  transactionRef={transactionRef}
                  onTransactionRefChange={setTransactionRef}
                  screenshotUri={screenshotUri}
                  onPickScreenshot={handlePickScreenshot}
                  uploadingScreenshot={uploadingScreenshot}
                  customerMessage={customerMessage}
                  onCustomerMessageChange={setCustomerMessage}
                  submitting={submitting}
                  canSubmit={transactionRef.trim().length > 0 && !!screenshotUri}
                  onSubmit={() => setShowConfirm(true)}
                />
              </Animated.View>
            ) : method === 'qr' ? (
              <Animated.View entering={FadeInDown.duration(220)} style={{ gap: spacing.md }}>
                <QrSection
                  bank={bank}
                  qrLoaded={qrLoaded}
                  onQrLoad={() => setQrLoaded(true)}
                  onDownload={handleDownloadQr}
                  downloading={downloadingQr}
                  onCopyField={handleCopyBankField}
                />

                <ReceiptSubmitForm
                  transactionRef={transactionRef}
                  onTransactionRefChange={setTransactionRef}
                  screenshotUri={screenshotUri}
                  onPickScreenshot={handlePickScreenshot}
                  uploadingScreenshot={uploadingScreenshot}
                  customerMessage={customerMessage}
                  onCustomerMessageChange={setCustomerMessage}
                  submitting={submitting}
                  canSubmit={transactionRef.trim().length > 0 && !!screenshotUri}
                  onSubmit={() => setShowConfirm(true)}
                />
              </Animated.View>
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

function MethodCard({
  logo,
  icon,
  label,
  color,
  ready,
  selected,
  onPress,
}: {
  logo?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  ready: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.methodRow,
        {
          borderColor: selected ? color : colors.border,
          borderRadius: radius.md,
          backgroundColor: selected ? `${color}12` : colors.surface,
          padding: spacing.md,
          opacity: ready ? 1 : 0.55,
        },
      ]}
    >
      {logo ? (
        <Image source={{ uri: logo }} style={styles.methodLogo} resizeMode="contain" />
      ) : (
        <View style={[styles.methodIconBox, { backgroundColor: `${color}17` }]}>
          <Ionicons name={icon!} size={20} color={color} />
        </View>
      )}
      <Text variant="bodyLarge" weight="semiBold" style={{ flex: 1, marginLeft: 12 }}>{label}</Text>
      {!ready ? (
        <View style={[styles.comingSoonBadge, { backgroundColor: colors.surfaceAlt }]}>
          <Text variant="caption" weight="bold" secondary>{t('subscription.comingSoon')}</Text>
        </View>
      ) : (
        <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? color : colors.textSecondary} />
      )}
    </Pressable>
  );
}

function CouponSection({
  couponInput,
  onCouponInputChange,
  couponApplied,
  couponError,
  validating,
  onApply,
  onRemove,
}: {
  couponInput: string;
  onCouponInputChange: (v: string) => void;
  couponApplied: { code: string; discountedAmount: number; label: string } | null;
  couponError: string | null;
  validating: boolean;
  onApply: () => void;
  onRemove: () => void;
}) {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="bodySmall" weight="medium" secondary>{t('subscription.couponCode')}</Text>
      <View style={styles.row}>
        <TextField
          containerStyle={{ flex: 1 }}
          placeholder={t('subscription.couponCodePlaceholder')}
          value={couponApplied ? couponApplied.code : couponInput}
          onChangeText={onCouponInputChange}
          autoCapitalize="characters"
          editable={!couponApplied}
        />
        {couponApplied ? (
          <Button label={t('subscription.removeCoupon')} variant="secondary" onPress={onRemove} fullWidth={false} />
        ) : (
          <Button label={t('subscription.applyCoupon')} variant="secondary" loading={validating} onPress={onApply} fullWidth={false} />
        )}
      </View>

      {couponApplied ? (
        <Animated.View
          entering={FadeIn.duration(250)}
          layout={LinearTransition.duration(250)}
          style={[styles.couponDropdown, { backgroundColor: `${colors.success}12`, borderColor: colors.success, borderRadius: radius.md, padding: spacing.sm }]}
        >
          <View style={styles.row}>
            <Ionicons name="pricetag" size={16} color={colors.success} />
            <Text variant="bodySmall" weight="bold" style={{ color: colors.success }}>{couponApplied.code} applied</Text>
          </View>
          <Text variant="caption" secondary style={{ marginTop: 2 }}>{couponApplied.label}</Text>
        </Animated.View>
      ) : couponError ? (
        <Animated.View entering={FadeIn.duration(200)}>
          <Text variant="caption" style={{ color: colors.error }}>{couponError}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

function QrSection({
  bank,
  qrLoaded,
  onQrLoad,
  onDownload,
  downloading,
  onCopyField,
}: {
  bank: import('@/src/core/firebase/services/subscription').BankDetails | null;
  qrLoaded: boolean;
  onQrLoad: () => void;
  onDownload: () => void;
  downloading: boolean;
  onCopyField: (value: string) => void;
}) {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();

  return (
    <>
      {bank?.qrImageUrl ? (
        <View style={[styles.qrBox, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }] }>
          <Text variant="bodyLarge" weight="bold">{t('subscription.scanQrTitle')}</Text>
          <Text variant="bodySmall" secondary style={{ marginTop: 4, marginBottom: spacing.sm }}>{t('subscription.scanQrHint')}</Text>
          <View style={styles.qrImageWrap}>
            {!qrLoaded ? <Skeleton width={220} height={220} radius={16} style={styles.qrSkeletonOverlay} /> : null}
            <Image
              source={{ uri: bank.qrImageUrl }}
              style={styles.qrImage}
              resizeMode="contain"
              onLoadEnd={onQrLoad}
            />
          </View>
          <Pressable onPress={onDownload} disabled={downloading} style={[styles.downloadRow, { borderColor: colors.primary }] }>
            <Ionicons name={downloading ? 'cloud-download' : 'download-outline'} size={16} color={colors.primary} />
            <Text variant="bodySmall" weight="semiBold" style={{ color: colors.primary }}>
              {downloading ? 'Downloading…' : 'Download QR'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {bank?.bankDetails ? (
        <View style={[styles.bankBox, { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md }] }>
          <Text variant="bodySmall" weight="bold" secondary style={{ marginBottom: spacing.xs }}>{t('subscription.bankDetails')}</Text>
          <Text variant="bodySmall" style={{ lineHeight: 22 }}>{bank.bankDetails}</Text>
          <Pressable onPress={() => onCopyField(bank.bankDetails)} hitSlop={8} style={[styles.copyDetailsRow, { borderColor: colors.primary }] }>
            <Ionicons name="copy-outline" size={16} color={colors.primary} />
            <Text variant="caption" weight="semiBold" style={{ color: colors.primary }}>Copy bank details</Text>
          </Pressable>
        </View>
      ) : null}

      {bank?.instructions ? (
        <View style={[styles.instructionsBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: spacing.lg }] }>
          <View style={styles.instructionsHeader}>
            <View style={[styles.instructionsIconRing, { backgroundColor: `${colors.primary}20` }] }>
              <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
            </View>
            <Text variant="bodyLarge" weight="bold">{t('subscription.instructions')}</Text>
          </View>
          <Text variant="bodySmall" secondary style={{ lineHeight: 22, marginTop: spacing.sm }}>{bank.instructions}</Text>
        </View>
      ) : null}
    </>
  );
}

function ReceiptSubmitForm({
  transactionRef,
  onTransactionRefChange,
  screenshotUri,
  onPickScreenshot,
  uploadingScreenshot,
  customerMessage,
  onCustomerMessageChange,
  submitting,
  canSubmit,
  onSubmit,
}: {
  transactionRef: string;
  onTransactionRefChange: (v: string) => void;
  screenshotUri: string | null;
  onPickScreenshot: () => void;
  uploadingScreenshot: boolean;
  customerMessage: string;
  onCustomerMessageChange: (v: string) => void;
  submitting: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
}) {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={{ gap: spacing.md }}>
      <TextField
        label={t('subscription.transactionRef')}
        helperText={t('subscription.transactionRefHint')}
        placeholder={t('subscription.transactionRefPlaceholder')}
        value={transactionRef}
        onChangeText={onTransactionRefChange}
        autoCapitalize="characters"
      />

      <View style={{ gap: spacing.xs }}>
        <View style={styles.row}>
          <Text variant="bodySmall" weight="medium" secondary>{t('subscription.uploadScreenshot')}</Text>
          <Text variant="caption" style={{ color: colors.error }}>*</Text>
        </View>
        <Text variant="caption" secondary>{t('subscription.uploadScreenshotHint')}</Text>
        {screenshotUri ? <Image source={{ uri: screenshotUri }} style={styles.screenshotPreview} resizeMode="cover" /> : null}
        <Button
          label={screenshotUri ? t('common.edit') : t('subscription.uploadScreenshot')}
          variant="secondary"
          onPress={onPickScreenshot}
          icon={<Ionicons name="image-outline" size={16} color={colors.primary} style={{ marginRight: 4 }} />}
        />
      </View>

      <TextField
        label={t('subscription.customMessageLabel')}
        placeholder={t('subscription.customMessagePlaceholder')}
        value={customerMessage}
        onChangeText={onCustomerMessageChange}
        multiline
        numberOfLines={3}
      />

      <Button label={t('subscription.submitPayment')} loading={submitting || uploadingScreenshot} disabled={!canSubmit} onPress={onSubmit} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summary: { borderWidth: StyleSheet.hairlineWidth, gap: 4 },
  methodRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5 },
  methodLogo: { width: 32, height: 32, borderRadius: 8 },
  methodIconBox: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  comingSoonBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  couponDropdown: { borderWidth: 1 },
  qrBox: { borderWidth: StyleSheet.hairlineWidth, alignItems: 'center' },
  qrImageWrap: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center' },
  qrSkeletonOverlay: { position: 'absolute' },
  qrImage: { width: 220, height: 220, borderRadius: 12 },
  downloadRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  bankBox: {},
  copyDetailsRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, marginTop: 12, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  instructionsBox: { overflow: 'hidden' },
  instructionsHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  instructionsIconRing: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  screenshotPreview: { width: '100%', height: 160, borderRadius: 12, marginTop: 4 },
});
