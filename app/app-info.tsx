// App Info — reached from Profile → More, and from Home → App Guide.
// One shared screen so both entry points always show the same thing.
//
// Deliberately contains NO build/package/SDK internals: those are developer
// details, not user-facing. Only the app version is shown.
//
// UI only — same content, same links. Every block now uses the shared kit
// instead of six hand-rolled `card` + `divider` + `iconBox` copies, the
// highlights each carry their own tone rather than one repeated blue tint, and
// the X brand colour flips with the theme (#0F1419 was invisible in dark mode).
import React from 'react';
import { View, Image, Linking, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { AppConfig } from '@/src/core/config/appConfig';
import { SubpageScrollScreen } from '@/src/components/nav/SubpageScrollScreen';
import { Text } from '@/src/components/misc/Text';
import { SectionCard, ActionRow, StatusPill, useTones, type Tone } from '@/src/components/premium';

const HIGHLIGHTS: { icon: keyof typeof Ionicons.glyphMap; tone: Tone; title: string; body: string }[] = [
  { icon: 'library-outline', tone: 'primary', title: 'Complete syllabus', body: 'Subject-wise notes and chapters mapped to the Loksewa syllabus.' },
  { icon: 'timer-outline', tone: 'danger', title: 'Mock tests & quizzes', body: 'Timed practice with instant scoring and detailed explanations.' },
  { icon: 'newspaper-outline', tone: 'warning', title: 'Daily current affairs', body: 'Gorkhapatra highlights and a fresh question every day.' },
  { icon: 'stats-chart-outline', tone: 'info', title: 'Progress analytics', body: 'See your strong and weak subjects as you prepare.' },
  { icon: 'people-outline', tone: 'success', title: 'Discussion forum', body: 'Ask questions and learn together with other aspirants.' },
];

export default function AppInfoScreen() {
  const { colors, spacing, radius, effective } = useTheme();
  const { t } = useTranslation();
  const tones = useTones();
  const isDark = effective === 'dark';

  // Each platform rendered in its own brand colour rather than a uniform tint.
  const socials: { icon: keyof typeof Ionicons.glyphMap; label: string; url: string; color: string }[] = [
    { icon: 'logo-facebook', label: 'Facebook', url: AppConfig.links.facebook, color: '#1877F2' },
    { icon: 'logo-youtube', label: 'YouTube', url: AppConfig.links.youtube, color: '#FF0000' },
    { icon: 'logo-instagram', label: 'Instagram', url: AppConfig.links.instagram, color: '#E4405F' },
    { icon: 'logo-twitter', label: 'X', url: AppConfig.links.twitter, color: isDark ? '#E7E9EA' : '#0F1419' },
  ];

  const contactRows: { icon: keyof typeof Ionicons.glyphMap; tone: Tone; label: string; value: string; onPress: () => void }[] = [
    {
      icon: 'globe-outline',
      tone: 'info',
      label: 'Website',
      value: AppConfig.links.website.replace(/^https?:\/\//, ''),
      onPress: () => Linking.openURL(AppConfig.links.website),
    },
    {
      icon: 'mail-outline',
      tone: 'primary',
      label: 'Support',
      value: AppConfig.legal.supportEmail,
      onPress: () => Linking.openURL(`mailto:${AppConfig.legal.supportEmail}`),
    },
  ];

  return (
    <SubpageScrollScreen title={t('profile.appInfo')}>
      {/* Identity — the logo sits on the same tone-to-transparent wash HeroBand
          uses, so this one bespoke block still belongs to the kit's family. */}
      <LinearGradient
        colors={[tones.primary.bg, `${colors.surface}00`] as const}
        style={[styles.identityBlock, { borderRadius: radius.lg, padding: spacing.lg }]}
      >
        <Image source={AppConfig.identity.logoAsset} style={styles.logo} resizeMode="cover" />
        <Text variant="h2" weight="bold" style={{ marginTop: spacing.sm, textAlign: 'center' }}>
          {AppConfig.identity.appName}
        </Text>
        <Text variant="bodySmall" secondary style={{ textAlign: 'center' }}>
          {AppConfig.identity.tagline}
        </Text>
        <View style={{ marginTop: spacing.sm }}>
          <StatusPill
            label={`${t('settings.version')} ${AppConfig.identity.version}`}
            tone="primary"
            icon="checkmark-circle"
          />
        </View>
      </LinearGradient>

      <SectionCard icon="information-circle-outline" title={t('about.title')} tone="primary">
        <Text variant="body" secondary style={{ lineHeight: 22 }}>{t('about.description')}</Text>
      </SectionCard>

      <SectionCard icon="sparkles-outline" title="What you get" tone="accent" style={{ paddingBottom: spacing.sm }}>
        {HIGHLIGHTS.map((item, index) => (
          <ActionRow
            key={item.title}
            icon={item.icon}
            title={item.title}
            subtitle={item.body}
            tone={item.tone}
            divider={index < HIGHLIGHTS.length - 1}
          />
        ))}
      </SectionCard>

      <SectionCard icon="headset-outline" title="Reach us" tone="info" style={{ paddingBottom: spacing.sm }}>
        {contactRows.map((row, index) => (
          <ActionRow
            key={row.label}
            icon={row.icon}
            title={row.label}
            subtitle={row.value}
            tone={row.tone}
            onPress={row.onPress}
            divider={index < contactRows.length - 1}
            trailing={<Ionicons name="open-outline" size={18} color={colors.textDisabled} />}
          />
        ))}
      </SectionCard>

      <SectionCard icon="share-social-outline" title={t('about.followUs')} tone="success">
        <View style={styles.socialRow}>
          {socials.map((social) => (
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
                  transform: [{ scale: pressed ? 0.94 : 1 }],
                },
              ]}
            >
              <Ionicons name={social.icon} size={24} color={social.color} />
              <Text variant="caption" weight="semiBold" style={{ color: social.color }}>{social.label}</Text>
            </Pressable>
          ))}
        </View>
      </SectionCard>

      <SectionCard icon="lock-closed-outline" title="Legal" tone="neutral" style={{ paddingBottom: spacing.sm }}>
        <ActionRow
          icon="shield-checkmark-outline"
          title={t('profile.privacyPolicy')}
          tone="neutral"
          onPress={() => Linking.openURL(AppConfig.legal.privacyPolicyUrl)}
          divider
        />
        <ActionRow
          icon="document-text-outline"
          title={t('profile.termsConditions')}
          tone="neutral"
          onPress={() => Linking.openURL(AppConfig.legal.termsUrl)}
        />
      </SectionCard>

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
    borderRadius: 24,
  },
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
