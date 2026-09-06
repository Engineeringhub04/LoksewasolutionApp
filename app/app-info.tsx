// App Info — reached from Profile → More, and from Home → App Guide.
// One shared screen so both entry points always show the same thing.
//
// Deliberately contains NO build/package/SDK internals: those are developer
// details, not user-facing. Only the app version is shown.
import React from 'react';
import { View, Image, Linking, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { AppConfig } from '@/src/core/config/appConfig';
import { SubpageScrollScreen } from '@/src/components/nav/SubpageScrollScreen';
import { Text } from '@/src/components/misc/Text';

// Each platform rendered in its own brand colour rather than a uniform tint.
const SOCIALS: { icon: keyof typeof Ionicons.glyphMap; label: string; url: string; color: string }[] = [
  { icon: 'logo-facebook', label: 'Facebook', url: AppConfig.links.facebook, color: '#1877F2' },
  { icon: 'logo-youtube', label: 'YouTube', url: AppConfig.links.youtube, color: '#FF0000' },
  { icon: 'logo-instagram', label: 'Instagram', url: AppConfig.links.instagram, color: '#E4405F' },
  { icon: 'logo-twitter', label: 'X', url: AppConfig.links.twitter, color: '#0F1419' },
];

const HIGHLIGHTS: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  { icon: 'library-outline', title: 'Complete syllabus', body: 'Subject-wise notes and chapters mapped to the Loksewa syllabus.' },
  { icon: 'timer-outline', title: 'Mock tests & quizzes', body: 'Timed practice with instant scoring and detailed explanations.' },
  { icon: 'newspaper-outline', title: 'Daily current affairs', body: 'Gorkhapatra highlights and a fresh question every day.' },
  { icon: 'stats-chart-outline', title: 'Progress analytics', body: 'See your strong and weak subjects as you prepare.' },
  { icon: 'people-outline', title: 'Discussion forum', body: 'Ask questions and learn together with other aspirants.' },
];

export default function AppInfoScreen() {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();

  const contactRows: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; onPress: () => void }[] = [
    {
      icon: 'globe-outline',
      label: 'Website',
      value: AppConfig.links.website.replace(/^https?:\/\//, ''),
      onPress: () => Linking.openURL(AppConfig.links.website),
    },
    {
      icon: 'mail-outline',
      label: 'Support',
      value: AppConfig.legal.supportEmail,
      onPress: () => Linking.openURL(`mailto:${AppConfig.legal.supportEmail}`),
    },
  ];

  return (
    <SubpageScrollScreen title={t('profile.appInfo')}>
      {/* Identity — logo circle-cropped, no card behind it */}
      <View style={styles.identityBlock}>
        <Image source={AppConfig.identity.logoAsset} style={styles.logo} resizeMode="cover" />
        <Text variant="h2" weight="bold" style={{ marginTop: spacing.sm, textAlign: 'center' }}>
          {AppConfig.identity.appName}
        </Text>
        <Text variant="bodySmall" secondary style={{ textAlign: 'center' }}>
          {AppConfig.identity.tagline}
        </Text>
        <View style={[styles.versionPill, { backgroundColor: `${colors.primary}17`, borderColor: `${colors.primary}44` }]}>
          <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
          <Text variant="caption" weight="bold" style={{ color: colors.primary }}>
            {t('settings.version')} {AppConfig.identity.version}
          </Text>
        </View>
      </View>

      {/* About */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }]}>
        <Text variant="body" secondary style={{ textAlign: 'center', lineHeight: 22 }}>
          {t('about.description')}
        </Text>
      </View>

      {/* Highlights */}
      <Text variant="bodyLarge" weight="bold" style={{ marginTop: spacing.xs }}>What you get</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
        {HIGHLIGHTS.map((item, index) => (
          <React.Fragment key={item.title}>
            {index > 0 ? <View style={[styles.divider, { backgroundColor: colors.divider }]} /> : null}
            <View style={[styles.row, { padding: spacing.md, gap: spacing.md }]}>
              <View style={[styles.iconBox, { backgroundColor: `${colors.primary}17`, borderRadius: radius.md }]}>
                <Ionicons name={item.icon} size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="body" weight="bold">{item.title}</Text>
                <Text variant="bodySmall" secondary>{item.body}</Text>
              </View>
            </View>
          </React.Fragment>
        ))}
      </View>

      {/* Contact */}
      <Text variant="bodyLarge" weight="bold" style={{ marginTop: spacing.xs }}>Reach us</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
        {contactRows.map((row, index) => (
          <React.Fragment key={row.label}>
            {index > 0 ? <View style={[styles.divider, { backgroundColor: colors.divider }]} /> : null}
            <Pressable
              onPress={row.onPress}
              style={({ pressed }) => [styles.row, { padding: spacing.md, gap: spacing.md }, pressed && styles.pressed]}
            >
              <View style={[styles.iconBox, { backgroundColor: `${colors.primary}17`, borderRadius: radius.md }]}>
                <Ionicons name={row.icon} size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="caption" secondary>{row.label}</Text>
                <Text variant="body" weight="semiBold" numberOfLines={1}>{row.value}</Text>
              </View>
              <Ionicons name="open-outline" size={18} color={colors.textSecondary} />
            </Pressable>
          </React.Fragment>
        ))}
      </View>

      {/* Socials — brand colours */}
      <Text variant="bodyLarge" weight="bold" style={{ marginTop: spacing.xs }}>{t('about.followUs')}</Text>
      <View style={styles.socialRow}>
        {SOCIALS.map((social) => (
          <Pressable
            key={social.label}
            onPress={() => Linking.openURL(social.url)}
            accessibilityLabel={social.label}
            style={({ pressed }) => [
              styles.socialButton,
              {
                backgroundColor: `${social.color}14`,
                borderColor: `${social.color}55`,
                borderRadius: radius.md,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Ionicons name={social.icon} size={24} color={social.color} />
            <Text variant="caption" weight="semiBold" style={{ color: social.color }}>{social.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Legal */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
        <Pressable
          onPress={() => Linking.openURL(AppConfig.legal.privacyPolicyUrl)}
          style={({ pressed }) => [styles.row, { padding: spacing.md, gap: spacing.md }, pressed && styles.pressed]}
        >
          <Ionicons name="shield-checkmark-outline" size={20} color={colors.textSecondary} />
          <Text variant="body" style={{ flex: 1 }}>{t('profile.privacyPolicy')}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </Pressable>
        <View style={[styles.divider, { backgroundColor: colors.divider }]} />
        <Pressable
          onPress={() => Linking.openURL(AppConfig.legal.termsUrl)}
          style={({ pressed }) => [styles.row, { padding: spacing.md, gap: spacing.md }, pressed && styles.pressed]}
        >
          <Ionicons name="document-text-outline" size={20} color={colors.textSecondary} />
          <Text variant="body" style={{ flex: 1 }}>{t('profile.termsConditions')}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      <Text variant="caption" secondary style={{ textAlign: 'center', marginTop: spacing.sm }}>
        Made for Nepali students 🇳🇵
      </Text>
    </SubpageScrollScreen>
  );
}

const styles = StyleSheet.create({
  identityBlock: { alignItems: 'center' },
  // Circle-cropped: resizeMode 'cover' + a radius of half the size crops the
  // artwork into the circle instead of letter-boxing it inside a card.
  logo: {
    width: 108,
    height: 108,
    borderRadius: 54,
  },
  versionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  card: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.65 },
  socialRow: { flexDirection: 'row', gap: 8 },
  socialButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    borderWidth: 1,
  },
});
