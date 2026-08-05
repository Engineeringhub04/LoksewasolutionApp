// Profile → Support → Contact us.
import React, { useState } from 'react';
import { View, Linking, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useNetworkStatus } from '@/src/core/hooks/useNetworkStatus';
import { AppConfig } from '@/src/core/config/appConfig';
import { submitContactMessage } from '@/src/core/firebase/services/support';
import { showToast } from '@/src/core/store/toastStore';
import { SubpageScrollScreen } from '@/src/components/nav/SubpageScrollScreen';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';
import { TextField } from '@/src/components/inputs/TextField';

export default function ContactUsScreen() {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const { isOffline } = useNetworkStatus();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const channels: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; onPress: () => void }[] = [
    {
      icon: 'mail-outline',
      label: 'Email us',
      value: AppConfig.legal.supportEmail,
      onPress: () => Linking.openURL(`mailto:${AppConfig.legal.supportEmail}`),
    },
    {
      icon: 'call-outline',
      label: 'Call us',
      value: AppConfig.legal.contactPhone,
      onPress: () => Linking.openURL(`tel:${AppConfig.legal.contactPhone}`),
    },
    {
      icon: 'globe-outline',
      label: 'Website',
      value: AppConfig.links.website.replace(/^https?:\/\//, ''),
      onPress: () => Linking.openURL(AppConfig.links.website),
    },
  ];

  const socials: { icon: keyof typeof Ionicons.glyphMap; url: string; label: string }[] = [
    { icon: 'logo-facebook', url: AppConfig.links.facebook, label: 'Facebook' },
    { icon: 'logo-youtube', url: AppConfig.links.youtube, label: 'YouTube' },
    { icon: 'logo-instagram', url: AppConfig.links.instagram, label: 'Instagram' },
    { icon: 'logo-discord', url: AppConfig.links.discord, label: 'Discord' },
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
      <View style={[styles.hero, { backgroundColor: `${colors.primary}14`, borderRadius: radius.lg, padding: spacing.md }]}>
        <Ionicons name="chatbubbles" size={26} color={colors.primary} />
        <Text variant="bodySmall" secondary style={{ flex: 1 }}>
          We usually reply within one working day. Pick whichever channel suits you.
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
        {channels.map((channel, index) => (
          <React.Fragment key={channel.label}>
            {index > 0 ? <View style={[styles.divider, { backgroundColor: colors.divider }]} /> : null}
            <Pressable
              onPress={channel.onPress}
              style={({ pressed }) => [styles.row, { padding: spacing.md, gap: spacing.md }, pressed && styles.pressed]}
            >
              <View style={[styles.iconBox, { backgroundColor: `${colors.primary}17`, borderRadius: radius.md }]}>
                <Ionicons name={channel.icon} size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="caption" secondary>{channel.label}</Text>
                <Text variant="bodyLarge" weight="semiBold" numberOfLines={1}>{channel.value}</Text>
              </View>
              <Ionicons name="open-outline" size={18} color={colors.textSecondary} />
            </Pressable>
          </React.Fragment>
        ))}
      </View>

      <Text variant="bodyLarge" weight="bold" style={{ marginTop: spacing.sm }}>Follow us</Text>
      <View style={styles.socialRow}>
        {socials.map((social) => (
          <Pressable
            key={social.label}
            onPress={() => Linking.openURL(social.url)}
            accessibilityLabel={social.label}
            style={({ pressed }) => [
              styles.socialButton,
              { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Ionicons name={social.icon} size={22} color={colors.primary} />
          </Pressable>
        ))}
      </View>

      <Text variant="bodyLarge" weight="bold" style={{ marginTop: spacing.sm }}>{t('help.sendMessage')}</Text>
      {isOffline ? (
        <Text variant="bodySmall" style={{ color: colors.warning }}>{t('help.offlineBlocked')}</Text>
      ) : (
        <>
          <TextField
            label={t('help.contactDesc')}
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={4}
            style={{ minHeight: 110, textAlignVertical: 'top' }}
          />
          <Button label={t('help.sendMessage')} onPress={handleSend} loading={sending} disabled={!message.trim() || sending} />
        </>
      )}
    </SubpageScrollScreen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  card: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.65 },
  socialRow: { flexDirection: 'row', gap: 10 },
  socialButton: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderWidth: StyleSheet.hairlineWidth },
});
