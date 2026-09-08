// Pre-start Rules popup for the Daily Test.
//
// Tapping "Start Test" never drops the user straight into the quiz — this opens
// first, listing the model's rules POINT BY POINT so nothing about the timer or
// the negative-marking penalty is a surprise. The list comes from the model
// document itself (seeded already resolved, e.g. "Negative Marking is ON — 20%
// (0.2) of the marks is deducted…"), with buildDailyTestRules() generating an
// equivalent list for any model saved before rules existed.
import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';
import { AppDialog } from '@/src/components/feedback/AppDialog';
import {
  buildDailyTestRules,
  formatDailyTestDuration,
  totalTestSeconds,
  type DailyTestModel,
} from '@/src/core/firebase/services/dailyTest';

/**
 * Picks a vector icon that matches what a rule is actually about, so the list
 * scans visually instead of being a wall of numbered text. Keyword-matched (the
 * rules come from the model document, so their order is not guaranteed) and
 * ordered most-specific first. Ionicons only — never emoji.
 */
function ruleIcon(rule: string): { icon: keyof typeof Ionicons.glyphMap; color: string } {
  const r = rule.toLowerCase();
  if (r.includes('negative marking')) {
    return r.includes('is on')
      ? { icon: 'remove-circle-outline', color: '#DC2626' }
      : { icon: 'shield-checkmark-outline', color: '#16A34A' };
  }
  if (r.includes('skipped')) return { icon: 'play-skip-forward-outline', color: '#64748B' };
  if (r.includes('pass')) return { icon: 'flag-outline', color: '#16A34A' };
  if (r.includes('premium') || r.includes('subscription')) {
    return { icon: 'diamond-outline', color: '#D97706' };
  }
  if (r.includes('free')) return { icon: 'gift-outline', color: '#16A34A' };
  if (r.includes('previous question') || r.includes('go back')) {
    return { icon: 'arrow-undo-outline', color: '#DC2626' };
  }
  if (r.includes('leaving') || r.includes('discard')) {
    return { icon: 'exit-outline', color: '#DC2626' };
  }
  if (r.includes('one option') || r.includes('selected option')) {
    return { icon: 'radio-button-on-outline', color: '#2563EB' };
  }
  if (r.includes('review') || r.includes('after you submit')) {
    return { icon: 'list-outline', color: '#7C3AED' };
  }
  if (r.includes('mark')) return { icon: 'trophy-outline', color: '#16A34A' };
  if (r.includes('total time')) return { icon: 'hourglass-outline', color: '#7C3AED' };
  if (r.includes('timer') || r.includes('seconds')) {
    return { icon: 'timer-outline', color: '#2563EB' };
  }
  if (r.includes('difficulty')) return { icon: 'speedometer-outline', color: '#D97706' };
  if (r.includes('question')) return { icon: 'help-circle-outline', color: '#2563EB' };
  return { icon: 'ellipse-outline', color: '#64748B' };
}

export function DailyTestRulesDialog({
  visible,
  model,
  onStart,
  onCancel,
}: {
  visible: boolean;
  model: DailyTestModel | null;
  onStart: () => void;
  onCancel: () => void;
}) {
  const { colors, radius } = useTheme();

  const rules = useMemo(() => (model ? buildDailyTestRules(model) : []), [model]);

  const chips = useMemo(() => {
    if (!model) return [];
    return [
      {
        icon: 'help-circle-outline' as const,
        label: `${model.questions.length} questions`,
        color: colors.primary,
      },
      {
        icon: 'timer-outline' as const,
        label: `${model.perQuestionTimeSeconds}s / question`,
        color: '#2563EB',
      },
      {
        icon: 'hourglass-outline' as const,
        label: formatDailyTestDuration(totalTestSeconds(model)),
        color: '#7C3AED',
      },
      {
        icon: (model.negativeMarking
          ? 'remove-circle-outline'
          : 'checkmark-circle-outline') as keyof typeof Ionicons.glyphMap,
        label: model.negativeMarking
          ? `−${Math.round(model.negativeMarkPercent * 100)}% wrong`
          : 'No negative marking',
        color: model.negativeMarking ? '#DC2626' : '#16A34A',
      },
    ];
  }, [model, colors.primary]);

  if (!model) return null;

  return (
    <AppDialog
      visible={visible}
      icon="shield-checkmark"
      title="Test Rules"
      subtitle={model.modelName || model.name}
      confirmLabel="I understood (Start)"
      confirmIcon="play"
      cancelLabel="Cancel"
      // The rules list is long by design, so it creeps down on its own and back
      // up again once it reaches the end; touching it pauses that, and it resumes
      // 3s after the finger lifts.
      autoScroll
      onConfirm={onStart}
      onCancel={onCancel}
    >
      {/* Config strip — the numbers the rules refer to, at a glance. */}
      <View style={styles.chipRow}>
        {chips.map((chip) => (
          <View
            key={chip.label}
            style={[styles.chip, { backgroundColor: `${chip.color}14`, borderRadius: radius.pill }]}
          >
            <Ionicons name={chip.icon} size={13} color={chip.color} />
            <Text variant="caption" weight="bold" style={{ color: chip.color }}>
              {chip.label}
            </Text>
          </View>
        ))}
      </View>

      <View style={[styles.divider, { backgroundColor: colors.divider }]} />

      <Text variant="caption" weight="bold" secondary style={styles.eyebrow}>
        PLEASE READ BEFORE YOU START
      </Text>

      {rules.map((rule, index) => {
        const meta = ruleIcon(rule);
        return (
          <View key={`${index}-${rule.slice(0, 12)}`} style={styles.ruleRow}>
            <View style={[styles.ruleIcon, { backgroundColor: `${meta.color}18` }]}>
              <Ionicons name={meta.icon} size={14} color={meta.color} />
            </View>
            <Text variant="bodySmall" style={{ flex: 1, lineHeight: 19, color: colors.textPrimary }}>
              {rule}
            </Text>
          </View>
        );
      })}
    </AppDialog>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  divider: { height: StyleSheet.hairlineWidth, marginTop: 4 },
  eyebrow: { letterSpacing: 0.6 },
  ruleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  ruleIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
});
