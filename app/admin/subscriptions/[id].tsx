// Admin — review a single subscription request. Approve activates the
// subscription immediately (writes isPremium + premiumPlanName +
// premiumExpiryDate onto the user doc); Reject tags it 'rejected' with a
// reason the user sees on their Subscription page. Either action keeps the
// request permanently visible in the admin list — this screen just updates
// its status/tag, never deletes it.
import React, { useState } from 'react';
import { View, StyleSheet, Image, Modal, Pressable } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { showToast } from '@/src/core/store/toastStore';
import {
  fetchSubscriptionById,
  approveSubscription,
  rejectSubscription,
  fetchSubscriptionPlans,
} from '@/src/core/firebase/services/subscription';
import { downloadImageToDevice } from '@/src/core/media/imageDownload';
import { SubpageScrollScreen } from '@/src/components/nav/SubpageScrollScreen';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';
import { TextField } from '@/src/components/inputs/TextField';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { ConfirmDialog } from '@/src/components/feedback/ConfirmDialog';

export default function AdminSubscriptionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const { data, loading, error, refetch } = useAsyncData(async () => {
    if (!id) return null;
    const [record, plans] = await Promise.all([fetchSubscriptionById(id), fetchSubscriptionPlans()]);
    return { record, plans };
  }, [id]);

  const [rejectReason, setRejectReason] = useState('');
  const [adminMessage, setAdminMessage] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [downloadingScreenshot, setDownloadingScreenshot] = useState(false);

  const record = data?.record ?? null;
  const plan = data?.plans.find((p) => p.id === record?.planId) ?? null;
  const alreadyReviewed = record?.status === 'active' || record?.status === 'rejected';

  const handleApprove = async () => {
    if (!record || !user?.uid) return;
    setShowApproveConfirm(false);
    setBusy(true);
    try {
      await approveSubscription(record.id, user.uid, plan?.durationDays ?? 30, adminMessage.trim() || null);
      showToast(t('subscription.adminApproveSuccess'), 'success');
      refetch();
    } catch {
      showToast(t('common.somethingWentWrong'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!record || !user?.uid) return;
    setShowRejectDialog(false);
    setBusy(true);
    try {
      await rejectSubscription(record.id, user.uid, rejectReason.trim() || 'Payment could not be verified.', adminMessage.trim() || null);
      showToast(t('subscription.adminRejectSuccess'), 'success');
      refetch();
    } catch {
      showToast(t('common.somethingWentWrong'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleCopyUrl = async () => {
    if (!record?.screenshotUrl) return;
    await Clipboard.setStringAsync(record.screenshotUrl);
    showToast('Copied', 'success');
  };

  const handleDownloadScreenshot = async () => {
    if (!record?.screenshotUrl) return;
    setDownloadingScreenshot(true);
    try {
      const result = await downloadImageToDevice(record.screenshotUrl, `receipt-${record.id}.png`);
      showToast(result.saved ? 'Screenshot saved' : 'Download cancelled', result.saved ? 'success' : 'info');
    } catch {
      showToast('Could not download the screenshot.', 'error');
    } finally {
      setDownloadingScreenshot(false);
    }
  };

  const statusTag = record
    ? record.status === 'active'
      ? { label: t('subscription.tagApproved'), color: colors.success }
      : record.status === 'rejected'
        ? { label: t('subscription.tagRejected'), color: colors.error }
        : record.status === 'expired'
          ? { label: t('subscription.tagExpired'), color: colors.textSecondary }
          : { label: t('subscription.tagNew'), color: colors.warning }
    : null;

  return (
    <>
      <SubpageScrollScreen title={t('subscription.adminReviewTitle')}>
        {loading ? null : error || !record ? (
          <DataNotFound onRetry={refetch} />
        ) : (
          <>
            {statusTag ? (
              <View style={[styles.statusBanner, { backgroundColor: `${statusTag.color}14`, borderColor: statusTag.color, borderRadius: radius.lg, padding: spacing.md }]}>
                <Text variant="bodyLarge" weight="bold" style={{ color: statusTag.color }}>{statusTag.label}</Text>
                {record.adminMessage ? <Text variant="bodySmall" style={{ marginTop: 4, color: statusTag.color }}>{record.adminMessage}</Text> : null}
              </View>
            ) : null}

            <View style={[styles.actionPanel, { backgroundColor: colors.surface, borderColor: colors.primary, borderRadius: radius.lg, padding: spacing.md }]}>
              <TextField
                label={t('subscription.adminMessageLabel')}
                helperText={t('subscription.adminMessageHint')}
                placeholder={t('subscription.adminMessagePlaceholder')}
                value={adminMessage}
                onChangeText={setAdminMessage}
                multiline
                numberOfLines={3}
              />
              <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                <Button label={t('subscription.adminApprove')} onPress={() => setShowApproveConfirm(true)} loading={busy} />
                <Button label={t('subscription.adminReject')} variant="danger" onPress={() => setShowRejectDialog(true)} loading={busy} />
                {alreadyReviewed ? <Text variant="caption" secondary style={{ textAlign: 'center' }}>{t('subscription.adminReReviewHint')}</Text> : null}
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
              <Row label={t('subscription.adminUser')} value={record.userName ?? record.userEmail ?? record.uid} />
              <Divider />
              <Row label={t('subscription.pendingPlan')} value={record.planName} />
              <Divider />
              <Row label={t('subscription.pendingAmount')} value={`Rs. ${record.amount}`} />
              <Divider />
              <Row label={t('subscription.pendingMethod')} value={record.method.toUpperCase()} />
              <Divider />
              <Row label={t('subscription.pendingRef')} value={record.transactionRef ?? '—'} />
              {record.couponCode ? (
                <>
                  <Divider />
                  <Row label={t('subscription.couponCode')} value={record.couponCode} />
                </>
              ) : null}
              <Divider />
              <Row label={t('subscription.adminSubmittedOn')} value={record.submittedAt ? new Date(record.submittedAt).toLocaleString() : '—'} />
              {record.customerMessage ? (
                <>
                  <Divider />
                  <Row label={t('subscription.customMessageLabel')} value={record.customerMessage} />
                </>
              ) : null}
            </View>

            {record.screenshotUrl ? (
              <View style={{ gap: spacing.xs }}>
                <Text variant="bodySmall" weight="semiBold" secondary>{t('subscription.adminScreenshot')}</Text>
                <Pressable onPress={() => setFullscreen(true)}>
                  <Image source={{ uri: record.screenshotUrl }} style={styles.screenshot} resizeMode="cover" />
                </Pressable>

                <View style={[styles.urlRow, { borderColor: colors.border, borderRadius: radius.md }]}>
                  <Text variant="caption" secondary numberOfLines={1} style={{ flex: 1, paddingHorizontal: spacing.sm }}>{record.screenshotUrl}</Text>
                  <Pressable onPress={handleCopyUrl} hitSlop={8} style={styles.urlIconBtn}>
                    <Ionicons name="copy-outline" size={16} color={colors.primary} />
                  </Pressable>
                  <Pressable onPress={handleDownloadScreenshot} disabled={downloadingScreenshot} hitSlop={8} style={styles.urlIconBtn}>
                    <Ionicons name={downloadingScreenshot ? 'cloud-download' : 'download-outline'} size={16} color={colors.primary} />
                  </Pressable>
                </View>
              </View>
            ) : null}

          </>
        )}
      </SubpageScrollScreen>
      <PageLoaderOverlay visible={loading} label={t('subscription.loading')} />

      <ConfirmDialog
        visible={showApproveConfirm}
        title={t('subscription.adminApprove')}
        message={t('subscription.adminApproveConfirm')}
        onConfirm={handleApprove}
        onCancel={() => setShowApproveConfirm(false)}
      />

      <Modal visible={showRejectDialog} transparent animationType="fade" onRequestClose={() => setShowRejectDialog(false)}>
        <Pressable style={[styles.modalOverlay, { backgroundColor: colors.overlay }]} onPress={() => setShowRejectDialog(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} style={[styles.modalCard, { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg }]}>
            <Text variant="h3" weight="semiBold">{t('subscription.adminRejectTitle')}</Text>
            <TextField
              placeholder={t('subscription.adminRejectReasonPlaceholder')}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={3}
              containerStyle={{ marginTop: spacing.sm }}
            />
            <View style={[styles.row, { gap: spacing.sm, marginTop: spacing.md }]}>
              <Button label={t('common.cancel')} variant="secondary" onPress={() => setShowRejectDialog(false)} style={{ flex: 1 }} />
              <Button label={t('subscription.adminReject')} variant="danger" onPress={handleReject} style={{ flex: 1 }} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={fullscreen} transparent animationType="fade" onRequestClose={() => setFullscreen(false)}>
        <Pressable style={styles.fullscreenOverlay} onPress={() => setFullscreen(false)}>
          {record?.screenshotUrl ? <Image source={{ uri: record.screenshotUrl }} style={styles.fullscreenImage} resizeMode="contain" /> : null}
        </Pressable>
      </Modal>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md }}>
      <Text variant="bodySmall" secondary style={{ width: 100 }}>{label}</Text>
      <Text variant="bodyLarge" weight="semiBold" style={{ flex: 1 }} numberOfLines={3}>{value}</Text>
    </View>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={[styles.divider, { backgroundColor: colors.divider }]} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusBanner: { borderWidth: 1 },
  actionPanel: { borderWidth: 1.5 },
  card: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  screenshot: { width: '100%', height: 220, borderRadius: 12 },
  urlRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, paddingVertical: 8 },
  urlIconBtn: { padding: 8 },
  modalOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '88%' },
  fullscreenOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' },
  fullscreenImage: { width: '100%', height: '100%' },
});
