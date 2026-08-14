// Profile → App Settings → Report Question.
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useNetworkStatus } from '@/src/core/hooks/useNetworkStatus';
import { submitQuestionReport } from '@/src/core/messaging/support';
import { showToast } from '@/src/core/store/toastStore';
import { SubpageScrollScreen } from '@/src/components/nav/SubpageScrollScreen';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';
import { TextField } from '@/src/components/inputs/TextField';
import { FloatingLabelField } from '@/src/components/inputs/FloatingLabelField';
import { Dropdown } from '@/src/components/inputs/Dropdown';

type Issue = 'wrong-answer' | 'typo' | 'duplicate' | 'unclear' | 'other';

export default function ReportQuestionScreen() {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { isOffline } = useNetworkStatus();
  const { questionRef: initialQuestionRef } = useLocalSearchParams<{ questionRef?: string }>();

  const [questionRef, setQuestionRef] = useState(() => (typeof initialQuestionRef === 'string' ? initialQuestionRef : ''));
  const [issue, setIssue] = useState<Issue | null>(null);
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);

  const issueOptions: { value: Issue; label: string }[] = [
    { value: 'wrong-answer', label: t('reportQuestion.issueWrongAnswer') },
    { value: 'typo', label: t('reportQuestion.issueTypo') },
    { value: 'duplicate', label: t('reportQuestion.issueDuplicate') },
    { value: 'unclear', label: t('reportQuestion.issueUnclear') },
    { value: 'other', label: t('reportQuestion.issueOther') },
  ];

  const canSubmit = questionRef.trim().length > 0 && issue !== null && description.trim().length > 0 && !sending;

  const handleSubmit = async () => {
    if (!issue) return;
    setSending(true);
    try {
      await submitQuestionReport(questionRef.trim(), issue, description.trim());
      showToast(t('reportQuestion.submitted'), 'success');
      router.back();
    } catch {
      showToast(t('common.somethingWentWrong'), 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <SubpageScrollScreen title={t('profile.reportQuestion')}>
      <View style={[styles.hero, { backgroundColor: `${colors.primary}14`, borderRadius: radius.lg, padding: spacing.md }]}>
        <Ionicons name="help-circle" size={26} color={colors.primary} />
        <Text variant="bodySmall" secondary style={{ flex: 1 }}>{t('reportQuestion.intro')}</Text>
      </View>

      {isOffline ? (
        <Text variant="bodySmall" style={{ color: colors.warning }}>{t('help.offlineBlocked')}</Text>
      ) : (
        <>
          <FloatingLabelField
            label={t('reportQuestion.questionRef')}
            value={questionRef}
            onChangeText={setQuestionRef}
            leftIcon="bookmark-outline"
          />
          <Text variant="caption" secondary style={{ marginLeft: spacing.xs, marginTop: -spacing.xs }}>
            {t('reportQuestion.questionRefHint')}
          </Text>

          <View style={{ gap: spacing.sm }}>
            <Text variant="bodySmall" weight="semiBold" secondary style={{ marginLeft: spacing.xs }}>
              {t('reportQuestion.issueType')}
            </Text>
            <Dropdown options={issueOptions} value={issue} onChange={setIssue} placeholder={t('reportQuestion.issueSelect')} />
          </View>

          <TextField
            label={t('reportQuestion.description')}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
            style={{ minHeight: 130, textAlignVertical: 'top' }}
            helperText={t('reportQuestion.descriptionHint')}
          />

          <Button label={t('common.submit')} onPress={handleSubmit} loading={sending} disabled={!canSubmit} />
        </>
      )}
    </SubpageScrollScreen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
