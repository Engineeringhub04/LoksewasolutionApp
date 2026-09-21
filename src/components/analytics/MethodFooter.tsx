// §15 — how the number at the top of the page was arrived at, and when.
//
// Two jobs in one footer, both about trust. The weights table exists because a
// score nobody can audit is a score nobody believes: every figure here is read
// from the real `PERCENT_WEIGHTS` and `TIME_POINTS_CAP` constants, so the
// explanation cannot drift away from the scoring code the way a hand-written
// paragraph would.
//
// Collapsed by default. This is reference material — the answer to a question the
// user only asks once — and it does not deserve permanent screen space.
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { Text } from '@/src/components/misc/Text';
import { useTheme } from '@/src/core/theme';
import { TIME_POINTS_CAP_HOURS, relativeTime, weightRows } from './analyticsDerive';

/** How often the "updated" line re-reads the clock. */
const TICK_MS = 30 * 1000;

export interface MethodFooterProps {
  title: string;
  /** One line on what the page is measuring, above the weights. */
  intro: string;
  /** Heading for the weights table. */
  weightsTitle: string;
  /** Resolves a source's display name from its i18n key. */
  labelFor: (labelKey: string) => string;
  /** Sentence about the time cap; receives the real cap in hours. */
  timeNote: (hours: number) => string;
  /** Sentence about reconstructed days. */
  estimateNote: string;
  /** Sentence about the data being private to this account. */
  privacyNote: string;
  expandLabel: string;
  collapseLabel: string;
  /** Epoch ms the payload on screen was fetched at. */
  fetchedAt: number;
  /** Renders "just now" / "5 min ago" from a key and a number. */
  updatedLabel: (key: string, value: number) => string;
}

export function MethodFooter({
  title,
  intro,
  weightsTitle,
  labelFor,
  timeNote,
  estimateNote,
  privacyNote,
  expandLabel,
  collapseLabel,
  fetchedAt,
  updatedLabel,
}: MethodFooterProps) {
  const { colors, radius, spacing } = useTheme();
  const [open, setOpen] = useState(false);

  const rows = weightRows();

  return (
    <Animated.View
      layout={LinearTransition.duration(220)}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.lg,
        },
      ]}
    >
      <Pressable
        onPress={() => setOpen((prev) => !prev)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.head, { padding: spacing.md, opacity: pressed ? 0.8 : 1 }]}
      >
        <View style={[styles.icon, { backgroundColor: `${colors.primary}17`, borderRadius: radius.md }]}>
          <Ionicons name="help-circle-outline" size={19} color={colors.primary} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
          <Text variant="bodySmall" weight="bold" numberOfLines={1}>
            {title}
          </Text>
          <Text variant="caption" secondary numberOfLines={1}>
            {open ? collapseLabel : expandLabel}
          </Text>
        </View>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={17}
          color={colors.textSecondary}
        />
      </Pressable>

      {open ? (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(120)}
          style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm }}
        >
          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          <Text variant="caption" secondary style={styles.para}>
            {intro}
          </Text>

          <Text variant="caption" weight="semiBold">
            {weightsTitle}
          </Text>

          {/* One row per source, the bar length being its share of the total
              weight — the table and the picture are the same object. */}
          <View style={{ gap: 6 }}>
            {rows.map((row) => (
              <View key={row.source} style={styles.weightRow}>
                <View style={[styles.swatch, { backgroundColor: row.color }]} />
                <Text variant="caption" numberOfLines={1} style={{ flex: 1 }}>
                  {labelFor(row.labelKey)}
                </Text>
                <View
                  style={[
                    styles.weightTrack,
                    { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill },
                  ]}
                >
                  <View
                    style={{
                      width: `${row.share}%`,
                      height: '100%',
                      borderRadius: radius.pill,
                      backgroundColor: row.color,
                    }}
                  />
                </View>
                <Text variant="caption" weight="semiBold" secondary style={styles.weightValue}>
                  ×{row.weight}
                </Text>
              </View>
            ))}
          </View>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          <Note color={colors.textSecondary} icon="time-outline" text={timeNote(TIME_POINTS_CAP_HOURS)} />
          <Note color={colors.textSecondary} icon="analytics-outline" text={estimateNote} />
          <Note color={colors.success} icon="lock-closed-outline" text={privacyNote} />
        </Animated.View>
      ) : null}

      <View style={[styles.divider, { backgroundColor: colors.divider }]} />
      <UpdatedLine fetchedAt={fetchedAt} render={updatedLabel} />
    </Animated.View>
  );
}

function Note({
  color,
  icon,
  text,
}: {
  color: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  text: string;
}) {
  return (
    <View style={styles.noteRow}>
      <Ionicons name={icon} size={13} color={color} style={{ marginTop: 2 }} />
      <Text variant="caption" secondary style={[styles.para, { flex: 1 }]}>
        {text}
      </Text>
    </View>
  );
}

/**
 * The ticking clock, isolated on purpose.
 *
 * A timer at page level would re-render every chart above twice a minute for the
 * sake of one line of text. Keeping the interval down here means the re-render
 * costs exactly this row.
 */
function UpdatedLine({
  fetchedAt,
  render,
}: {
  fetchedAt: number;
  render: (key: string, value: number) => string;
}) {
  const { colors, spacing } = useTheme();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [fetchedAt]);

  const rel = relativeTime(fetchedAt, now);

  return (
    <View style={[styles.updated, { paddingHorizontal: spacing.md, paddingVertical: spacing.sm }]}>
      <Ionicons name="sync-outline" size={12} color={colors.textSecondary} />
      <Text variant="caption" secondary numberOfLines={1}>
        {render(rel.key, rel.value)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  divider: { height: StyleSheet.hairlineWidth },
  para: { lineHeight: 17 },
  weightRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatch: { width: 8, height: 8, borderRadius: 4 },
  weightTrack: { width: 74, height: 5, overflow: 'hidden' },
  weightValue: { width: 30, textAlign: 'right' },
  noteRow: { flexDirection: 'row', gap: 6 },
  updated: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
});
