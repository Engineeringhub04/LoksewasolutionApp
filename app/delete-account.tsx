// Profile → App Settings → Delete account.
//
// Replaces the cramped inline flow that used to live inside /settings, where the
// "type DELETE to confirm" field was rendered underneath the modal and was
// effectively unusable.
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { useNetworkStatus } from '@/src/core/hooks/useNetworkStatus';
import { deleteCurrentAccount } from '@/src/core/firebase/auth';
import { deleteUserProfileDoc } from '@/src/core/firebase/services/profile';
import { showToast } from '@/src/core/store/toastStore';
import { SubpageScrollScreen } from '@/src/components/nav/SubpageScrollScreen';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';
import { FloatingLabelField } from '@/src/components/inputs/FloatingLabelField';
import { ConfirmDialog } from '@/src/components/feedback/ConfirmDialog';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';

const CONFIRM_WORD = 'DELETE';

export default function DeleteAccountScreen() {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { isOffline } = useNetworkStatus();

  const [confirmText, setConfirmText] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const matches = confirmText.trim().toUpperCase() === CONFIRM_WORD;

  const losses: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
    { icon: 'person-circle-outline', text: t('deleteAccount.lossProfile') },
    { icon: 'bar-chart-outline', text: t('deleteAccount.lossProgress') },
    { icon: 'bookmark-outline', text: t('deleteAccount.lossBookmarks') },
    { icon: 'chatbubbles-outline', text: t('deleteAccount.lossDiscussions') },
  ];

  const handleDelete = async () => {
    setShowConfirm(false);
    if (!user) return;
    setDeleting(true);
    try {
      // Remove the stored profile data first — once the auth identity is gone
      // the request would no longer be authorised to touch the document.
      await deleteUserProfileDoc(user.uid).catch(() => {});
      await deleteCurrentAccount();
      showToast(t('deleteAccount.deleted'), 'success');
      router.replace('/(auth)/login');
    } catch {
      showToast(t('deleteAccount.failed'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <SubpageScrollScreen title={t('profile.deleteAccount')}>
        <View style={[styles.warningBox, { backgroundColor: `${colors.error}14`, borderColor: colors.error, borderRadius: radius.lg, padding: spacing.md }]}>
          <Ionicons name="warning" size={26} color={colors.error} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="bodyLarge" weight="bold" style={{ color: colors.error }}>
              {t('deleteAccount.warningTitle')}
            </Text>
            <Text variant="bodySmall" secondary>{t('deleteAccount.warningBody')}</Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }]}>
          <Text variant="bodyLarge" weight="bold">{t('deleteAccount.whatYouLose')}</Text>
          <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
            {losses.map((item) => (
              <View key={item.text} style={styles.lossRow}>
                <Ionicons name={item.icon} size={18} color={colors.error} />
                <Text variant="body" secondary style={{ flex: 1 }}>{item.text}</Text>
              </View>
            ))}
          </View>
        </View>

        {user?.email ? (
          <View style={[styles.accountBox, { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md }]}>
            <Text variant="caption" secondary>{t('deleteAccount.accountLabel')}</Text>
            <Text variant="bodyLarge" weight="semiBold" numberOfLines={1}>{user.email}</Text>
          </View>
        ) : null}

        {isOffline ? (
          <Text variant="bodySmall" style={{ color: colors.warning }}>{t('common.noInternet')}</Text>
        ) : (
          <>
            <FloatingLabelField
              label={t('deleteAccount.typeToConfirm', { word: CONFIRM_WORD })}
              value={confirmText}
              onChangeText={setConfirmText}
              autoCapitalize="characters"
              autoCorrect={false}
              leftIcon="alert-circle-outline"
            />
            <Button
              label={t('deleteAccount.deleteButton')}
              variant="danger"
              onPress={() => setShowConfirm(true)}
              disabled={!matches || deleting}
            />
          </>
        )}

        <Button label={t('common.cancel')} variant="text" onPress={() => router.back()} />
      </SubpageScrollScreen>

      <PageLoaderOverlay visible={deleting} label={t('deleteAccount.deleting')} />

      <ConfirmDialog
        visible={showConfirm}
        title={t('deleteAccount.confirmTitle')}
        message={t('deleteAccount.confirmMessage')}
        confirmLabel={t('deleteAccount.deleteButton')}
        destructive
        onConfirm={handleDelete}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  warningBox: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1 },
  card: { borderWidth: StyleSheet.hairlineWidth },
  lossRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  accountBox: { gap: 2 },
});
