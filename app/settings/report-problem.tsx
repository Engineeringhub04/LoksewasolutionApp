// §43 Report a Problem
import React, { useState } from 'react';
import { View, ScrollView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useNetworkStatus } from '@/src/core/hooks/useNetworkStatus';
import { submitProblemReport } from '@/src/core/messaging/support';
import { showToast } from '@/src/core/store/toastStore';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { Text } from '@/src/components/misc/Text';
import { Dropdown } from '@/src/components/inputs/Dropdown';
import { TextField } from '@/src/components/inputs/TextField';
import { Button } from '@/src/components/buttons/Button';
import { useManualRefresh } from '@/src/core/hooks/useManualRefresh';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';

const categories = [
  { value: 'bug', label: 'App Bug' },
  { value: 'content', label: 'Content Issue' },
  { value: 'payment', label: 'Payment Issue' },
  { value: 'other', label: 'Other' },
];

export default function ReportProblemScreen() {
  const { colors, spacing, radius } = useTheme();
  const { refreshing, onRefresh } = useManualRefresh();
  const { t } = useTranslation();
  const router = useRouter();
  const { isOffline } = useNetworkStatus();

  const [category, setCategory] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const pickScreenshot = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    if (!result.canceled && result.assets[0]) setScreenshotUri(result.assets[0].uri);
  };

  const handleSubmit = async () => {
    if (!category || !description.trim()) return;
    setSubmitting(true);
    try {
      await submitProblemReport(category, description.trim(), screenshotUri);
      showToast(t('help.reportSubmitted'), 'success');
      router.back();
    } catch {
      showToast(t('common.somethingWentWrong'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TopAppBar title={t('help.reportTitle')} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.screenPadding, gap: spacing.md }}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {isOffline ? (
          <Text variant="body" style={{ color: colors.warning }}>{t('help.offlineBlocked')}</Text>
        ) : (
          <>
            <View>
              <Text variant="bodySmall" secondary style={{ marginBottom: spacing.xs }}>{t('help.reportCategory')}</Text>
              <Dropdown options={categories} value={category} onChange={setCategory} />
            </View>
            <TextField
              label={t('help.reportDescription')}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={5}
              style={{ minHeight: 110, textAlignVertical: 'top' }}
            />
            <View>
              <Text variant="bodySmall" secondary style={{ marginBottom: spacing.xs }}>{t('help.attachScreenshot')}</Text>
              {screenshotUri ? (
                <Image source={{ uri: screenshotUri }} style={{ width: 120, height: 120, borderRadius: radius.md }} />
              ) : (
                <Button label={t('help.attachScreenshot')} variant="secondary" onPress={pickScreenshot} fullWidth={false} />
              )}
            </View>
            <Button label={t('common.submit')} onPress={handleSubmit} loading={submitting} disabled={!category || !description.trim()} />
          </>
        )}
      </ScrollView>
    </View>
  );
}
