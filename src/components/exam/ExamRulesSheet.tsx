// Exam rules popup.
//
// Opened either from a card's "Rules" button (informational — primary action is
// just "OK") or immediately before an attempt starts (primary action becomes
// "Start Quiz"). The caller decides via `primaryLabel`.
//
// Built on AppDialog so it is the same object as every other dialog in the app.
// The old header carried its own X button; the footer Cancel is now the way out,
// which is the shell's single convention for dismissing — one exit, not two.
//
// Uses real Ionicons throughout rather than emoji, per the design direction.
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';
import { Spinner } from '@/src/components/feedback/Spinner';
import { AppDialog } from '@/src/components/feedback/AppDialog';
import type { ExamRule } from '@/src/core/firebase/services/examHub';

interface ExamRulesSheetProps {
  visible: boolean;
  onClose: () => void;
  rules: ExamRule[];
  loading?: boolean;
  examTitle?: string;
  /** Accent colour of the owning section. */
  accentColor?: string;
  /** Label for the confirming button — e.g. "OK" or "Start Quiz". */
  primaryLabel: string;
  /** Called when the primary button is pressed. Defaults to closing. */
  onPrimaryPress?: () => void;
}

export function ExamRulesSheet({
  visible,
  onClose,
  rules,
  loading = false,
  examTitle,
  accentColor = '#2563EB',
  primaryLabel,
  onPrimaryPress,
}: ExamRulesSheetProps) {
  const { colors, radius, spacing } = useTheme();

  return (
    <AppDialog
      visible={visible}
      icon="shield-checkmark"
      title="Exam Rules"
      subtitle={examTitle}
      accent={accentColor}
      confirmLabel={primaryLabel}
      cancelLabel="Close"
      // Published rule sets run long, so the body creeps through them on its own
      // rather than relying on the user noticing there is more below.
      autoScroll
      onConfirm={onPrimaryPress ?? onClose}
      onCancel={onClose}
    >
      {loading ? (
        <View style={styles.loadingBox}>
          <Spinner />
        </View>
      ) : rules.length === 0 ? (
        <View style={styles.loadingBox}>
          <Ionicons name="document-text-outline" size={40} color={colors.textDisabled} />
          <Text variant="bodySmall" secondary style={{ textAlign: 'center', marginTop: spacing.sm }}>
            Rules for this exam have not been published yet.
          </Text>
        </View>
      ) : (
        rules.map((rule, index) => (
          <Animated.View
            key={`${rule.title}-${index}`}
            entering={FadeInDown.delay(index * 45).duration(240)}
            style={styles.ruleRow}
          >
            <View style={[styles.ruleIcon, { backgroundColor: `${accentColor}17`, borderRadius: radius.md }]}>
              <Ionicons name={rule.icon as never} size={18} color={accentColor} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <View style={styles.ruleTitleRow}>
                <View style={[styles.stepBadge, { backgroundColor: `${accentColor}17` }]}>
                  <Text variant="caption" weight="bold" style={{ color: accentColor }}>{index + 1}</Text>
                </View>
                <Text variant="body" weight="bold" style={{ flex: 1 }}>{rule.title}</Text>
              </View>
              <Text variant="bodySmall" secondary style={{ lineHeight: 19 }}>{rule.description}</Text>
            </View>
          </Animated.View>
        ))
      )}
    </AppDialog>
  );
}

const styles = StyleSheet.create({
  loadingBox: { padding: 32, alignItems: 'center', justifyContent: 'center' },
  ruleRow: { flexDirection: 'row', gap: 12 },
  ruleIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  ruleTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
});
