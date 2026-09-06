// §44 About / Privacy Policy / Terms
import React from 'react';
import { View, ScrollView, Image, Linking } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { AppConfig } from '@/src/core/config/appConfig';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { Text } from '@/src/components/misc/Text';
import { IconButton } from '@/src/components/buttons/IconButton';
import { useManualRefresh } from '@/src/core/hooks/useManualRefresh';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';

const socialLinks: { icon: keyof typeof Ionicons.glyphMap; url: string }[] = [
  { icon: 'logo-facebook', url: AppConfig.links.facebook },
  { icon: 'logo-youtube', url: AppConfig.links.youtube },
  { icon: 'logo-instagram', url: AppConfig.links.instagram },
  { icon: 'logo-twitter', url: AppConfig.links.twitter },
];

export default function AboutScreen() {
  const { colors, spacing } = useTheme();
  const { refreshing, onRefresh } = useManualRefresh();
  const { t } = useTranslation();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TopAppBar title={t('about.title')} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.screenPadding, alignItems: 'center', gap: spacing.md }}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Image source={AppConfig.identity.logoAsset} style={{ width: 72, height: 72, borderRadius: 16 }} />
        <Text variant="h2" weight="bold">{AppConfig.identity.appName}</Text>
        <Text variant="bodySmall" secondary>{t('settings.version')} {AppConfig.identity.version}</Text>
        <Text variant="body" secondary style={{ textAlign: 'center' }}>{t('about.description')}</Text>

        <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm }}>
          {socialLinks.map((link) => (
            <IconButton key={link.url} name={link.icon} accessibilityLabel={link.url} onPress={() => Linking.openURL(link.url)} />
          ))}
        </View>

        <View style={{ gap: spacing.sm, marginTop: spacing.lg, alignItems: 'center' }}>
          <Text variant="body" style={{ color: colors.primary }} onPress={() => Linking.openURL(AppConfig.legal.privacyPolicyUrl)}>
            {t('settings.privacyPolicy')}
          </Text>
          <Text variant="body" style={{ color: colors.primary }} onPress={() => Linking.openURL(AppConfig.legal.termsUrl)}>
            {t('settings.termsConditions')}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
