// §42 Settings
import React, { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme, type ThemeMode } from '@/src/core/theme';
import { useTranslation, type Language } from '@/src/core/i18n';
import { AppConfig } from '@/src/core/config/appConfig';
import { logout, deleteCurrentAccount } from '@/src/core/firebase/auth';
import { isFirebaseConfigured } from '@/src/core/firebase/env';
import { seedHomeBanners } from '@/src/core/firebase/services/banners';
import { seedDeveloperData } from '@/src/core/firebase/services/developer';
import { showToast } from '@/src/core/store/toastStore';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { Text } from '@/src/components/misc/Text';
import { Divider } from '@/src/components/misc/Divider';
import { Dropdown } from '@/src/components/inputs/Dropdown';
import { ConfirmDialog } from '@/src/components/feedback/ConfirmDialog';
import { TextField } from '@/src/components/inputs/TextField';

export default function SettingsScreen() {
  const { colors, spacing, mode, setMode } = useTheme();
  const { t, language, setLanguage } = useTranslation();
  const router = useRouter();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [seedingBanners, setSeedingBanners] = useState(false);
  const [seedingDeveloper, setSeedingDeveloper] = useState(false);

  const handleSeedBanners = async () => {
    if (!isFirebaseConfigured) { showToast('Firebase is not configured', 'warning'); return; }
    setSeedingBanners(true);
    try {
      await seedHomeBanners();
      showToast('Home banners seeded', 'success');
    } catch {
      showToast('Failed to seed banners', 'error');
    } finally {
      setSeedingBanners(false);
    }
  };

  const handleSeedDeveloper = async () => {
    if (!isFirebaseConfigured) { showToast('Firebase is not configured', 'warning'); return; }
    setSeedingDeveloper(true);
    try {
      await seedDeveloperData();
      showToast('Developer profile seeded', 'success');
    } catch {
      showToast('Failed to seed developer profile', 'error');
    } finally {
      setSeedingDeveloper(false);
    }
  };

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    showToast(t('settings.languageChanged', { language: lang === 'en' ? 'English' : 'नेपाली' }), 'success');
  };

  const handleThemeChange = (next: ThemeMode) => {
    setMode(next);
    showToast(t('settings.themeUpdated'), 'success');
  };

  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    await logout();
    router.replace('/(auth)/login');
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    try {
      await deleteCurrentAccount();
      router.replace('/(auth)/login');
    } catch {
      showToast(t('common.somethingWentWrong'), 'error');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TopAppBar title={t('settings.title')} />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <SectionLabel label={t('settings.preferences')} />
        <View style={{ paddingHorizontal: spacing.screenPadding, gap: spacing.md, marginBottom: spacing.md }}>
          <Field label={t('settings.language')}>
            <Dropdown
              options={[{ value: 'en', label: 'English' }, { value: 'ne', label: 'नेपाली' }]}
              value={language}
              onChange={handleLanguageChange}
            />
          </Field>
          <Field label={t('settings.theme')}>
            <Dropdown
              options={[
                { value: 'light', label: t('settings.light') },
                { value: 'dark', label: t('settings.dark') },
                { value: 'system', label: t('settings.system') },
              ]}
              value={mode}
              onChange={handleThemeChange}
            />
          </Field>
        </View>

        <Divider style={{ marginHorizontal: spacing.screenPadding }} />
        <SectionLabel label={t('settings.support')} />
        <MenuRow icon="help-buoy-outline" label={t('settings.reportProblem')} onPress={() => router.push('/settings/report-problem')} />
        <MenuRow icon="mail-outline" label={t('settings.contactUs')} onPress={() => router.push('/settings/help-center')} />

        <Divider style={{ marginHorizontal: spacing.screenPadding }} />
        <SectionLabel label={t('settings.about')} />
        <MenuRow icon="information-circle-outline" label={t('settings.about')} onPress={() => router.push('/about')} />
        <View style={{ paddingHorizontal: spacing.screenPadding, paddingVertical: spacing.sm }}>
          <Text variant="bodySmall" secondary>{t('settings.version')}: {AppConfig.identity.version}</Text>
        </View>

        <Divider style={{ marginHorizontal: spacing.screenPadding }} />
        <SectionLabel label="Data Setup (Dev)" />
        <MenuRow icon="images-outline" label={seedingBanners ? 'Seeding Banners...' : 'Seed Home Banners'} onPress={handleSeedBanners} />
        <MenuRow icon="person-circle-outline" label={seedingDeveloper ? 'Seeding Developer...' : 'Seed Developer Profile'} onPress={handleSeedDeveloper} />

        <Divider style={{ marginHorizontal: spacing.screenPadding }} />
        <SectionLabel label={t('settings.account')} />
        <MenuRow icon="trash-outline" label={t('settings.deleteAccount')} danger onPress={() => setShowDeleteConfirm(true)} />

        <Divider style={{ marginHorizontal: spacing.screenPadding }} />
        <MenuRow icon="log-out-outline" label={t('settings.logout')} danger onPress={() => setShowLogoutConfirm(true)} />
      </ScrollView>

      <ConfirmDialog
        visible={showLogoutConfirm}
        title={t('settings.logout')}
        message={t('profile.logoutConfirm')}
        destructive
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />

      <ConfirmDialog
        visible={showDeleteConfirm}
        title={t('settings.deleteAccount')}
        message={t('settings.deleteAccountWarning')}
        destructive
        confirmLabel={t('settings.deleteAccount')}
        onConfirm={handleDeleteAccount}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setDeleteConfirmText('');
        }}
      />
      {showDeleteConfirm ? (
        <View style={{ position: 'absolute', bottom: spacing.xxl * 2, left: spacing.xl, right: spacing.xl }}>
          <TextField
            label={t('settings.typeDeleteToConfirm')}
            value={deleteConfirmText}
            onChangeText={setDeleteConfirmText}
            autoCapitalize="characters"
          />
        </View>
      ) : null}
    </View>
  );
}

function SectionLabel({ label }: { label: string }) {
  const { spacing } = useTheme();
  return (
    <View style={{ paddingHorizontal: spacing.screenPadding, paddingTop: spacing.md, paddingBottom: spacing.xs }}>
      <Text variant="bodySmall" weight="semiBold" secondary>{label}</Text>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { spacing } = useTheme();
  return (
    <View>
      <Text variant="bodySmall" secondary style={{ marginBottom: spacing.xs }}>{label}</Text>
      {children}
    </View>
  );
}

function MenuRow({ icon, label, onPress, danger }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; danger?: boolean }) {
  const { colors, spacing } = useTheme();
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.screenPadding, paddingVertical: spacing.md }}>
      <Ionicons name={icon} size={20} color={danger ? colors.error : colors.primary} />
      <Text variant="body" style={{ flex: 1, color: danger ? colors.error : colors.textPrimary }}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}
