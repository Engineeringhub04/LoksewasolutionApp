// §39 Profile
import React, { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { logout } from '@/src/core/firebase/auth';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchAttemptHistory } from '@/src/core/firebase/services/exams';
import { Text } from '@/src/components/misc/Text';
import { Avatar } from '@/src/components/misc/Avatar';
import { Divider } from '@/src/components/misc/Divider';
import { ConfirmDialog } from '@/src/components/feedback/ConfirmDialog';

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  labelKey: string;
  route: string;
}

const menuItems: MenuItem[] = [
  { icon: 'create-outline', labelKey: 'profile.editProfile', route: '/edit-profile' },
  { icon: 'ribbon-outline', labelKey: 'profile.achievements', route: '/achievements' },
  { icon: 'analytics-outline', labelKey: 'profile.analytics', route: '/analytics' },
  { icon: 'time-outline', labelKey: 'profile.examHistory', route: '/exam-history' },
  { icon: 'settings-outline', labelKey: 'profile.settings', route: '/settings' },
  { icon: 'help-buoy-outline', labelKey: 'profile.helpCenter', route: '/settings/help-center' },
];

export default function ProfileScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const { data: attempts } = useAsyncData(async () => {
    if (!user) return [];
    return fetchAttemptHistory(user.uid);
  }, [user?.uid]);

  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <View style={{ alignItems: 'center', paddingTop: insets.top + spacing.xl, paddingBottom: spacing.lg, gap: spacing.sm }}>
        <Avatar uri={user?.photoURL} name={user?.displayName ?? undefined} size={88} />
        <Text variant="h2" weight="bold">{user?.displayName ?? ''}</Text>
        <Text variant="body" secondary>{user?.email}</Text>

        <View style={{ flexDirection: 'row', gap: spacing.xl, marginTop: spacing.md }}>
          <Stat label={t('profile.testsTaken')} value={attempts?.length ?? 0} />
          <Stat label={t('profile.streak')} value={0} />
          <Stat label={t('profile.rank')} value="—" />
        </View>
      </View>

      <Divider style={{ marginHorizontal: spacing.screenPadding }} />

      <View style={{ paddingHorizontal: spacing.screenPadding, paddingTop: spacing.md }}>
        {menuItems.map((item) => (
          <Pressable
            key={item.labelKey}
            onPress={() => router.push(item.route as never)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}
          >
            <Ionicons name={item.icon} size={22} color={colors.primary} />
            <Text variant="bodyLarge" style={{ flex: 1 }}>{t(item.labelKey)}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>
        ))}
        <Pressable
          onPress={() => setShowLogoutConfirm(true)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}
        >
          <Ionicons name="log-out-outline" size={22} color={colors.error} />
          <Text variant="bodyLarge" style={{ color: colors.error }}>{t('profile.logout')}</Text>
        </Pressable>
      </View>

      <ConfirmDialog
        visible={showLogoutConfirm}
        title={t('profile.logout')}
        message={t('profile.logoutConfirm')}
        destructive
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text variant="h3" weight="bold">{value}</Text>
      <Text variant="caption" secondary>{label}</Text>
    </View>
  );
}
