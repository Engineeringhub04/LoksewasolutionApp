// Profile → Support → Terms and Conditions.
//
// UI only — the eight clauses and the outbound link are unchanged. The clause
// number moved out of the heading into a "§n" pill so the titles read as titles,
// and each clause got an icon and its own tone instead of eight identical grey
// boxes. Copy stays English because the hosted terms it mirrors are too.
import React from 'react';
import { Linking } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from '@/src/core/i18n';
import { AppConfig } from '@/src/core/config/appConfig';
import { SubpageScrollScreen } from '@/src/components/nav/SubpageScrollScreen';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';
import { HeroBand, SectionCard, StatusPill, type Tone } from '@/src/components/premium';

const TERMS: { icon: keyof typeof Ionicons.glyphMap; tone: Tone; title: string; body: string }[] = [
  {
    icon: 'phone-portrait-outline',
    tone: 'primary',
    title: 'Using this app',
    body: `${AppConfig.identity.appName} is a study aid for Nepali government (Loksewa) exam preparation. You agree to use it for your own personal, non-commercial preparation.`,
  },
  {
    icon: 'person-circle-outline',
    tone: 'info',
    title: 'Your account',
    body: 'You are responsible for keeping your login credentials secure and for all activity that happens under your account. Please keep your profile information accurate.',
  },
  {
    icon: 'library-outline',
    tone: 'accent',
    title: 'Study content',
    body: 'Questions, notes and current affairs are provided for practice only. While we work hard on accuracy, we cannot guarantee that every item matches the official syllabus or exam. Always confirm against official sources.',
  },
  {
    icon: 'alert-circle-outline',
    tone: 'warning',
    title: 'No result guarantee',
    body: 'Using this app does not guarantee success in any examination. Your results depend on your own preparation.',
  },
  {
    icon: 'hand-left-outline',
    tone: 'danger',
    title: 'Fair use',
    body: 'Do not copy, resell, redistribute or scrape the content, attempt to break the app or its security, or post abusive material in discussions.',
  },
  {
    icon: 'chatbubbles-outline',
    tone: 'info',
    title: 'Community discussions',
    body: 'You own what you post, but you grant us permission to display it in the app. We may remove content that is abusive, misleading or off-topic.',
  },
  {
    icon: 'refresh-outline',
    tone: 'success',
    title: 'Changes',
    body: 'Features and these terms may be updated as the app grows. Continued use after an update means you accept the revised terms.',
  },
  {
    icon: 'mail-outline',
    tone: 'primary',
    title: 'Contact',
    body: `Questions about these terms? Reach us at ${AppConfig.legal.supportEmail}.`,
  },
];

export default function TermsConditionsScreen() {
  const { t } = useTranslation();

  return (
    <SubpageScrollScreen title={t('profile.termsConditions')}>
      <HeroBand
        icon="document-text"
        title={t('profile.termsConditions')}
        subtitle={`Please read these terms before continuing to use ${AppConfig.identity.appName}.`}
        tone="primary"
        footer={<StatusPill label={`${TERMS.length} clauses`} tone="info" icon="list-outline" size="sm" />}
      />

      {TERMS.map((item, index) => (
        <SectionCard
          key={item.title}
          icon={item.icon}
          title={item.title}
          tone={item.tone}
          trailing={<StatusPill label={`§${index + 1}`} tone={item.tone} size="sm" />}
        >
          <Text variant="body" secondary>{item.body}</Text>
        </SectionCard>
      ))}

      <Button label="View online version" variant="secondary" onPress={() => Linking.openURL(AppConfig.legal.termsUrl)} />
    </SubpageScrollScreen>
  );
}
