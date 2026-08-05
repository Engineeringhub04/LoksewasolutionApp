// Profile → Support → Terms and Conditions.
import React from 'react';
import { View, Linking, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { AppConfig } from '@/src/core/config/appConfig';
import { SubpageScrollScreen } from '@/src/components/nav/SubpageScrollScreen';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';

const TERMS: { title: string; body: string }[] = [
  {
    title: '1. Using this app',
    body: `${AppConfig.identity.appName} is a study aid for Nepali government (Loksewa) exam preparation. You agree to use it for your own personal, non-commercial preparation.`,
  },
  {
    title: '2. Your account',
    body: 'You are responsible for keeping your login credentials secure and for all activity that happens under your account. Please keep your profile information accurate.',
  },
  {
    title: '3. Study content',
    body: 'Questions, notes and current affairs are provided for practice only. While we work hard on accuracy, we cannot guarantee that every item matches the official syllabus or exam. Always confirm against official sources.',
  },
  {
    title: '4. No result guarantee',
    body: 'Using this app does not guarantee success in any examination. Your results depend on your own preparation.',
  },
  {
    title: '5. Fair use',
    body: 'Do not copy, resell, redistribute or scrape the content, attempt to break the app or its security, or post abusive material in discussions.',
  },
  {
    title: '6. Community discussions',
    body: 'You own what you post, but you grant us permission to display it in the app. We may remove content that is abusive, misleading or off-topic.',
  },
  {
    title: '7. Changes',
    body: 'Features and these terms may be updated as the app grows. Continued use after an update means you accept the revised terms.',
  },
  {
    title: '8. Contact',
    body: `Questions about these terms? Reach us at ${AppConfig.legal.supportEmail}.`,
  },
];

export default function TermsConditionsScreen() {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();

  return (
    <SubpageScrollScreen title={t('profile.termsConditions')}>
      <View style={[styles.hero, { backgroundColor: `${colors.primary}14`, borderRadius: radius.lg, padding: spacing.md }]}>
        <Ionicons name="document-text" size={26} color={colors.primary} />
        <Text variant="bodySmall" secondary style={{ flex: 1 }}>
          Please read these terms before continuing to use {AppConfig.identity.appName}.
        </Text>
      </View>

      {TERMS.map((item) => (
        <View
          key={item.title}
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }]}
        >
          <Text variant="bodyLarge" weight="bold">{item.title}</Text>
          <Text variant="body" secondary style={{ marginTop: spacing.xs }}>{item.body}</Text>
        </View>
      ))}

      <Button label="View online version" variant="secondary" onPress={() => Linking.openURL(AppConfig.legal.termsUrl)} />
    </SubpageScrollScreen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  card: { borderWidth: StyleSheet.hairlineWidth },
});
