// The one report popup, used by every report icon in the app.
//
// Built on AppDialog — the same shell as the confirmation and rules dialogs — so
// reporting never looks like a different app. What changes per screen is only the
// CONTEXT: the dialog auto-fills a read-only block describing exactly what is
// being reported (the question and its options on a quiz screen, the article on a
// reading screen) so the user never has to retype it and support always receives
// the same shape.
//
// Submission is owned here rather than by the caller: every report has to reach
// BOTH the Google Form (→ Discord) and the user's private Report History, and
// duplicating that at a dozen call sites is how one of them eventually drifts.
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { Text } from '@/src/components/misc/Text';
import { TextField } from '@/src/components/inputs/TextField';
import { AppDialog } from '@/src/components/feedback/AppDialog';
import { showToast } from '@/src/core/store/toastStore';
import { useAuthStore } from '@/src/core/store/authStore';
import { submitContextReport } from '@/src/core/messaging/support';
import type { ReportSource, ReportTargetType } from '@/src/core/firebase/services/reportHistory';

/** Which set of categories to offer — question-shaped, content-shaped, or the app itself. */
export type ReportCategoryGroup = 'question' | 'content' | 'app';

export interface ReportTargetInput {
  /** History grouping. */
  source: ReportSource;
  targetType: ReportTargetType;
  /** Stable id of the reported item. */
  id: string;
  /** Badge text describing where this came from, e.g. "Exam · Set 3". */
  contextLabel: string;
  /** The question text / article title — shown at the top of the context block. */
  title: string;
  /** Answer choices, auto-filled on question screens. */
  options?: string[];
  /** Index into `options` of the answer the app marks correct, when known. */
  answerIndex?: number;
  /** Extra labelled rows, e.g. Subject / Chapter. */
  meta?: { label: string; value: string }[];
  /** Long-form body for reading/article contexts. */
  body?: string;
  categoryGroup?: ReportCategoryGroup;
}

interface ReportDialogProps {
  visible: boolean;
  target: ReportTargetInput | null;
  onClose: () => void;
  /** Fired after a successful send, e.g. to close a parent menu. */
  onSent?: () => void;
}

/** Reporting is a warning-weight action — same accent the discussion report uses. */
const REPORT_ACCENT = '#D97706';

/**
 * Six choices per group, the last always "other". Six is the most a user will
 * actually read before defaulting to "other"; the groups exist because "Wrong
 * answer" is meaningless on an article and "Outdated content" is meaningless on
 * a multiple-choice question.
 */
const CATEGORY_GROUPS: Record<ReportCategoryGroup, string[]> = {
  question: ['wrongAnswer', 'wrongQuestion', 'typo', 'duplicate', 'unclear', 'other'],
  content: ['wrongInfo', 'outdated', 'typo', 'formatting', 'missing', 'other'],
  app: ['bug', 'payment', 'performance', 'formatting', 'missing', 'other'],
};

const LETTERS = 'ABCDEFGHIJ';

/** Builds the plain-text copy of the reported item that travels to Discord. */
function buildPreview(target: ReportTargetInput, optionsLabel: string, answerLabel: string): string {
  const lines: string[] = [target.title];
  if (target.meta?.length) {
    lines.push('', ...target.meta.map((row) => `${row.label}: ${row.value}`));
  }
  if (target.options?.length) {
    lines.push('', `${optionsLabel}:`);
    target.options.forEach((option, index) => {
      const mark = target.answerIndex === index ? `  <- ${answerLabel}` : '';
      lines.push(`  ${LETTERS[index] ?? index + 1}. ${option}${mark}`);
    });
  }
  if (target.body?.trim()) {
    lines.push('', target.body.trim().slice(0, 1200));
  }
  return lines.join('\n');
}

