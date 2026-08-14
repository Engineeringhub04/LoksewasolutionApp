import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchExamSet } from '@/src/core/firebase/services/examHub';
import { SubpageScrollScreen } from '@/src/components/nav/SubpageScrollScreen';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';

export default function ExamPurchasePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const { data: exam, loading, error, refetch } = useAsyncData(
    () => (id ? fetchExamSet(id) : Promise.resolve(null)),
    [id]
  );

  return (
    <SubpageScrollScreen title={exam?.title ?? t('subscription.examPurchase')}>
      {loading ? null : error || !exam ? (
        <DataNotFound onRetry={refetch} />
      ) : (
        <View style={{ gap: spacing.md }}>
          <View style={[styles.hero, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}35`, borderRadius: radius.lg, padding: spacing.md }]}>
            <View style={[styles.iconBox, { backgroundColor: `${colors.primary}20`, borderRadius: radius.md }]}>
              <Ionicons name={exam.contentType === 'pdf' ? 'document-text' : 'help-circle'} size={28} color={colors.primary} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="h3" weight="bold">{exam.title}</Text>
              <Text variant="bodySmall" secondary>{t('subscription.premiumExamAccess')}</Text>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }]}>
            <Text variant="bodyLarge" weight="bold">{t('subscription.examDetails')}</Text>
            <DetailRow label={t('subscription.contentType')} value={exam.contentType === 'pdf' ? 'Theory Desk' : 'MCQ'} />
            <DetailRow label={t('subscription.questions')} value={String(exam.totalQuestions)} />
            <DetailRow label={t('subscription.duration')} value={`${exam.durationMinutes} minutes`} />
            <DetailRow label={t('subscription.difficulty')} value={exam.difficulty} />
            <DetailRow label={t('subscription.passPercentage')} value={`${exam.passPercent}%`} />
          </View>

          <View style={[styles.priceCard, { backgroundColor: colors.primary, borderRadius: radius.lg, padding: spacing.lg }]}>
            <Text variant="bodySmall" style={{ color: 'rgba(255,255,255,0.8)' }}>{t('subscription.purchasePrice')}</Text>
            <Text variant="h1" weight="bold" style={{ color: '#FFF' }}>Rs. {exam.price} {exam.currency}</Text>
            <Text variant="caption" style={{ color: 'rgba(255,255,255,0.82)' }}>{t('subscription.priceFromFirestore')}</Text>
          </View>

          <Button
            label={t('subscription.continueToPayment')}
            onPress={() => router.push({ pathname: '/subscription/checkout', params: { examId: exam.id } })}
            icon={<Ionicons name="arrow-forward" size={18} color={colors.onPrimary} />}
          />
        </View>
      )}
    </SubpageScrollScreen>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const { colors, spacing } = useTheme();
  return (
    <View style={[styles.detailRow, { borderBottomColor: colors.border, paddingVertical: spacing.sm }]}>
      <Text variant="bodySmall" secondary>{label}</Text>
      <Text variant="bodySmall" weight="semiBold" style={{ color: colors.textPrimary }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1 },
  iconBox: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: StyleSheet.hairlineWidth, gap: 2 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth },
  priceCard: { gap: 6 },
});
