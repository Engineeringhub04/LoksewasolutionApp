// Profile → Support → App Info.
import React from 'react';
import { View, Image, Linking, Platform, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { AppConfig } from '@/src/core/config/appConfig';
import { SubpageScrollScreen } from '@/src/components/nav/SubpageScrollScreen';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';

export default function AppInfoScreen() {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();

  const rows: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }[] = [
    { icon: 'pricetag-outline', label: 'Version', value: AppConfig.identity.version },
    { icon: 'construct-outline', label: 'Build', value: String(AppConfig.identity.buildNumber) },
    { icon: 'cube-outline', label: 'Package', value: AppConfig.identity.packageId },
    { icon: 'phone-portrait-outline', label: 'Platform', value: `${Platform.OS} ${String(Platform.Version)}` },
    { icon: 'layers-outline', label: 'Expo SDK', value: Constants.expoConfig?.sdkVersion ?? 'unknown' },
  ];

  return (
    <SubpageScrollScreen title={t('profile.appInfo')}>
      <View style={styles.identityBlock}>
        <View style={[styles.logoBox, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
          <Image source={AppConfig.identity.logoAsset} style={styles.logo} resizeMode="contain" />
        </View>
        <Text variant="h3" weight="bold" style={{ marginTop: spacing.sm }}>{AppConfig.identity.appName}</Text>
        <Text variant="bodySmall" secondary>{AppConfig.identity.tagline}</Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
        {rows.map((row, index) => (
          <React.Fragment key={row.label}>
            {index > 0 ? <View style={[styles.divider, { backgroundColor: colors.divider }]} /> : null}
            <View style={[styles.row, { padding: spacing.md, gap: spacing.md }]}>
              <View style={[styles.iconBox, { backgroundColor: `${colors.primary}17`, borderRadius: radius.md }]}>
                <Ionicons name={row.icon} size={18} color={colors.primary} />
              </View>
              <Text variant="body" style={{ flex: 1 }}>{row.label}</Text>
              <Text variant="body" weight="semiBold" numberOfLines={1}>{row.value}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>

      <Text variant="body" secondary>{t('about.description')}</Text>

      <Button label={t('profile.privacyPolicy')} variant="secondary" onPress={() => Linking.openURL(AppConfig.legal.privacyPolicyUrl)} />
      <Button label={t('profile.termsConditions')} variant="secondary" onPress={() => Linking.openURL(AppConfig.legal.termsUrl)} />

      <Text variant="caption" secondary style={{ textAlign: 'center', marginTop: spacing.sm }}>
        Made for Nepali students 🇳🇵
      </Text>
    </SubpageScrollScreen>
  );
}

const styles = StyleSheet.create({
  identityBlock: { alignItems: 'center' },
  logoBox: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  logo: { width: 72, height: 72 },
  card: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
});
