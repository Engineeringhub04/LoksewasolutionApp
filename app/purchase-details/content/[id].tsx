import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { showToast } from '@/src/core/store/toastStore';
import {
  contentPurchaseEditRemainingMs,
  fetchContentPurchaseById,
  isContentPurchaseEditable,
  updateMyContentPurchaseDetails,
} from '@/src/core/firebase/services/contentPurchases';
import { uploadImageToCloudinary } from '@/src/core/media/cloudinary';
import { SubpageScrollScreen } from '@/src/components/nav/SubpageScrollScreen';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';
import { TextField } from '@/src/components/inputs/TextField';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';

export default function ContentPurchaseRequestDetailScreen() {
  const { id, source } = useLocalSearchParams<{ id: string; source?: string }>();
  const router = useRouter();
  const { colors, spacing, radius } = useTheme();
  const { t, language } = useTranslation();
  const [editMode, setEditMode] = useState(false);
  const [transactionRef, setTransactionRef] = useState('');
  const [customerMessage, setCustomerMessage] = useState('');
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const { data: record, loading, error, refetch } = useAsyncData(async () => {
    if (!id) return null;
    return fetchContentPurchaseById(id);
  }, [id]);

  useEffect(() => {
    if (!record) return;
    setTransactionRef(record.transactionRef ?? '');
    setCustomerMessage(record.customerMessage ?? '');
    setScreenshotUri(record.screenshotUrl || null);
  }, [record]);

  useEffect(() => {
    if (!record?.submittedAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [record?.submittedAt]);

  const handleBack = () => {
    if (source === 'content' || source === 'chapter') {
      router.replace('/subjects');
      return;
    }
    router.back();
  };

  const canEdit = !!record && isContentPurchaseEditable(record, now);
  const remainingMs = record ? contentPurchaseEditRemainingMs(record, now) : 0;
  const remainingLabel = formatDuration(remainingMs);

  const pickScreenshot = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast(t('subscription.uploadScreenshotHint'), 'warning');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.7 });
    if (!result.canceled && result.assets.length > 0) setScreenshotUri(result.assets[0].uri);
  };

  const handleSave = async () => {
    if (!record || !canEdit) {
      showToast(t('subscription.editWindowExpired'), 'warning');
      return;
    }
    if (!transactionRef.trim() || !screenshotUri) {
      showToast(`${t('subscription.transactionRef')} and ${t('subscription.uploadScreenshot')} required`, 'error');
      return;
    }
    setSaving(true);
    try {
      const screenshotUrl = screenshotUri.startsWith('http') ? screenshotUri : await uploadImageToCloudinary(screenshotUri);
      await updateMyContentPurchaseDetails(record.id, {
        transactionRef: transactionRef.trim(),
        screenshotUrl,
        customerMessage: customerMessage.trim() || null,
      });
      showToast(t('subscription.requestUpdated'), 'success');
      setEditMode(false);
      await refetch();
    } catch {
      showToast(t('subscription.requestUpdateError'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const status = record?.status ?? 'pending';
  const statusTag = status === 'active'
    ? { label: t('subscription.tagApproved'), color: colors.success, icon: 'checkmark-circle' as const }
    : status === 'rejected'
      ? { label: t('subscription.tagRejected'), color: colors.error, icon: 'close-circle' as const }
      : { label: t('subscription.pendingReview'), color: colors.warning, icon: 'time' as const };

  const contentTitle = record ? (language === 'ne' ? record.contentTitleNe || record.contentTitle : record.contentTitle) : '';

  return (
    <>
      <SubpageScrollScreen title={contentTitle || t('subscription.contentPurchase')} onBackPress={handleBack}>
        {loading ? null : error || !record ? (
          <DataNotFound onRetry={refetch} />
        ) : (
          <>
            <View style={[styles.statusBox, { backgroundColor: `${statusTag.color}14`, borderColor: statusTag.color, borderRadius: radius.lg, padding: spacing.md }] }>
              <View style={styles.row}>
                <Ionicons name={statusTag.icon} size={22} color={statusTag.color} />
                <Text variant="bodyLarge" weight="bold" style={{ color: statusTag.color }}>{statusTag.label}</Text>
              </View>
              {record.status === 'pending' ? <Text variant="caption" secondary style={{ marginTop: spacing.xs }}>{canEdit ? `${t('subscription.editTimeRemaining')}: ${remainingLabel}` : t('subscription.editWindowExpired')}</Text> : null}
              {record.rejectionReason ? <Text variant="body" style={{ marginTop: spacing.sm, color: statusTag.color }}>{record.rejectionReason}</Text> : null}
            </View>

            {record.adminMessage ? (
              <View style={[styles.messageBox, { backgroundColor: `${colors.primary}14`, borderColor: colors.primary, borderRadius: radius.md, padding: spacing.md }] }>
                <View style={styles.row}><Ionicons name="chatbubble-ellipses" size={18} color={colors.primary} /><Text variant="bodySmall" weight="bold" style={{ color: colors.primary }}>{t('subscription.adminMessageTitle')}</Text></View>
                <Text variant="body" style={{ marginTop: spacing.xs }}>{record.adminMessage}</Text>
              </View>
            ) : null}

            {record.status === 'pending' ? (
              <View style={{ gap: spacing.xs }}>
                <Button label={editMode ? t('subscription.saveRequest') : t('subscription.editRequest')} disabled={!canEdit} loading={saving} onPress={editMode ? handleSave : () => setEditMode(true)} icon={<Ionicons name={editMode ? 'checkmark-outline' : 'create-outline'} size={17} color="#FFF" style={{ marginRight: 6 }} />} />
                <Text variant="caption" secondary style={{ textAlign: 'center' }}>{canEdit ? `${t('subscription.editTimeRemaining')}: ${remainingLabel}` : t('subscription.editWindowExpired')}</Text>
              </View>
            ) : null}

            {editMode ? (
              <View style={[styles.editBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.md }] }>
                <TextField label={t('subscription.transactionRef')} value={transactionRef} onChangeText={setTransactionRef} placeholder={t('subscription.transactionRefPlaceholder')} autoCapitalize="characters" />
                <View style={{ gap: spacing.xs }}>
                  <Text variant="bodySmall" weight="medium" secondary>{t('subscription.uploadScreenshot')}</Text>
                  {screenshotUri ? <Image source={{ uri: screenshotUri }} style={styles.preview} resizeMode="cover" /> : null}
                  <Button label={t('subscription.uploadScreenshot')} variant="secondary" onPress={pickScreenshot} />
                </View>
                <TextField label={t('subscription.customMessageLabel')} value={customerMessage} onChangeText={setCustomerMessage} placeholder={t('subscription.customMessagePlaceholder')} multiline numberOfLines={3} />
                <Button label={t('common.cancel')} variant="secondary" onPress={() => setEditMode(false)} disabled={saving} />
              </View>
            ) : null}

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }] }>
              <Row label={t('subscription.contentPurchase')} value={contentTitle} />
              <Divider />
              <Row label={t('subscription.contentType')} value={record.contentType} />
              <Divider />
              <Row label={t('subscription.courseLabel')} value={record.courseId ?? '—'} />
              <Divider />
              <Row label={t('subscription.subcourseLabel')} value={record.subcourseId ?? '—'} />
              <Divider />
              <Row label={t('subscription.pendingAmount')} value={`Rs. ${record.amount}`} />
              <Divider />
              <Row label={t('subscription.pendingRef')} value={record.transactionRef ?? '—'} />
              {record.customerMessage ? <><Divider /><Row label={t('subscription.customMessageLabel')} value={record.customerMessage} /></> : null}
            </View>

            {record.screenshotUrl ? <View style={{ gap: spacing.xs }}><Text variant="bodySmall" weight="semiBold" secondary>{t('subscription.uploadScreenshot')}</Text><Image source={{ uri: record.screenshotUrl }} style={styles.screenshot} resizeMode="cover" /></View> : null}
          </>
        )}
      </SubpageScrollScreen>
      <PageLoaderOverlay visible={loading || saving} label={t('subscription.loading')} />
    </>
  );
}

function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

function Row({ label, value }: { label: string; value: string }) {
  const { spacing } = useTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md }}><Text variant="bodySmall" secondary style={{ width: 110 }}>{label}</Text><Text variant="bodyLarge" weight="semiBold" style={{ flex: 1 }} numberOfLines={3}>{value}</Text></View>;
}

function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, marginHorizontal: 16, backgroundColor: colors.divider }} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusBox: { borderWidth: 1 },
  messageBox: { borderWidth: 1 },
  editBox: { borderWidth: StyleSheet.hairlineWidth },
  card: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  preview: { width: '100%', height: 160, borderRadius: 12 },
  screenshot: { width: '100%', height: 220, borderRadius: 12 },
});
