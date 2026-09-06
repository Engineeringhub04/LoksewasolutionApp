// Shared building blocks for the Profile screen's three sections
// (Account / App Settings / Support). Kept in one file because they're small,
// only used together, and share the same visual language.
import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';

export function SectionHeading({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
  const { colors, spacing } = useTheme();
  return (
    <View style={[styles.headingRow, { marginBottom: spacing.sm, paddingHorizontal: spacing.xs }]}>
      <Ionicons name={icon} size={18} color={colors.textPrimary} />
      <Text variant="bodyLarge" weight="bold">{title}</Text>
    </View>
  );
}

/** Card wrapper that draws hairline dividers between its children. */
export function SectionCard({ children }: { children: React.ReactNode }) {
  const { colors, radius } = useTheme();
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: radius.lg, borderColor: colors.border }]}>
      {items.map((child, index) => (
        <View key={index}>
          {index > 0 ? <View style={[styles.divider, { backgroundColor: colors.divider }]} /> : null}
          {child}
        </View>
      ))}
    </View>
  );
}

interface InfoRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  /** Resolved value. When null the `addLabel` placeholder is shown instead. */
  value: string | null;
  /** Shown (and made tappable) only when `value` is null — e.g. "Add your Date of Birth". */
  addLabel: string;
  onAddPress: () => void;
}

/**
 * A single Account field. Once a value exists the row is intentionally NOT
 * pressable — only the still-empty fields invite a tap through to the edit
 * screen, which is what was asked for (no "-" placeholders anywhere).
 */
export function InfoRow({ icon, label, value, addLabel, onAddPress }: InfoRowProps) {
  const { colors, spacing, radius } = useTheme();
  const isEmpty = !value;

  const body = (
    <View style={[styles.row, { padding: spacing.md, gap: spacing.md }]}>
      <View style={[styles.iconBox, { backgroundColor: colors.surfaceAlt, borderRadius: radius.md }]}>
        <Ionicons name={icon} size={20} color={isEmpty ? colors.textSecondary : colors.textPrimary} />
      </View>
      <View style={styles.rowBody}>
        <Text variant="caption" secondary>{label}</Text>
        {isEmpty ? (
          <Text variant="bodyLarge" weight="semiBold" style={{ color: colors.primary }} numberOfLines={1}>
            {addLabel}
          </Text>
        ) : (
          <Text variant="bodyLarge" weight="bold" numberOfLines={1}>{value}</Text>
        )}
      </View>
      {isEmpty ? <Ionicons name="add-circle-outline" size={20} color={colors.primary} /> : null}
    </View>
  );

  if (isEmpty) {
    return (
      <Pressable onPress={onAddPress} style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
        {body}
      </Pressable>
    );
  }
  return body;
}

interface MenuRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  /** Renders the icon + label in the error colour (used for Delete Account / Logout). */
  destructive?: boolean;
  /** Optional trailing text, e.g. the current course name. */
  trailingText?: string | null;
}

export function MenuRow({ icon, label, onPress, destructive, trailingText }: MenuRowProps) {
  const { colors, spacing, radius } = useTheme();
  const tint = destructive ? colors.error : colors.primary;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, { padding: spacing.md, gap: spacing.md }, pressed && styles.pressed]}>
      <View style={[styles.iconBox, { backgroundColor: destructive ? `${colors.error}17` : `${colors.primary}17`, borderRadius: radius.md }]}>
        <Ionicons name={icon} size={20} color={tint} />
      </View>
      <Text variant="bodyLarge" weight="medium" style={{ flex: 1, color: destructive ? colors.error : colors.textPrimary }} numberOfLines={1}>
        {label}
      </Text>
      {trailingText ? (
        <Text variant="caption" secondary numberOfLines={1} style={styles.trailingText}>{trailingText}</Text>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

/**
 * Three-up stats strip. Values come from users/{uid}.stats and are all zero
 * for now — the aggregation that would populate them doesn't exist yet, so
 * they're shown as 0 rather than fabricated.
 */
export function StatsStrip({ testsTaken, streak, points }: { testsTaken: number; streak: number; points: number }) {
  const { colors, spacing, radius } = useTheme();
  const items = [
    { icon: 'document-text-outline' as const, label: 'Tests', value: testsTaken },
    { icon: 'flame-outline' as const, label: 'Streak', value: streak },
    { icon: 'star-outline' as const, label: 'Points', value: points },
  ];

  return (
    <View style={[styles.statsRow, { backgroundColor: colors.surface, borderRadius: radius.lg, borderColor: colors.border, padding: spacing.md }]}>
      {items.map((item, index) => (
        <React.Fragment key={item.label}>
          {index > 0 ? <View style={[styles.statsDivider, { backgroundColor: colors.divider }]} /> : null}
          <View style={styles.statItem}>
            <Ionicons name={item.icon} size={18} color={colors.primary} />
            <Text variant="h3" weight="bold">{item.value}</Text>
            <Text variant="caption" secondary>{item.label}</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  card: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBody: { flex: 1, gap: 2 },
  iconBox: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  trailingText: { maxWidth: 120 },
  pressed: { opacity: 0.65 },
  statsRow: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statsDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: 4 },
});
