// Profile → Support → Feedback.
import React, { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useNetworkStatus } from '@/src/core/hooks/useNetworkStatus';
import { submitFeedback } from '@/src/core/messaging/support';
import { showToast } from '@/src/core/store/toastStore';
import { SubpageScrollScreen } from '@/src/components/nav/SubpageScrollScreen';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';
import { TextField } from '@/src/components/inputs/TextField';

const RATING_LABELS = ['', 'Very poor', 'Poor', 'Okay', 'Good', 'Excellent'];

export default function FeedbackScreen() {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { isOffline } = useNetworkStatus();

  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      showToast(t('feedback.pickRating'), 'warning');
      return;
    }
    setSending(true);
    try {
      await submitFeedback(rating, message.trim());
      showToast(t('feedback.thanks'), 'success');
      router.back();
    } catch {
      showToast(t('common.somethingWentWrong'), 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <SubpageScrollScreen title={t('profile.feedback')}>
      <View style={[styles.hero, { backgroundColor: `${colors.primary}14`, borderRadius: radius.lg, padding: spacing.md }]}>
        <Ionicons name="heart" size={26} color={colors.primary} />
        <Text variant="bodySmall" secondary style={{ flex: 1 }}>
          Your feedback directly shapes what we build next. Thank you for taking a moment.
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }]}>
        <Text variant="bodyLarge" weight="bold">{t('feedback.ratingQuestion')}</Text>
        <View style={styles.starRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Pressable
              key={star}
              onPress={() => setRating(star)}
              hitSlop={6}
              accessibilityLabel={`${star} star${star > 1 ? 's' : ''}`}
            >
              <Ionicons
                name={star <= rating ? 'star' : 'star-outline'}
                size={34}
                color={star <= rating ? colors.accent : colors.textDisabled}
              />
            </Pressable>
          ))}
        </View>
        {rating > 0 ? (
          <Text variant="bodySmall" weight="semiBold" style={{ color: colors.primary, textAlign: 'center' }}>
            {RATING_LABELS[rating]}
          </Text>
        ) : null}
      </View>

      {isOffline ? (
        <Text variant="bodySmall" style={{ color: colors.warning }}>{t('help.offlineBlocked')}</Text>
      ) : (
        <>
          <TextField
            label={t('feedback.messageLabel')}
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={5}
            style={{ minHeight: 130, textAlignVertical: 'top' }}
            helperText={t('feedback.messageHelper')}
          />
          <Button label={t('common.submit')} onPress={handleSubmit} loading={sending} disabled={rating === 0 || sending} />
        </>
      )}
    </SubpageScrollScreen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  card: { borderWidth: StyleSheet.hairlineWidth, gap: 10 },
  starRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginVertical: 4 },
});
