// Switches which subcourse the analytics page is describing.
//
// Only shown when the user actually has more than one subcourse with recorded
// history — offering a picker with a single entry is noise, and the hero card
// hides its affordance in that case for the same reason.
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Text } from '@/src/components/misc/Text';
import { BottomSheet } from '@/src/components/feedback/BottomSheet';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';

export interface SubcourseOption {
  subcourseId: string;
  courseId: string;
  /** Resolved display name; falls back to the course name upstream, never the id. */
  name: string;
  percent: number;
  points: number;
}

export interface SubcoursePickerProps {
  visible: boolean;
  onClose: () => void;
  options: SubcourseOption[];
  selectedId: string;
  onSelect: (subcourseId: string) => void;
}

export function SubcoursePicker({
  visible,
  onClose,
  options,
  selectedId,
  onSelect,
}: SubcoursePickerProps) {
  const { colors, radius, spacing } = useTheme();
  const { t } = useTranslation();

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={{ gap: spacing.md }}>
        <View style={{ gap: 2 }}>
          <Text variant="h3" weight="bold">
            {t('analytics.picker.title')}
          </Text>
          <Text variant="caption" secondary>
            {t('analytics.picker.subtitle')}
          </Text>
        </View>

        {/* Capped rather than unbounded: a user with many subcourses should get a
            scrolling list, not a sheet taller than the screen. */}
        <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
          <View style={{ gap: spacing.sm }}>
            {options.map((option) => {
              const selected = option.subcourseId === selectedId;
              return (
                <Pressable
                  key={option.subcourseId}
                  onPress={() => {
                    onSelect(option.subcourseId);
                    onClose();
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                    padding: spacing.md,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? `${colors.primary}14` : colors.surfaceAlt,
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={selected ? colors.primary : colors.textDisabled}
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text variant="body" weight={selected ? 'bold' : 'medium'} numberOfLines={1}>
                      {option.name}
                    </Text>
                    <Text variant="caption" secondary numberOfLines={1}>
                      {formatPercent(option.percent)} · {option.points} {t('leaderboard.pts')}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </BottomSheet>
  );
}

/** Trims a trailing ".0" so whole percentages don't read as false precision. */
function formatPercent(value: number): string {
  const rounded = Math.round((Number.isFinite(value) ? value : 0) * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}
