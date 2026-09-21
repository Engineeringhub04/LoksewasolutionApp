// Horizontal status filter for list pages (Reports, Purchases, Submissions).
//
// Sizes are fixed per tab from the label, and the active pill is the only thing
// that changes — no font-weight or padding swap on selection, because that made
// the whole track shift by a pixel or two every time a tab was tapped.
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';
import { useTones } from '@/src/components/premium/tone';

export interface FilterTrackItem<T extends string> {
  value: T;
  label: string;
  /** Shown as a trailing count. Pass undefined to hide it entirely. */
  count?: number;
}

export interface FilterTrackProps<T extends string> {
  items: FilterTrackItem<T>[];
  value: T;
  onChange: (next: T) => void;
  style?: StyleProp<ViewStyle>;
}

export function FilterTrack<T extends string>({ items, value, onChange, style }: FilterTrackProps<T>) {
  const { colors, spacing, radius } = useTheme();
  const tones = useTones();
  const active = tones.primary;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.track, { paddingHorizontal: spacing.screenPadding, gap: spacing.sm }, style]}
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <Pressable
            key={item.value}
            onPress={() => onChange(item.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.chip,
              {
                borderRadius: radius.pill,
                backgroundColor: selected ? active.solid : pressed ? active.bg : colors.surface,
                borderColor: selected ? active.solid : colors.border,
              },
            ]}
          >
            <Text
              variant="bodySmall"
              weight="bold"
              numberOfLines={1}
              style={{ color: selected ? active.onSolid : colors.textSecondary }}
            >
              {item.label}
            </Text>
            {item.count === undefined ? null : (
              <View
                style={[
                  styles.count,
                  {
                    borderRadius: radius.pill,
                    backgroundColor: selected ? `${active.onSolid}2E` : colors.surfaceAlt,
                  },
                ]}
              >
                <Text variant="overline" weight="bold" style={{ color: selected ? active.onSolid : colors.textSecondary }}>
                  {item.count}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderWidth: StyleSheet.hairlineWidth,
  },
  count: { minWidth: 20, paddingHorizontal: 5, paddingVertical: 1, alignItems: 'center' },
});
