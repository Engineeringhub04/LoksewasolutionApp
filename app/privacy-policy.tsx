// Profile → App Settings → Privacy Policy.
// Shows a readable in-app summary and links out to the full hosted policy.
//
// UI only — same five sections, same outbound link. The old page hung every
// card off `${colors.primary}14` / `${colors.primary}17`, so the whole screen
// was one flat blue wash; each section now carries its own tone from the shared
// system, which gives the page rhythm and keeps the contrast right in both
// themes. Copy stays English because the hosted policy it summarises is too.
import React from 'react';
import { View, Linking } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { AppConfig } from '@/src/core/config/appConfig';
import { SubpageScrollScreen } from '@/src/components/nav/SubpageScrollScreen';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';
import { HeroBand, SectionCard, StatusPill, QuotePanel, type Tone } from '@/src/components/premium';

const SECTIONS: { icon: keyof typeof Ionicons.glyphMap; tone: Tone; title: string; body: string }[] = [
  {
    icon: 'document-text-outline',
    tone: 'primary',
    title: 'What we collect',
    body: 'Your name, email address and — only if you choose to add them — your date of birth, gender and profile photo. We also store your selected course so the app can show relevant content.',
  },
  {
    icon: 'bar-chart-outline',
    tone: 'info',
    title: 'Study data',
    body: 'Your quiz and mock test attempts, scores, bookmarks and notes are saved to your account so your progress follows you across devices.',
  },
  {
    icon: 'lock-closed-outline',
    tone: 'success',
    title: 'How it is protected',
    body: 'Your data is stored in Google Firebase and is readable only by your own signed-in account. We never sell your personal information to anyone.',
  },
  {
    icon: 'share-social-outline',
    tone: 'warning',
    title: 'What we never do',
    body: 'We do not sell, rent or trade your personal data. Aggregated, anonymous statistics may be used to improve the app, but these can never identify you.',
  },
  {
    icon: 'trash-outline',
    tone: 'danger',
    title: 'Your control',
    body: 'You can edit your profile at any time, and you can permanently delete your account and its data from Profile → Delete Account.',
  },
];

export default function PrivacyPolicyScreen() {
  const { spacing } = useTheme();
  const { t } = useTranslation();

  return (
    <SubpageScrollScreen title={t('profile.privacyPolicy')}>
      <HeroBand
        icon="shield-checkmark"
        title={t('profile.privacyPolicy')}
        subtitle={`Your privacy matters. Here is exactly what ${AppConfig.identity.appName} stores and why.`}
        tone="primary"
        footer={
          <>
            <StatusPill label="No data selling" tone="success" icon="checkmark-circle" size="sm" />
            <StatusPill label="You can delete it all" tone="info" icon="trash-outline" size="sm" />
          </>
        }
      />

      {SECTIONS.map((section) => (
        <SectionCard key={section.title} icon={section.icon} title={section.title} tone={section.tone}>
          <Text variant="body" secondary>{section.body}</Text>
        </SectionCard>
      ))}

      <QuotePanel caption="Full policy" icon="globe-outline" tone="info" spine>
        <Text variant="bodySmall" secondary>{AppConfig.legal.privacyPolicyUrl}</Text>
        <View style={{ marginTop: spacing.sm }}>
          <Button
            label="Read the full policy online"
            variant="secondary"
            onPress={() => Linking.openURL(AppConfig.legal.privacyPolicyUrl)}
          />
        </View>
      </QuotePanel>
    </SubpageScrollScreen>
  );
}
