import React, { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { fetchUserProfile } from '@/src/core/firebase/services/profile';
import { useAuthStore } from '@/src/core/store/authStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { showToast } from '@/src/core/store/toastStore';
import { approveContentPurchase, fetchContentPurchaseById, rejectContentPurchase } from '@/src/core/firebase/services/contentPurchases';
import { SubpageScrollScreen } from '@/src/components/nav/SubpageScrollScreen';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';
import { TextField } from '@/src/components/inputs/TextField';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { ConfirmDialog } from '@/src/components/feedback/ConfirmDialog';

export default function AdminContentPurchaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radius } = useTheme();
  const { t, language } = useTranslation();
  const reviewer = useAuthStore((state) => state.user);
  const { data: record, loading, error, refetch } = useAsyncData(async () => id ? fetchContentPurchaseById(id) : null, [id]);
  const { data: userProfile } = useAsyncData(() => record?.uid ? fetchUserProfile(record.uid) : Promise.resolve(null), [record?.uid]);
  const [adminMessage, setAdminMessage] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [showApprove, setShowApprove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const approve = async () => {
    if (!record || !reviewer?.uid) return;
    setShowApprove(false);
    setBusy(true);
    try {
      await approveContentPurchase(record.id, reviewer.uid, adminMessage.trim() || null);
      showToast(t('subscription.adminApproveSuccess'), 'success');
      await refetch();
    } catch {
      showToast(t('common.somethingWentWrong'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!record || !reviewer?.uid) return;
    setShowReject(false);
    setBusy(true);
    try {
      await rejectContentPurchase(record.id, reviewer.uid, rejectReason.trim() || 'Payment could not be verified.', adminMessage.trim() || null);
      showToast(t('subscription.adminRejectSuccess'), 'success');
      await refetch();
    } catch {
      showToast(t('common.somethingWentWrong'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const status = record?.status ?? 'pending';
  const contentTitle = record ? (language === 'ne' ? record.contentTitleNe || record.contentTitle : record.contentTitle) : '';
  const statusTag = status === 'active'
    ? { label: t('subscription.tagApproved'), color: colors.success, icon: 'checkmark-circle' as const }
    : status === 'rejected'
      ? { label: t('subscription.tagRejected'), color: colors.error, icon: 'close-circle' as const }
      : { label: t('subscription.tagNew'), color: colors.warning, icon: 'time' as const };

  return (
    <>
      <SubpageScrollScreen title={t('subscription.contentDetails')}>
        {loading ? null : error || !record ? <DataNotFound onRetry={refetch} /> : (
          <>
            <View style={[styles.status, { backgroundColor: `${statusTag.color}14`, borderColor: statusTag.color, borderRadius: radius.lg, padding: spacing.md }]}>
              <View style={styles.row}><Ionicons name={statusTag.icon} size={22} color={statusTag.color} /><Text variant="bodyLarge" weight="bold" style={{ color: statusTag.color }}>{statusTag.label}</Text></View>
              {record.adminMessage ? <Text variant="bodySmall" style={{ color: statusTag.color, marginTop: spacing.xs }}>{record.adminMessage}</Text> : null}
            </View>

            <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }] }>
              {userProfile?.photoURL ? <Image source={{ uri: userProfile.photoURL }} style={styles.profilePhoto} /> : <View style={[styles.profilePhoto, styles.profilePlaceholder, { backgroundColor: `${colors.primary}15` }]}><Ionicons name="person" size={24} color={colors.primary} /></View>}
              <View style={{ flex: 1, gap: 4 }}>
                <Text variant="bodyLarge" weight="bold">{userProfile?.name || record.userName || '—'}</Text>
                <Text variant="bodySmall" secondary>{userProfile?.email || record.userEmail || '—'}</Text>
                <Text variant="caption" secondary>{record.courseId || '—'} · {record.subcourseId || '—'}</Text>
              </View>
            </View>

            <View style={[styles.actionPanel, { backgroundColor: colors.surface, borderColor: colors.primary, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm }]}>
              <TextField label={t('subscription.adminMessageLabel')} helperText={t('subscription.adminMessageHint')} placeholder={t('subscription.adminMessagePlaceholder')} value={adminMessage} onChangeText={setAdminMessage} multiline numberOfLines={3} />
              <Button label={t('subscription.adminApprove')} onPress={() => setShowApprove(true)} loading={busy} />
              <Button label={t('subscription.adminReject')} variant="danger" onPress={() => setShowReject(true)} loading={busy} />
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
              <Row label={t('subscription.contentDetails')} value={contentTitle} />
              <Divider /><Row label={t('subscription.contentType')} value={record.contentType} />
              <Divider /><Row label={t('subscription.adminUser')} value={record.userName ?? '—'} />
              <Divider /><Row label={t('subscription.adminEmail')} value={record.userEmail ?? '—'} />
              <Divider /><Row label={t('subscription.courseLabel')} value={record.courseId ?? '—'} />
              <Divider /><Row label={t('subscription.subcourseLabel')} value={record.subcourseId ?? '—'} />
              <Divider /><Row label={t('subscription.pendingAmount')} value={`Rs. ${record.amount}`} />
              <Divider /><Row label={t('subscription.pendingRef')} value={record.transactionRef ?? '—'} />
              {record.customerMessage ? <><Divider /><Row label={t('subscription.customMessageLabel')} value={record.customerMessage} /></> : null}
            </View>

            {record.screenshotUrl ? <Pressable onPress={() => setFullscreen(true)}><Image source={{ uri: record.screenshotUrl }} style={styles.screenshot} resizeMode="cover" /><Text variant="caption" secondary style={{ textAlign: 'center', marginTop: 4 }}>{t('subscription.tapToZoom')}</Text></Pressable> : null}
          </>
        )}
      </SubpageScrollScreen>
      <PageLoaderOverlay visible={loading || busy} label={t('subscription.loading')} />

      <ConfirmDialog visible={showApprove} title={t('subscription.adminApprove')} message={t('subscription.adminApproveConfirm')} onConfirm={approve} onCancel={() => setShowApprove(false)} />
      <Modal visible={showReject} transparent animationType="fade" onRequestClose={() => setShowReject(false)}>
        <Pressable style={[styles.overlay, { backgroundColor: colors.overlay }]} onPress={() => setShowReject(false)}>
          <Pressable onPress={(event) => event.stopPropagation()} style={[styles.modalCard, { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg }]}>
            <Text variant="h3" weight="semiBold">{t('subscription.adminRejectTitle')}</Text>
            <TextField placeholder={t('subscription.adminRejectReasonPlaceholder')} value={rejectReason} onChangeText={setRejectReason} multiline numberOfLines={3} containerStyle={{ marginTop: spacing.sm }} />
            <View style={[styles.row, { gap: spacing.sm, marginTop: spacing.md }]}><Button label={t('common.cancel')} variant="secondary" onPress={() => setShowReject(false)} style={{ flex: 1 }} /><Button label={t('subscription.adminReject')} variant="danger" onPress={reject} style={{ flex: 1 }} /></View>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal visible={fullscreen} transparent animationType="fade" onRequestClose={() => setFullscreen(false)}><Pressable style={styles.fullscreen} onPress={() => setFullscreen(false)}>{record?.screenshotUrl ? <Image source={{ uri: record.screenshotUrl }} style={styles.fullscreenImage} resizeMode="contain" /> : null}</Pressable></Modal>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { spacing } = useTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md }}><Text variant="bodySmall" secondary style={{ width: 105 }}>{label}</Text><Text variant="bodyLarge" weight="semiBold" style={{ flex: 1 }} numberOfLines={3}>{value}</Text></View>;
}

function Divider() { const { colors } = useTheme(); return <View style={{ height: StyleSheet.hairlineWidth, marginHorizontal: 16, backgroundColor: colors.divider }} />; }

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  status: { borderWidth: 1 },
  actionPanel: { borderWidth: 1.5 },
  profileCard: { borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 12 },
  profilePhoto: { width: 58, height: 58, borderRadius: 29 },
  profilePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  screenshot: { width: '100%', height: 230, borderRadius: 12 },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '88%' },
  fullscreen: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  fullscreenImage: { width: '100%', height: '100%' },
});
