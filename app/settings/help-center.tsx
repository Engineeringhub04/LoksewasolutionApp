// §43 Help Center / Contact Us
import React, { useState } from 'react';
import { View, ScrollView, Linking } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { AppConfig } from '@/src/core/config/appConfig';
import { useNetworkStatus } from '@/src/core/hooks/useNetworkStatus';
import { submitContactMessage } from '@/src/core/firebase/services/support';
import { showToast } from '@/src/core/store/toastStore';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { SearchBar } from '@/src/components/inputs/SearchBar';
import { Text } from '@/src/components/misc/Text';
import { Card } from '@/src/components/cards/Card';
import { TextField } from '@/src/components/inputs/TextField';
import { Button } from '@/src/components/buttons/Button';
import { EmptyState } from '@/src/components/feedback/EmptyState';

const faqs = [
  { q: 'How do I take a mock test?', a: 'Go to the Exam tab, select a mock test, review the instructions, and tap Start Test.' },
  { q: 'How do I bookmark content?', a: 'Tap the bookmark icon on any Topic, Current Affairs item, or Discussion post.' },
  { q: 'Can I use the app offline?', a: 'Downloaded topics, Keep Notes, and previously loaded content remain available offline.' },
  { q: 'How do I change the app language?', a: 'Go to Settings → Language and select English or Nepali.' },
];

export default function HelpCenterScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const { isOffline } = useNetworkStatus();
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const filtered = faqs.filter((f) => f.q.toLowerCase().includes(search.toLowerCase()));

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      await submitContactMessage(message.trim());
      showToast(t('help.messageSent'), 'success');
      setMessage('');
    } catch {
      showToast(t('common.somethingWentWrong'), 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TopAppBar title={t('help.title')} />
      <ScrollView contentContainerStyle={{ padding: spacing.screenPadding, gap: spacing.md }}>
        <SearchBar value={search} onChangeText={setSearch} placeholder={t('help.searchFaq')} />

        {filtered.length === 0 ? (
          <EmptyState title={t('search.noResults', { query: search })} />
        ) : (
          filtered.map((faq, i) => (
            <Card key={i} onPress={() => setExpanded(expanded === i ? null : i)}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="body" weight="medium" style={{ flex: 1 }}>{faq.q}</Text>
                <Ionicons name={expanded === i ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
              </View>
              {expanded === i ? <Text variant="bodySmall" secondary style={{ marginTop: spacing.sm }}>{faq.a}</Text> : null}
            </Card>
          ))
        )}

        <Text variant="h3" weight="semiBold" style={{ marginTop: spacing.md }}>{t('help.contactTitle')}</Text>
        <Text variant="body" secondary>{t('help.contactDesc')}</Text>
        <Text variant="body" style={{ color: colors.primary }} onPress={() => Linking.openURL(`mailto:${AppConfig.legal.supportEmail}`)}>
          {AppConfig.legal.supportEmail}
        </Text>
        <Text variant="body" style={{ color: colors.primary }} onPress={() => Linking.openURL(`tel:${AppConfig.legal.contactPhone}`)}>
          {AppConfig.legal.contactPhone}
        </Text>

        {isOffline ? (
          <Text variant="bodySmall" style={{ color: colors.warning }}>{t('help.offlineBlocked')}</Text>
        ) : (
          <>
            <TextField
              label={t('help.sendMessage')}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={4}
              style={{ minHeight: 90, textAlignVertical: 'top' }}
            />
            <Button label={t('help.sendMessage')} onPress={handleSend} loading={sending} disabled={!message.trim()} />
          </>
        )}
      </ScrollView>
    </View>
  );
}
