import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { showToast } from '@/src/core/store/toastStore';
import {
  fetchSubscriptionById,
  updateMySubscriptionDetails,
} from '@/src/core/firebase/services/subscription';
import { uploadImageToCloudinary } from '@/src/core/media/cloudinary';
import { SubpageScrollScreen } from '@/src/components/nav/SubpageScrollScreen';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';
import { TextField } from '@/src/components/inputs/TextField';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';

export default function SubscriptionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [editMode, setEditMode] = useState(false);
  const [transactionRef, setTransactionRef] = useState('');
  const [customerMessage, setCustomerMessage] = useState('');
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: record, loading, error, refetch } = useAsyncData(async () => {
    if (!id) return null;
    return fetchSubscriptionById(id);
  }, [id]);

  useEffect(() => {
    if (!record) return;
    setTransactionRef(record.transactionRef ?? '');
    setCustomerMessage(record.customerMessage ?? '');
    setScreenshotUri(record.screenshotUrl || null);
  }, [record]);

  const canEdit = !!record && record.status !== 'active';

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
    if (!record) return;
    if (!transactionRef.trim() || !screenshotUri) {
      showToast(`${t('subscription.transactionRef')} and ${t('subscription.uploadScreenshot')} required`, 'error');
      return;
    }
    setSaving(true);
    try {
      let screenshotUrl = screenshotUri;
      if (!screenshotUri.startsWith('http')) screenshotUrl = await uploadImageToCloudinary(screenshotUri);
      await updateMySubscriptionDetails(record.id, {
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
      : status === 'expired'
        ? { label: t('subscription.tagExpired'), color: colors.textSecondary, icon: 'time' as const }
        : { label: t('subscription.tagNew'), color: colors.warning, icon: 'sparkles' as const };

  return (
    <>
      <SubpageScrollScreen title={t('subscription.viewDetails')}>
        {loading ? null : error || !record ? (
          <DataNotFound onRetry={refetch} />
        ) : (
          <>
            <View style={[styles.statusBox, { backgroundColor: `${statusTag.color}14`, borderColor: statusTag.color, borderRadius: radius.lg, padding: spacing.md }]}>
              <View style={styles.row}>
                <Ionicons name={statusTag.icon} size={22} color={statusTag.color} />
                <Text variant="bodyLarge" weight="bold" style={{ color: statusTag.color }}>{statusTag.label}</Text>
              </View>
              {record.rejectionReason ? <Text variant="body" style={{ marginTop: spacing.sm, color: statusTag.color }}>{record.rejectionReason}</Text> : null}
            </View>

            {record.adminMessage ? (
              <View style={[styles.adminMessageBox, { backgroundColor: `${colors.primary}14`, borderColor: colors.primary, borderRadius: radius.md, padding: spacing.md }]}>
                <View style={styles.row}>
                  <Ionicons name="chatbubble-ellipses" size={18} color={colors.primary} />
                  <Text variant="bodySmall" weight="bold" style={{ color: colors.primary }}>{t('subscription.adminMessageTitle')}</Text>
                </View>
                <Text variant="body" style={{ marginTop: spacing.xs, color: colors.textPrimary }}>{record.adminMessage}</Text>
              </View>
            ) : null}

            <View style={[styles.topActions, { gap: spacing.sm }]}>
              {canEdit ? (
                <Button
                  label={editMode ? t('subscription.saveRequest') : t('subscription.editRequest')}
                  loading={saving}
                  onPress={editMode ? handleSave : () => setEditMode(true)}
                  icon={<Ionicons name={editMode ? 'checkmark-outline' : 'create-outline'} size={17} color="#FFF" style={{ marginRight: 6 }} />}
                />
              ) : null}
              <View style={[styles.row, { gap: spacing.sm }]}>
                <Button label={t('subscription.renewNow')} variant="secondary" onPress={() => router.replace('/subscription')} style={{ flex: 1 }} />
                <Button label={t('subscription.contactSupport')} variant="secondary" onPress={() => router.push('/contact-us')} style={{ flex: 1 }} />
              </View>
            </View>

            {editMode ? (
              <View style={[styles.editBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.md }]}>
                <Text variant="bodySmall" weight="bold">{t('subscription.editRequest')}</Text>
                <TextField
                  label={t('subscription.transactionRef')}
                  helperText={t('subscription.transactionRefHint')}
                  placeholder={t('subscription.transactionRefPlaceholder')}
                  value={transactionRef}
                  onChangeText={setTransactionRef}
                  autoCapitalize="characters"
                />
                <View style={{ gap: spacing.xs }}>
                  <Text variant="bodySmall" weight="medium" secondary>{t('subscription.uploadScreenshot')}</Text>
                  <Text variant="caption" secondary>{t('subscription.uploadScreenshotHint')}</Text>
                  {screenshotUri ? <Image source={{ uri: screenshotUri }} style={styles.screenshotPreview} resizeMode="cover" /> : null}
                  <Button label={screenshotUri ? t('common.edit') : t('subscription.uploadScreenshot')} variant="secondary" onPress={pickScreenshot} />
                </View>
                <TextField
                  label={t('subscription.customMessageLabel')}
                  placeholder={t('subscription.customMessagePlaceholder')}
                  value={customerMessage}
                  onChangeText={setCustomerMessage}
                  multiline
                  numberOfLines={3}
                />
                <Button label={t('common.cancel')} variant="secondary" onPress={() => setEditMode(false)} disabled={saving} />
              </View>
            ) : null}

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
              <Row label={t('subscription.pendingPlan')} value={record.planName} />
              <Divider />
              <Row label={t('subscription.pendingAmount')} value={`Rs. ${record.amount}`} />
              <Divider />
              <Row label={t('subscription.pendingMethod')} value={record.method.toUpperCase()} />
              <Divider />
              <Row label={t('subscription.pendingRef')} value={record.transactionRef ?? '—'} />
              {record.customerMessage ? (
                <>
                  <Divider />
                  <Row label={t('subscription.customMessageLabel')} value={record.customerMessage} />
                </>
              ) : null}
              {record.couponCode ? (
                <>
                  <Divider />
                  <Row label={t('subscription.couponCode')} value={record.couponCode} />
                </>
              ) : null}
            </View>

            {record.screenshotUrl ? (
              <View style={{ gap: spacing.xs }}>
                <Text variant="bodySmall" weight="semiBold" secondary>{t('subscription.uploadScreenshot')}</Text>
                <Image source={{ uri: record.screenshotUrl }} style={styles.screenshot} resizeMode="cover" />
              </View>
            ) : null}
          </>
        )}
      </SubpageScrollScreen>
      <PageLoaderOverlay visible={loading || saving} label={t('subscription.loading')} />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md }}>
      <Text variant="bodySmall" secondary style={{ width: 110 }}>{label}</Text>
      <Text variant="bodyLarge" weight="semiBold" style={{ flex: 1 }}>{value}</Text>
    </View>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={[styles.divider, { backgroundColor: colors.divider }]} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusBox: { borderWidth: 1 },
  adminMessageBox: { borderWidth: 1 },
  topActions: { marginBottom: 4 },
  editBox: { borderWidth: StyleSheet.hairlineWidth },
  card: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  screenshot: { width: '100%', height: 200, borderRadius: 12 },
  screenshotPreview: { width: '100%', height: 180, borderRadius: 12 },
});
