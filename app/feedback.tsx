// Profile → Support → Feedback.
//
// UI only — submitFeedback, the rating guard and the offline block are
// unchanged. The rating card now answers back: the stars take the tone of the
// score you picked and the label sits in a pill instead of a bare line of
// primary-coloured text. The label row keeps its height at every rating,
// including zero, so tapping a star never nudges the form below it.
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
import { HeroBand, SectionCard, StatusPill, QuotePanel, useTones, type Tone } from '@/src/components/premium';

const RATING_LABELS = ['', 'Very poor', 'Poor', 'Okay', 'Good', 'Excellent'];

function ratingTone(rating: number): Tone {
  if (rating >= 4) return 'success';
  if (rating === 3) return 'warning';
  if (rating > 0) return 'danger';
  return 'neutral';
}

export default function FeedbackScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { isOffline } = useNetworkStatus();
  const tones = useTones();

  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const tone = ratingTone(rating);
  const star = tones[tone];

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
      <HeroBand
        icon="heart"
        title={t('profile.feedback')}
        subtitle="Your feedback directly shapes what we build next. Thank you for taking a moment."
        tone="danger"
      />

      <SectionCard icon="star-outline" title={t('feedback.ratingQuestion')} tone={rating > 0 ? tone : 'primary'}>
        <View style={styles.starRow}>
          {[1, 2, 3, 4, 5].map((value) => (
            <Pressable
              key={value}
              onPress={() => setRating(value)}
              hitSlop={8}
              accessibilityLabel={`${value} star${value > 1 ? 's' : ''}`}
              style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.88 : 1 }] }]}
            >
              <Ionicons
                name={value <= rating ? 'star' : 'star-outline'}
                size={36}
                color={value <= rating ? star.solid : colors.textDisabled}
              />
            </Pressable>
          ))}
        </View>
        {/* Fixed-height slot: the pill replaces a hint rather than appearing
            from nothing, so the card never changes size as you tap. */}
        <View style={styles.labelSlot}>
          {rating > 0 ? (
            <StatusPill label={RATING_LABELS[rating]} tone={tone} icon="sparkles" />
          ) : (
            <Text variant="bodySmall" secondary>Tap a star to rate</Text>
          )}
        </View>
      </SectionCard>

      {isOffline ? (
        <QuotePanel tone="warning" icon="cloud-offline-outline" caption={t('common.offline')}>
          <Text variant="bodySmall">{t('help.offlineBlocked')}</Text>
        </QuotePanel>
      ) : (
        <SectionCard icon="create-outline" title={t('feedback.messageLabel')} subtitle={t('feedback.messageHelper')} tone="info">
          <TextField
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={5}
            style={{ minHeight: 130, textAlignVertical: 'top' }}
          />
          <View style={{ marginTop: spacing.md }}>
            <Button label={t('common.submit')} onPress={handleSubmit} loading={sending} disabled={rating === 0 || sending} />
          </View>
        </SectionCard>
      )}
    </SubpageScrollScreen>
  );
}

const styles = StyleSheet.create({
  starRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginVertical: 4 },
  labelSlot: { minHeight: 30, alignItems: 'center', justifyContent: 'center' },
});
