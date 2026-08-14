import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useProfileStore } from '@/src/core/store/profileStore';
import { seedCivilSubEngineerLearningCatalog } from '@/src/core/firebase/services/learning';
import { showToast } from '@/src/core/store/toastStore';
import { SubpageScrollScreen } from '@/src/components/nav/SubpageScrollScreen';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';
import { ConfirmDialog } from '@/src/components/feedback/ConfirmDialog';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';

export default function AdminLearningSeedScreen() {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const isAdmin = useProfileStore((state) => state.profile?.isAdmin === true);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const handleSeed = async () => {
    setConfirmVisible(false);
    setSeeding(true);
    try {
      const count = await seedCivilSubEngineerLearningCatalog();
      showToast(`${t('learning.seedSuccess')} ${count} ${t('learning.seededRecords')}`);
    } catch {
      showToast(t('learning.seedFailed'));
    } finally {
      setSeeding(false);
    }
  };

  if (!isAdmin) {
    return (
      <SubpageScrollScreen title={t('learning.seedTitle')}>
        <View style={[styles.center, { padding: spacing.xl }]}>
          <Ionicons name="lock-closed-outline" size={48} color={colors.textSecondary} />
          <Text variant="body" secondary style={{ textAlign: 'center' }}>{t('common.somethingWentWrong')}</Text>
          <Button label={t('common.back')} variant="secondary" onPress={() => router.back()} />
        </View>
      </SubpageScrollScreen>
    );
  }

  return (
    <>
      <SubpageScrollScreen title={t('learning.seedTitle')}>
        <View style={{ gap: spacing.md }}>
          <View style={[styles.hero, { backgroundColor: `${colors.primary}12`, borderColor: colors.primary, borderRadius: radius.lg, padding: spacing.lg }]}>
            <View style={[styles.iconBox, { backgroundColor: colors.primary, borderRadius: radius.md }]}>
              <Ionicons name="library-outline" size={24} color={colors.onPrimary} />
            </View>
            <Text variant="h3" weight="bold">{t('learning.seedTitle')}</Text>
            <Text variant="body" secondary>{t('learning.seedSubtitle')}</Text>
          </View>

          <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }]}>
            <View style={styles.row}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.success} />
              <Text variant="bodySmall" weight="semiBold" style={{ flex: 1 }}>{t('learning.seedCatalogHint')}</Text>
            </View>
            <Text variant="caption" secondary>
              {t('learning.subjects')}: 3 · {t('learning.units')}: 13 · {t('learning.chapters')}: 63
            </Text>
          </View>

          <Button
            label={t('learning.seedCatalog')}
            onPress={() => setConfirmVisible(true)}
            icon={<Ionicons name="cloud-upload-outline" size={20} color={colors.onPrimary} />}
          />
        </View>
      </SubpageScrollScreen>

      <PageLoaderOverlay visible={seeding} label={t('common.loading')} />
      <ConfirmDialog
        visible={confirmVisible}
        title={t('learning.seedCatalog')}
        message={t('learning.seedConfirm')}
        onConfirm={handleSeed}
        onCancel={() => setConfirmVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  hero: { borderWidth: 1.5, gap: 10 },
  infoCard: { borderWidth: StyleSheet.hairlineWidth, gap: 10 },
  iconBox: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 14 },
});
