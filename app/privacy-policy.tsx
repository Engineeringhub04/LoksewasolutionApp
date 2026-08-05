// Profile → App Settings → Privacy Policy.
// Shows a readable in-app summary and links out to the full hosted policy.
import React from 'react';
import { View, Linking, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { AppConfig } from '@/src/core/config/appConfig';
import { SubpageScrollScreen } from '@/src/components/nav/SubpageScrollScreen';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';

const SECTIONS: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  {
    icon: 'document-text-outline',
    title: 'What we collect',
    body: 'Your name, email address and — only if you choose to add them — your date of birth, gender and profile photo. We also store your selected course so the app can show relevant content.',
  },
  {
    icon: 'bar-chart-outline',
    title: 'Study data',
    body: 'Your quiz and mock test attempts, scores, bookmarks and notes are saved to your account so your progress follows you across devices.',
  },
  {
    icon: 'lock-closed-outline',
    title: 'How it is protected',
    body: 'Your data is stored in Google Firebase and is readable only by your own signed-in account. We never sell your personal information to anyone.',
  },
  {
    icon: 'share-social-outline',
    title: 'What we never do',
    body: 'We do not sell, rent or trade your personal data. Aggregated, anonymous statistics may be used to improve the app, but these can never identify you.',
  },
  {
    icon: 'trash-outline',
    title: 'Your control',
    body: 'You can edit your profile at any time, and you can permanently delete your account and its data from Profile → Delete Account.',
  },
];

export default function PrivacyPolicyScreen() {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();

  return (
    <SubpageScrollScreen title={t('profile.privacyPolicy')}>
      <View style={[styles.hero, { backgroundColor: `${colors.primary}14`, borderRadius: radius.lg, padding: spacing.md }]}>
        <Ionicons name="shield-checkmark" size={26} color={colors.primary} />
        <Text variant="bodySmall" secondary style={{ flex: 1 }}>
          Your privacy matters. Here is exactly what {AppConfig.identity.appName} stores and why.
        </Text>
      </View>

      {SECTIONS.map((section) => (
        <View
          key={section.title}
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }]}
        >
          <View style={styles.cardHead}>
            <View style={[styles.iconBox, { backgroundColor: `${colors.primary}17`, borderRadius: radius.md }]}>
              <Ionicons name={section.icon} size={18} color={colors.primary} />
            </View>
            <Text variant="bodyLarge" weight="bold" style={{ flex: 1 }}>{section.title}</Text>
          </View>
          <Text variant="body" secondary style={{ marginTop: spacing.sm }}>{section.body}</Text>
        </View>
      ))}

      <Button
        label="Read the full policy online"
        variant="secondary"
        onPress={() => Linking.openURL(AppConfig.legal.privacyPolicyUrl)}
      />
      <Text variant="caption" secondary style={{ textAlign: 'center' }}>
        {AppConfig.legal.privacyPolicyUrl}
      </Text>
    </SubpageScrollScreen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  card: { borderWidth: StyleSheet.hairlineWidth },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
});
