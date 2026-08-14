// Subscription → Checkout. Reached from a plan card's "Subscribe Now".
//
// Three payment methods are always shown: eSewa, Khalti, QR (Manual).
//  - eSewa/Khalti availability is independently controlled by the existing
//    app_subscription_settings/config enabled flags; false shows Coming Soon.
//  - QR (Manual) never has an on/off switch — it is the zero-budget fallback.
// Selecting eSewa/Khalti shows only a gateway action. Manual receipt fields are
// rendered for QR only. Provider secrets are never fetched by this screen.
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Image, Pressable, Modal } from 'react-native';
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
import { fetchExamSet } from '@/src/core/firebase/services/examHub';
import { submitExamPurchase } from '@/src/core/firebase/services/examPurchases';
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
import { WebView } from 'react-native-webview';

const ESEWA_LOGO = 'https://i.ibb.co/HLpHmnQz/esewa-icon-large.png';
const KHALTI_LOGO = 'https://i.ibb.co/tMHZRHKQ/Khalti-Logo-New-3.png';

const QR_DOWNLOAD_NAME = 'Ls-qr.png';
const PAYMENT_RETURN_URL = 'https://loksewasolution.app/payment-return';

export default function CheckoutScreen() {
  const { planId, examId } = useLocalSearchParams<{ planId?: string; examId?: string }>();
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const authInitializing = useAuthStore((s) => s.initializing);
  const { profile, courseInfo } = useProfileStore();

  const isExamPurchase = !!examId;
  const { data, loading, error, refetch } = useAsyncData(async () => {
    const [plans, settings, exam] = await Promise.all([
      fetchSubscriptionPlans(),
      fetchSubscriptionSettings(),
      examId ? fetchExamSet(examId) : Promise.resolve(null),
    ]);
    const plan = plans.find((p) => p.id === planId) ?? null;
    return { plan, exam, settings, bank: settings.manual };
  }, [planId, examId, user?.uid, authInitializing], {
    // Firestore config reads are authenticated. Waiting for session hydration is
    // essential because the hook otherwise caches an empty fallback forever.
    enabled: !authInitializing && !!user?.uid,
  });

  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [transactionRef, setTransactionRef] = useState('');
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);
  const [imageScale, setImageScale] = useState(1);
  const [customerMessage, setCustomerMessage] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [couponApplied, setCouponApplied] = useState<{ code: string; discountedAmount: number; label: string } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [gatewayHtml, setGatewayHtml] = useState<string | null>(null);
  const [gatewayUrl, setGatewayUrl] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [qrLoaded, setQrLoaded] = useState(false);

  const [downloadingQr, setDownloadingQr] = useState(false);

  const plan = data?.plan ?? null;
  const exam = data?.exam ?? null;
  const settings = data?.settings ?? null;
  const bank = data?.bank ?? null;
  const purchasable = isExamPurchase ? exam : plan;
  const originalAmount = exam?.price ?? plan?.price ?? 0;
  const finalAmount = couponApplied ? couponApplied.discountedAmount : originalAmount;
  const checkoutTitle = exam?.title ?? plan?.name ?? t('subscription.title');

  useEffect(() => {
    setQrLoaded(false);
  }, [bank?.qrImageUrl]);

  const settingsAvailable = settings?.sourceAvailable === true;
  const esewaReady = settingsAvailable && !!settings?.esewa.enabled;
  const khaltiReady = settingsAvailable && !!settings?.khalti.enabled;


  const handleApplyCoupon = async () => {
    if (!couponInput.trim() || (!plan && !exam)) return;
    setValidatingCoupon(true);
    setCouponError(null);
    try {
      const result = await validateCoupon(couponInput.trim(), isExamPurchase ? 'exam' : plan?.billingCycle ?? 'free', originalAmount);
      if (!result.valid) {
        setCouponError(result.reason ?? t('subscription.couponInvalid'));
        return;
      }
      setCouponApplied({
        code: couponInput.trim().toUpperCase(),
        discountedAmount: result.discountedAmount ?? originalAmount,
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
    setUploadProgress(0);
    try {
      return await uploadImageToCloudinary(screenshotUri, setUploadProgress);
    } finally {
      setUploadingScreenshot(false);
    }
  };

  const handleSubmitManual = async () => {
    if (!user?.uid || !purchasable || !method) return;
    if (!transactionRef.trim()) {
      showToast(t('subscription.transactionRefRequired'), 'error');
      return;
    }
    if (!screenshotUri) {
      showToast(t('subscription.screenshotRequired'), 'error');
      return;
    }
    setShowConfirm(false);
    setSubmitting(true);
    try {
      const screenshotUrl = await uploadScreenshot();
      if (!screenshotUrl) {
        showToast(t('subscription.uploadScreenshot') + ' required', 'error');
        return;
      }
      if (isExamPurchase && exam) {
        await submitExamPurchase({
          uid: user.uid,
          userName: profile?.name ?? user.displayName ?? null,
          userEmail: profile?.email ?? user.email ?? null,
          courseId: exam.courseId,
          courseName: courseInfo?.courseName ?? null,
          subcourseId: exam.subcourseId,
          subcourseName: courseInfo?.subcourseName ?? null,
          examSetId: exam.id,
          examTitle: exam.title,
          examContentType: exam.contentType,
          amount: finalAmount,
          transactionRef: transactionRef.trim(),
          screenshotUrl,
          customerMessage: customerMessage.trim() || null,
          couponCode: couponApplied?.code ?? null,
        });
      } else if (plan) {
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
      }
      showToast(t('subscription.submitSuccess'), 'success');
      router.replace('/subscription');
    } catch {
      showToast(t('subscription.submitError'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  /** Opens only the provider checkout. Receipt ID/screenshot submission is QR-only. */
  const handleOpenGateway = async () => {
    if (isExamPurchase || !plan || !method || method === 'qr') return;
    if (!settingsAvailable) {
      showToast(t('subscription.settingsUnavailableToast'), 'info');
      return;
    }
    showToast(t('subscription.gatewayEnabledToast'), 'info');
    return;
  };

  const closeGateway = () => {
    setGatewayHtml(null);
    setGatewayUrl(null);
  };

  const handleGatewayNavigation = ({ url }: { url: string }) => {
    if (url.startsWith(PAYMENT_RETURN_URL)) {
      closeGateway();
      showToast(t('subscription.gatewayReturnHint'), 'info');
    }
  };

  if (!loading && (error || !purchasable)) {
    return (
      <SubpageScrollScreen title={checkoutTitle}>
        <DataNotFound onRetry={refetch} />
      </SubpageScrollScreen>
    );
  }

  return (
    <>
      <SubpageScrollScreen title={checkoutTitle}>
        {loading || !purchasable ? null : (
          <>
            {/* Plan summary */}
            <View style={[styles.summary, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }]}>
              <View style={styles.row}>
                <Text variant="bodyLarge" weight="bold" style={{ flex: 1 }}>{checkoutTitle}</Text>
                <Text variant="h3" weight="bold" style={{ color: colors.primary }}>Rs. {finalAmount}</Text>
              </View>
              {couponApplied ? (
                <Text variant="caption" secondary style={{ textDecorationLine: 'line-through' }}>Rs. {originalAmount}</Text>
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
                  settingsAvailable={settingsAvailable}
                  selected={method === 'esewa'}
                  onPress={() => {
                    if (!settingsAvailable) showToast(t('subscription.settingsUnavailableToast'), 'info');
                    else if (esewaReady) setMethod('esewa');
                    else showToast(t('subscription.comingSoonToast'), 'info');
                  }}
                />
                <MethodCard
                  logo={KHALTI_LOGO}
                  label="Khalti"
                  color="#5C2D91"
                  ready={khaltiReady}
                  settingsAvailable={settingsAvailable}
                  selected={method === 'khalti'}
                  onPress={() => {
                    if (!settingsAvailable) showToast(t('subscription.settingsUnavailableToast'), 'info');
                    else if (khaltiReady) setMethod('khalti');
                    else showToast(t('subscription.comingSoonToast'), 'info');
                  }}
                />
                <MethodCard
                  icon="qr-code-outline"
                  label={t('subscription.qrMethodLabel')}
                  color="#0EA5E9"
                  ready
                  settingsAvailable
                  selected={method === 'qr'}
                  onPress={() => setMethod('qr')}
                />
              </View>
            </View>

            {method === 'esewa' || method === 'khalti' ? (
              <Animated.View entering={FadeInDown.duration(220)} style={{ gap: spacing.sm }}>
                <Button
                  label={t('subscription.continueToGateway')}
                  onPress={handleOpenGateway}
                  icon={<Ionicons name="open-outline" size={16} color="#FFF" style={{ marginRight: 6 }} />}
                />
                <Text variant="caption" secondary>{t('subscription.gatewayOnlyHint')}</Text>
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
                  onPreviewQr={() => { setImageScale(1); setPreviewImageUri(bank?.qrImageUrl ?? null); }}
                />

                <ReceiptSubmitForm
                  transactionRef={transactionRef}
                  onTransactionRefChange={setTransactionRef}
                  screenshotUri={screenshotUri}
                  onPickScreenshot={handlePickScreenshot}
                  onOpenScreenshot={() => { setImageScale(1); setPreviewImageUri(screenshotUri); }}
                  uploadingScreenshot={uploadingScreenshot}
                  uploadProgress={uploadProgress}
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

      <Modal visible={!!previewImageUri} transparent animationType="fade" onRequestClose={() => setPreviewImageUri(null)}>
        <View style={styles.imageModal}>
          <View style={styles.imageModalHeader}>
            <Text variant="bodyLarge" weight="bold" style={{ color: '#FFF' }}>{t('subscription.uploadScreenshot')}</Text>
            <Pressable onPress={() => setPreviewImageUri(null)} hitSlop={12}>
              <Ionicons name="close" size={28} color="#FFF" />
            </Pressable>
          </View>
          <View style={styles.imageStage}>
            <Image source={{ uri: previewImageUri ?? undefined }} style={[styles.fullscreenImage, { transform: [{ scale: imageScale }] }]} resizeMode="contain" />
          </View>
          <View style={styles.zoomControls}>
            <Pressable style={styles.zoomButton} onPress={() => setImageScale((value) => Math.max(1, value - 0.25))}>
              <Ionicons name="remove" size={24} color="#FFF" />
            </Pressable>
            <Text variant="bodySmall" weight="bold" style={{ color: '#FFF' }}>{Math.round(imageScale * 100)}%</Text>
            <Pressable style={styles.zoomButton} onPress={() => setImageScale((value) => Math.min(4, value + 0.25))}>
              <Ionicons name="add" size={24} color="#FFF" />
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={!!gatewayHtml || !!gatewayUrl} animationType="slide" onRequestClose={closeGateway}>
        <View style={styles.gatewayModal}>
          <View style={styles.gatewayHeader}>
            <Text variant="bodyLarge" weight="bold">{method === 'esewa' ? 'eSewa' : 'Khalti'}</Text>
            <Pressable onPress={closeGateway} hitSlop={12}>
              <Ionicons name="close" size={26} color="#111827" />
            </Pressable>
          </View>
          {gatewayHtml ? (
            <WebView source={{ html: gatewayHtml }} onNavigationStateChange={handleGatewayNavigation} startInLoadingState />
          ) : gatewayUrl ? (
            <WebView source={{ uri: gatewayUrl }} onNavigationStateChange={handleGatewayNavigation} startInLoadingState />
          ) : null}
        </View>
      </Modal>

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
  settingsAvailable,
  selected,
  onPress,
}: {
  logo?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  ready: boolean;
  settingsAvailable: boolean;
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
          opacity: settingsAvailable ? (ready ? 1 : 0.55) : 0.7,
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
      {!settingsAvailable ? (
        <View style={[styles.comingSoonBadge, { backgroundColor: colors.surfaceAlt }]}>
          <Text variant="caption" weight="bold" secondary>{t('subscription.settingsUnavailable')}</Text>
        </View>
      ) : !ready ? (
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
  onPreviewQr,
}: {
  bank: import('@/src/core/firebase/services/subscription').BankDetails | null;
  qrLoaded: boolean;
  onQrLoad: () => void;
  onDownload: () => void;
  downloading: boolean;
  onCopyField: (value: string) => void;
  onPreviewQr: () => void;
}) {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();

  return (
    <>
      {!bank?.qrImageUrl && !bank?.bankDetails && !bank?.instructions ? (
        <View style={[styles.manualUnavailableBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }]}>
          <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text variant="bodySmall" weight="semiBold">{t('subscription.manualDetailsUnavailable')}</Text>
            <Text variant="caption" secondary>{t('subscription.manualDetailsUnavailableHint')}</Text>
          </View>
        </View>
      ) : null}
      {bank?.qrImageUrl ? (
        <View style={[styles.qrBox, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }] }>
          <Text variant="bodyLarge" weight="bold">{t('subscription.scanQrTitle')}</Text>
          <Text variant="bodySmall" secondary style={{ marginTop: 4, marginBottom: spacing.sm }}>{t('subscription.scanQrHint')}</Text>
          <Pressable onPress={onPreviewQr} style={styles.qrImageWrap}>
            {!qrLoaded ? <Skeleton width={220} height={220} radius={16} style={styles.qrSkeletonOverlay} /> : null}
            <Image
              source={{ uri: bank.qrImageUrl }}
              style={styles.qrImage}
              resizeMode="contain"
              onLoadEnd={onQrLoad}
            />
          </Pressable>
          <Pressable onPress={onDownload} disabled={downloading} style={[styles.downloadRow, { borderColor: colors.primary }] }>
            <Ionicons name={downloading ? 'cloud-download' : 'download-outline'} size={16} color={colors.primary} />
            <Text variant="bodySmall" weight="semiBold" style={{ color: colors.primary }}>
              {downloading ? 'Downloading…' : 'Download QR'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {bank?.bankDetails ? (
        <View style={[styles.bankBox, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }]}>
          <View style={styles.bankHeader}>
            <View style={[styles.bankIconRing, { backgroundColor: `${colors.primary}18` }]}>
              <Ionicons name="business-outline" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyLarge" weight="bold">{t('subscription.bankDetails')}</Text>
              <Text variant="caption" secondary>{t('subscription.bankDetailsHint')}</Text>
            </View>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.success} />
          </View>
          <View style={[styles.bankDetailsContent, { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, marginTop: spacing.md }]}>
            {bank.bankDetails.split(/\r?\n/).map((line, index) => (
              <View key={`${line}-${index}`} style={styles.bankLine}>
                <View style={[styles.bankBullet, { backgroundColor: colors.primary }]} />
                <Text variant="bodySmall" style={{ flex: 1, lineHeight: 21 }}>{line}</Text>
              </View>
            ))}
          </View>
          <Pressable onPress={() => onCopyField(bank.bankDetails)} hitSlop={8} style={[styles.copyDetailsRow, { borderColor: colors.primary }]}>
            <Ionicons name="copy-outline" size={16} color={colors.primary} />
            <Text variant="caption" weight="semiBold" style={{ color: colors.primary }}>{t('subscription.copyBankDetails')}</Text>
          </Pressable>
        </View>
      ) : null}

      {bank?.instructions ? (
        <View style={[styles.instructionsBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: spacing.lg }]}>
          <View style={styles.instructionsHeader}>
            <View style={[styles.instructionsIconRing, { backgroundColor: `${colors.primary}20` }]}>
              <Ionicons name="list-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyLarge" weight="bold">{t('subscription.instructions')}</Text>
              <Text variant="caption" secondary>{t('subscription.followSteps')}</Text>
            </View>
          </View>
          <View style={{ marginTop: spacing.md }}>
            {bank.instructions.split(/\r?\n/).map((instruction, index, items) => {
              const step = instruction.trim().replace(/^\d+[.)-]\s*/, '');
              if (!step) return null;
              return (
                <View key={`${step}-${index}`} style={styles.timelineRow}>
                  <View style={styles.timelineRail}>
                    <View style={[styles.timelineDot, { backgroundColor: colors.primary }]}>
                      <Text variant="caption" weight="bold" style={{ color: '#FFF' }}>{index + 1}</Text>
                    </View>
                    {index < items.length - 1 ? <View style={[styles.timelineLine, { backgroundColor: `${colors.primary}35` }]} /> : null}
                  </View>
                  <Text variant="bodySmall" style={{ flex: 1, lineHeight: 21, paddingBottom: spacing.md }}>{step}</Text>
                </View>
              );
            })}
          </View>
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
  onOpenScreenshot,
  uploadingScreenshot,
  uploadProgress,
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
  onOpenScreenshot: () => void;
  uploadingScreenshot: boolean;
  uploadProgress: number;
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
        label={`${t('subscription.transactionRef')} *`}
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
        {screenshotUri ? (
          <Pressable onPress={onOpenScreenshot}>
            <Image source={{ uri: screenshotUri }} style={styles.screenshotPreview} resizeMode="cover" />
            <Text variant="caption" secondary style={{ textAlign: 'center', marginTop: 4 }}>{t('subscription.tapToZoom')}</Text>
          </Pressable>
        ) : null}
        {uploadingScreenshot ? (
          <View style={{ gap: 6 }}>
            <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
              <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${Math.round(uploadProgress * 100)}%` }]} />
            </View>
            <Text variant="caption" secondary>{t('subscription.uploadingScreenshot')} {Math.round(uploadProgress * 100)}%</Text>
          </View>
        ) : null}
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
  manualUnavailableBox: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: StyleSheet.hairlineWidth },
  qrImageWrap: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center' },
  qrSkeletonOverlay: { position: 'absolute' },
  qrImage: { width: 220, height: 220, borderRadius: 12 },
  downloadRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  bankBox: {},
  copyDetailsRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, marginTop: 12, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  instructionsBox: { overflow: 'hidden' },
  instructionsHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  instructionsIconRing: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  screenshotPreview: { width: '100%', height: 180, borderRadius: 12 },
  progressTrack: { height: 8, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  bankHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bankIconRing: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  bankDetailsContent: { padding: 12, gap: 8 },
  bankLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bankBullet: { width: 7, height: 7, borderRadius: 4, marginTop: 7 },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', minHeight: 42 },
  timelineRail: { width: 32, alignItems: 'center' },
  timelineDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  timelineLine: { width: 2, flex: 1, minHeight: 18, marginTop: 3 },
  imageModal: { flex: 1, backgroundColor: 'rgba(3, 7, 18, 0.98)' },
  imageModalHeader: { height: 62, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  imageStage: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  fullscreenImage: { width: '100%', height: '82%' },
  zoomControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22, paddingBottom: 28 },
  zoomButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' },
  gatewayModal: { flex: 1, backgroundColor: '#FFF' },
  gatewayHeader: { height: 58, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D1D5DB' },
});
