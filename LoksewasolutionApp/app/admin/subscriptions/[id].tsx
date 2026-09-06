// Admin — review a single pending subscription request. Approve activates
// the subscription immediately (writes isPremium + premiumExpiryDate onto
// the user doc); Reject tags it 'rejected' with a reason the user sees on
// their Subscription page for 1 day.
import React, { useState } from 'react';
import { View, StyleSheet, Image, Modal, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
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
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const { data, loading, error, refetch } = useAsyncData(async () => {
    if (!id) return null;
    const [record, plans] = await Promise.all([fetchSubscriptionById(id), fetchSubscriptionPlans()]);
    return { record, plans };
  }, [id]);

  const [rejectReason, setRejectReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const record = data?.record ?? null;
  const plan = data?.plans.find((p) => p.id === record?.planId) ?? null;

  const handleApprove = async () => {
    if (!record || !user?.uid) return;
    setShowApproveConfirm(false);
    setBusy(true);
    try {
      await approveSubscription(record.id, user.uid, plan?.durationDays ?? 30);
      showToast(t('subscription.adminApproveSuccess'), 'success');
      router.back();
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
      await rejectSubscription(record.id, user.uid, rejectReason.trim() || 'Payment could not be verified.');
      showToast(t('subscription.adminRejectSuccess'), 'success');
      router.back();
    } catch {
      showToast(t('common.somethingWentWrong'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SubpageScrollScreen title={t('subscription.adminReviewTitle')}>
        {loading ? null : error || !record ? (
          <DataNotFound onRetry={refetch} />
        ) : (
          <>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
              <Row label={t('subscription.adminUser')} value={record.userName ?? record.userEmail ?? record.uid} />
              <Divider />
              <Row label={t('subscription.pendingPlan')} value={record.planName} />
              <Divider />
              <Row label={t('subscription.pendingAmount')} value={`Rs. ${record.amount}`} />
              <Divider />
              <Row label={t('subscription.pendingMethod')} value={record.method} />
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
            </View>

            {record.screenshotUrl ? (
              <View style={{ gap: spacing.xs }}>
                <Text variant="bodySmall" weight="semiBold" secondary>{t('subscription.adminScreenshot')}</Text>
                <Pressable onPress={() => setFullscreen(true)}>
                  <Image source={{ uri: record.screenshotUrl }} style={styles.screenshot} resizeMode="cover" />
                </Pressable>
              </View>
            ) : null}

            <View style={{ gap: spacing.sm }}>
              <Button label={t('subscription.adminApprove')} onPress={() => setShowApproveConfirm(true)} loading={busy} />
              <Button label={t('subscription.adminReject')} variant="danger" onPress={() => setShowRejectDialog(true)} loading={busy} />
            </View>
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
          {record?.screenshotUrl ? (
            <Image source={{ uri: record.screenshotUrl }} style={styles.fullscreenImage} resizeMode="contain" />
          ) : null}
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
      <Text variant="bodyLarge" weight="semiBold" style={{ flex: 1 }} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={[styles.divider, { backgroundColor: colors.divider }]} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  card: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  screenshot: { width: '100%', height: 220, borderRadius: 12 },
  modalOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '88%' },
  fullscreenOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' },
  fullscreenImage: { width: '100%', height: '100%' },
});
