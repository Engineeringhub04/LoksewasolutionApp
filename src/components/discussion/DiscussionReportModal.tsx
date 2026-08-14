import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { Text } from '@/src/components/misc/Text';
import { TextField } from '@/src/components/inputs/TextField';
import { Button } from '@/src/components/buttons/Button';
import { ConfirmDialog } from '@/src/components/feedback/ConfirmDialog';

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

export function DiscussionReportModal({ visible, target, submitting = false, onClose, onSubmit }: DiscussionReportModalProps) {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const [reportType, setReportType] = useState<(typeof REPORT_TYPES)[number]>('spam');
  const [message, setMessage] = useState('');
  const [confirmVisible, setConfirmVisible] = useState(false);

  const close = () => {
    if (submitting) return;
    setConfirmVisible(false);
    setMessage('');
    setReportType('spam');
    onClose();
  };

  const submit = () => {
    if (!message.trim()) return;
    setConfirmVisible(false);
    onSubmit(`${t(`discussion.reportType_${reportType}`)}: ${message.trim()}`);
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={[styles.overlay, { backgroundColor: colors.overlay }]} onPress={close}>
          <Pressable onPress={(event) => event.stopPropagation()} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg }]}>
            <Text variant="h3" weight="semiBold">{t('discussion.reportTitle')}</Text>
            <Text variant="bodySmall" secondary style={{ marginTop: spacing.xs }}>{target?.type === 'post' ? t('discussion.reportPost') : t('discussion.reportComment')}</Text>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.md, paddingTop: spacing.md }}>
              <Text variant="bodySmall" weight="semiBold">{t('discussion.reportType')}</Text>
              <View style={styles.typeGrid}>
                {REPORT_TYPES.map((type) => (
                  <Pressable
                    key={type}
                    onPress={() => setReportType(type)}
                    style={[styles.typeChip, { borderColor: reportType === type ? colors.primary : colors.border, backgroundColor: reportType === type ? `${colors.primary}16` : colors.surfaceAlt }]}
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
                style={{ minHeight: 106 }}
              />
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button label={t('common.cancel')} variant="secondary" onPress={close} style={{ flex: 1 }} />
                <Button label={t('discussion.submitReport')} onPress={() => setConfirmVisible(true)} loading={submitting} disabled={!message.trim()} style={{ flex: 1 }} />
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
      <ConfirmDialog
        visible={confirmVisible}
        title={t('discussion.confirmReportTitle')}
        message={t('discussion.confirmReportMessage')}
        confirmLabel={t('discussion.submitReport')}
        onConfirm={submit}
        onCancel={() => setConfirmVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18 },
  card: { width: '100%', maxHeight: '88%', borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 },
});

