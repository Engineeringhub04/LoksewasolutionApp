// Profile → Support → Contact us.
//
// UI only — the mailto/tel/website links, the social URLs and
// submitContactMessage are unchanged. The three contact rows became shared
// ActionRows, the bare "Follow us" heading became a real section, and the X
// brand colour is now theme-aware: #0F1419 is all but invisible against a dark
// surface, so dark mode uses X's own light-on-dark mark instead.
import React, { useState } from 'react';
import { View, Linking, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useNetworkStatus } from '@/src/core/hooks/useNetworkStatus';
import { AppConfig } from '@/src/core/config/appConfig';
import { submitContactMessage } from '@/src/core/messaging/support';
import { showToast } from '@/src/core/store/toastStore';
import { SubpageScrollScreen } from '@/src/components/nav/SubpageScrollScreen';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';
import { TextField } from '@/src/components/inputs/TextField';
import { HeroBand, SectionCard, ActionRow, StatusPill, QuotePanel, type Tone } from '@/src/components/premium';

export default function ContactUsScreen() {
  const { colors, spacing, effective } = useTheme();
  const { t } = useTranslation();
  const { isOffline } = useNetworkStatus();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const isDark = effective === 'dark';

  const channels: { icon: keyof typeof Ionicons.glyphMap; tone: Tone; label: string; value: string; onPress: () => void }[] = [
    {
      icon: 'mail-outline',
      tone: 'primary',
      label: 'Email us',
      value: AppConfig.legal.supportEmail,
      onPress: () => Linking.openURL(`mailto:${AppConfig.legal.supportEmail}`),
    },
    {
      icon: 'call-outline',
      tone: 'success',
      label: 'Call us',
      value: AppConfig.legal.contactPhone,
      onPress: () => Linking.openURL(`tel:${AppConfig.legal.contactPhone}`),
    },
    {
      icon: 'globe-outline',
      tone: 'info',
      label: 'Website',
      value: AppConfig.links.website.replace(/^https?:\/\//, ''),
      onPress: () => Linking.openURL(AppConfig.links.website),
    },
  ];

  // Each platform in its own brand colour, in a circular button. X is the one
  // mark with no single usable colour, so it flips with the theme.
  const socials: { icon: keyof typeof Ionicons.glyphMap; url: string; label: string; color: string }[] = [
    { icon: 'logo-facebook', url: AppConfig.links.facebook, label: 'Facebook', color: '#1877F2' },
    { icon: 'logo-instagram', url: AppConfig.links.instagram, label: 'Instagram', color: '#E4405F' },
    { icon: 'logo-youtube', url: AppConfig.links.youtube, label: 'YouTube', color: '#FF0000' },
    { icon: 'logo-twitter', url: AppConfig.links.twitter, label: 'X (Twitter)', color: isDark ? '#E7E9EA' : '#0F1419' },
  ];

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      await submitContactMessage(message.trim());
      setMessage('');
      showToast(t('help.messageSent'), 'success');
    } catch {
      showToast(t('common.somethingWentWrong'), 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <SubpageScrollScreen title={t('profile.contactUs')}>
      <HeroBand
        icon="chatbubbles"
        title={t('profile.contactUs')}
        subtitle="We usually reply within one working day. Pick whichever channel suits you."
        tone="primary"
        footer={<StatusPill label="Replies within 1 working day" tone="success" icon="time-outline" size="sm" />}
      />

      <SectionCard icon="headset-outline" title="Reach us" tone="primary" style={{ paddingBottom: spacing.sm }}>
        {channels.map((channel, index) => (
          <ActionRow
            key={channel.label}
            icon={channel.icon}
            title={channel.label}
            subtitle={channel.value}
            tone={channel.tone}
            onPress={channel.onPress}
            divider={index < channels.length - 1}
            trailing={<Ionicons name="open-outline" size={18} color={colors.textDisabled} />}
          />
        ))}
      </SectionCard>

      <SectionCard icon="share-social-outline" title="Follow us" tone="accent">
        <View style={styles.socialRow}>
          {socials.map((social) => (
            <View key={social.label} style={styles.socialItem}>
              <Pressable
                onPress={() => Linking.openURL(social.url)}
                accessibilityLabel={social.label}
                style={({ pressed }) => [
                  styles.socialCircle,
                  {
                    backgroundColor: `${social.color}1A`,
                    borderColor: `${social.color}55`,
                    transform: [{ scale: pressed ? 0.92 : 1 }],
                  },
                ]}
              >
                <Ionicons name={social.icon} size={24} color={social.color} />
              </Pressable>
              <Text variant="caption" secondary numberOfLines={1}>{social.label}</Text>
            </View>
          ))}
        </View>
      </SectionCard>

      {isOffline ? (
        <QuotePanel tone="warning" icon="cloud-offline-outline" caption={t('common.offline')}>
          <Text variant="bodySmall">{t('help.offlineBlocked')}</Text>
        </QuotePanel>
      ) : (
        <SectionCard icon="send-outline" title={t('help.sendMessage')} subtitle={t('help.contactDesc')} tone="info">
          <TextField
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={4}
            style={{ minHeight: 110, textAlignVertical: 'top' }}
          />
          <View style={{ marginTop: spacing.md }}>
            <Button label={t('help.sendMessage')} onPress={handleSend} loading={sending} disabled={!message.trim() || sending} />
          </View>
        </SectionCard>
      )}
    </SubpageScrollScreen>
  );
}

const styles = StyleSheet.create({
  socialRow: { flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  socialItem: { flex: 1, alignItems: 'center', gap: 6 },
  socialCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
