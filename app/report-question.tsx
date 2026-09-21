// Profile → App Settings → Report Question.
//
// UI only — the submit path (submitQuestionReport → Google Form → Discord) is
// untouched. The form is now three titled blocks instead of one flat stack of
// fields: each block asks one question in its header, so the input underneath
// can drop its duplicate label and use the hint as its resting placeholder.
import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { HeroBand, SectionCard, StatusPill, QuotePanel } from '@/src/components/premium';

type Issue = 'wrong-answer' | 'typo' | 'duplicate' | 'unclear' | 'other';

export default function ReportQuestionScreen() {
  const { spacing } = useTheme();
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

  // Filled-step count, shown as a quiet pill in the hero. It is the one piece of
  // feedback the old form never gave: you could not tell what was still missing
  // until the submit button refused to light up.
  const filled = [questionRef.trim().length > 0, issue !== null, description.trim().length > 0].filter(Boolean).length;

  return (
    <SubpageScrollScreen title={t('profile.reportQuestion')}>
      <HeroBand
        icon="help-circle-outline"
        title={t('report.title')}
        subtitle={t('reportQuestion.intro')}
        tone="primary"
        footer={
          isOffline ? (
            <StatusPill icon="cloud-offline-outline" label={t('common.offline')} tone="warning" size="sm" />
          ) : (
            <StatusPill icon="checkmark-circle-outline" label={`${filled}/3`} tone={filled === 3 ? 'success' : 'neutral'} size="sm" />
          )
        }
      />

      {isOffline ? (
        <QuotePanel tone="warning" icon="cloud-offline-outline" caption={t('common.offline')}>
          <Text variant="bodySmall" secondary>{t('help.offlineBlocked')}</Text>
        </QuotePanel>
      ) : (
        <>
          <SectionCard icon="bookmark-outline" title={t('reportQuestion.questionRef')} tone="info">
            <FloatingLabelField
              label={t('reportQuestion.questionRefHint')}
              value={questionRef}
              onChangeText={setQuestionRef}
              leftIcon="bookmark-outline"
            />
          </SectionCard>

          <SectionCard icon="options-outline" title={t('reportQuestion.issueType')} tone="warning">
            <Dropdown options={issueOptions} value={issue} onChange={setIssue} placeholder={t('reportQuestion.issueSelect')} />
          </SectionCard>

          <SectionCard
            icon="document-text-outline"
            title={t('reportQuestion.description')}
            subtitle={t('reportQuestion.descriptionHint')}
            tone="primary"
          >
            <TextField
              value={description}
              onChangeText={setDescription}
              placeholder={t('report.explanationPlaceholder')}
              multiline
              numberOfLines={5}
              style={{ minHeight: 130, textAlignVertical: 'top' }}
            />
          </SectionCard>

          <View style={{ gap: spacing.sm }}>
            <Button label={t('common.submit')} onPress={handleSubmit} loading={sending} disabled={!canSubmit} />
          </View>
        </>
      )}
    </SubpageScrollScreen>
  );
}
