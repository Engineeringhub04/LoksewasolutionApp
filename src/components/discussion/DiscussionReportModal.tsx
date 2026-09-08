// Report form for a post or a comment.
//
// Built on AppDialog: the chips and the reason field live in the shell's own
// scroll area, so the keyboard cannot push the submit button out of reach and the
// form can never end up detached behind the modal.
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { Text } from '@/src/components/misc/Text';
import { TextField } from '@/src/components/inputs/TextField';
import { AppDialog } from '@/src/components/feedback/AppDialog';

export interface DiscussionReportTarget {
  type: 'post' | 'comment';
  id: string;
  authorName?: string | null;
  authorPhoto?: string | null;
  preview?: string | null;
}

interface DiscussionReportModalProps {
  visible: boolean;
  target: DiscussionReportTarget | null;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}

const REPORT_TYPES = ['spam', 'abuse', 'misinformation', 'inappropriate', 'other'] as const;

/** Reporting is a warning-weight action, not a destructive or neutral one. */
const REPORT_ACCENT = '#D97706';

export function DiscussionReportModal({ visible, target, submitting = false, onClose, onSubmit }: DiscussionReportModalProps) {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const [reportType, setReportType] = useState<(typeof REPORT_TYPES)[number]>('spam');
  const [message, setMessage] = useState('');

  const close = () => {
    if (submitting) return;
    setMessage('');
    setReportType('spam');
    onClose();
  };

  const submit = () => {
    if (submitting || !message.trim()) return;
    onSubmit(`${t(`discussion.reportType_${reportType}`)}: ${message.trim()}`);
  };

  return (
    <AppDialog
      visible={visible}
      icon="flag"
      title={t('discussion.reportTitle')}
      subtitle={target?.type === 'post' ? t('discussion.reportPost') : t('discussion.reportComment')}
      accent={REPORT_ACCENT}
      confirmLabel={t('discussion.submitReport')}
      cancelLabel={t('common.cancel')}
      confirmDisabled={!message.trim()}
      confirmLoading={submitting}
      onConfirm={submit}
      onCancel={close}
    >
      <Text variant="bodySmall" weight="semiBold">{t('discussion.reportType')}</Text>
      <View style={styles.typeGrid}>
        {REPORT_TYPES.map((type) => (
          <Pressable
            key={type}
            disabled={submitting}
            onPress={() => setReportType(type)}
            style={[styles.typeChip, { borderColor: reportType === type ? colors.primary : colors.border, backgroundColor: reportType === type ? `${colors.primary}16` : colors.surfaceAlt, opacity: submitting ? 0.6 : 1 }]}
          >
            <Text variant="caption" weight="semiBold" style={{ color: reportType === type ? colors.primary : colors.textSecondary }}>{t(`discussion.reportType_${type}`)}</Text>
          </Pressable>
        ))}
      </View>
      <TextField
        label={t('discussion.reportMessage')}
        value={message}
        onChangeText={setMessage}
        placeholder={t('discussion.reportMessagePlaceholder')}
        multiline
        textAlignVertical="top"
        editable={!submitting}
        containerStyle={{ marginTop: spacing.xs }}
        style={{ minHeight: 106 }}
      />
    </AppDialog>
  );
}

const styles = StyleSheet.create({
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 },
});

export default DiscussionReportModal;