export function ReportDialog({ visible, target, onClose, onSent }: ReportDialogProps) {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const uid = useAuthStore((state) => state.user?.uid ?? null);

  const [category, setCategory] = useState('');
  const [custom, setCustom] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const group = target?.categoryGroup ?? (target?.options?.length ? 'question' : 'content');
  const categories = CATEGORY_GROUPS[group];
  const isOther = category === 'other';
  // "Other" without words is the same as no category at all.
  const ready = !!category && (!isOther || custom.trim().length > 0) && description.trim().length > 0;

  const preview = useMemo(
    () => (target ? buildPreview(target, t('report.optionsLabel'), t('report.answerLabel')) : ''),
    [target, t],
  );

  const reset = () => {
    setCategory('');
    setCustom('');
    setDescription('');
  };

  const close = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const submit = async () => {
    if (!target || !ready || submitting) return;
    if (!uid) {
      showToast(t('report.signIn'), 'warning');
      return;
    }
    setSubmitting(true);
    try {
      await submitContextReport({
        source: target.source,
        targetType: target.targetType,
        targetId: target.id,
        targetTitle: target.title,
        targetPreview: preview,
        contextLabel: target.contextLabel,
        // Picking "Other" sends the user's own words, never the literal "other".
        reason: isOther ? custom.trim() : t(`report.cat.${category}`),
        description: description.trim(),
        formContext: target.source,
      });
      showToast(t('report.sent'), 'success');
      reset();
      onClose();
      onSent?.();
    } catch {
      showToast(t('report.failed'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppDialog
      visible={visible}
      icon="flag"
      title={t('report.title')}
      subtitle={group === 'question' ? t('report.subtitleQuestion') : t('report.subtitleContent')}
      accent={REPORT_ACCENT}
      confirmLabel={t('report.send')}
      confirmIcon="send"
      cancelLabel={t('common.cancel')}
      confirmDisabled={!ready}
      confirmLoading={submitting}
      onConfirm={() => void submit()}
      onCancel={close}
    >
      {/* ===== Auto-filled context ===== */}
      {target ? (
        <View style={[styles.contextCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm }]}>
          <View style={styles.contextHead}>
            <Text variant="caption" weight="bold" style={{ color: REPORT_ACCENT, letterSpacing: 0.4 }}>
              {t('report.contextTitle').toUpperCase()}
            </Text>
            <View style={[styles.originPill, { backgroundColor: `${REPORT_ACCENT}18`, borderRadius: radius.pill }]}>
              <Text variant="caption" weight="semiBold" style={{ color: REPORT_ACCENT }} numberOfLines={1}>
                {target.contextLabel}
              </Text>
            </View>
          </View>

          <Text variant="bodySmall" weight="semiBold" style={styles.contextTitle}>{target.title}</Text>

          {target.meta?.length ? (
            <View style={styles.metaWrap}>
              {target.meta.map((row) => (
                <Text key={`${row.label}-${row.value}`} variant="caption" secondary numberOfLines={1}>
                  {row.label}: {row.value}
                </Text>
              ))}
            </View>
          ) : null}

          {target.options?.length ? (
            <View style={styles.optionWrap}>
              {target.options.map((option, index) => {
                const correct = target.answerIndex === index;
                return (
                  <View key={`${index}-${option}`} style={styles.optionRow}>
                    <View
                      style={[
                        styles.optionBullet,
                        {
                          borderColor: correct ? colors.success : colors.border,
                          backgroundColor: correct ? colors.success : 'transparent',
                        },
                      ]}
                    >
                      <Text variant="caption" weight="bold" style={{ color: correct ? '#FFFFFF' : colors.textSecondary, fontSize: 10 }}>
                        {LETTERS[index] ?? String(index + 1)}
                      </Text>
                    </View>
                    <Text variant="caption" style={{ flex: 1, lineHeight: 17 }} numberOfLines={3}>{option}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          {!target.options?.length && target.body?.trim() ? (
            <Text variant="caption" secondary numberOfLines={4} style={{ lineHeight: 17 }}>{target.body.trim()}</Text>
          ) : null}
        </View>
      ) : null}

      {/* ===== Category ===== */}
      <View style={styles.labelRow}>
        <Text variant="bodySmall" weight="semiBold">{t('report.categoryLabel')}</Text>
        <Text variant="caption" secondary>{t('report.categoryHint')}</Text>
      </View>
      <View style={styles.chipWrap}>
        {categories.map((key) => {
          const active = category === key;
          return (
            <Pressable
              key={key}
              disabled={submitting}
              onPress={() => setCategory(key)}
              style={[
                styles.chip,
                {
                  borderColor: active ? REPORT_ACCENT : colors.border,
                  backgroundColor: active ? `${REPORT_ACCENT}16` : colors.surfaceAlt,
                  opacity: submitting ? 0.6 : 1,
                },
              ]}
            >
              <Text variant="caption" weight="semiBold" style={{ color: active ? REPORT_ACCENT : colors.textSecondary }}>
                {t(`report.cat.${key}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isOther ? (
        <TextField
          label={t('report.customLabel')}
          value={custom}
          onChangeText={setCustom}
          placeholder={t('report.customPlaceholder')}
          editable={!submitting}
          maxLength={60}
          containerStyle={{ marginTop: spacing.xs }}
        />
      ) : null}

      {/* ===== Explanation ===== */}
      <TextField
        label={t('report.explanationLabel')}
        value={description}
        onChangeText={setDescription}
        placeholder={t('report.explanationPlaceholder')}
        multiline
        textAlignVertical="top"
        editable={!submitting}
        containerStyle={{ marginTop: spacing.xs }}
        style={{ minHeight: 96 }}
      />
    </AppDialog>
  );
}

const styles = StyleSheet.create({
  contextCard: { borderWidth: StyleSheet.hairlineWidth, gap: 8 },
  contextHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  originPill: { paddingHorizontal: 8, paddingVertical: 3, maxWidth: '62%' },
  contextTitle: { lineHeight: 19 },
  metaWrap: { gap: 2 },
  optionWrap: { gap: 6 },
  optionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  optionBullet: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 },
});

export default ReportDialog;
