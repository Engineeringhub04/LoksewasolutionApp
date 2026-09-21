// The two rows that turn the charts above into something to actually do next.
//
// Everything higher up the page describes; this prescribes. That is why it is the
// only section with a destination attached — a chart the user cannot act on is
// entertainment, and the whole point of the radar and the ranked bars is that
// they feed these two rows.
import React from 'react';
import { Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Text } from '@/src/components/misc/Text';
import { useTheme } from '@/src/core/theme';

export type InsightTone = 'strength' | 'focus';

export interface InsightCardProps {
  tone: InsightTone;
  /** "Your strongest area" / "Worth a look". */
  eyebrow: string;
  /** The source name — "Practice", "Daily Test". */
  title: string;
  /** One line of reasoning; never just a restatement of the number. */
  description: string;
  /** Formatted figure shown on the right, e.g. "82%". Hidden when absent. */
  value?: string;
  /** Fixed source hue, so this card matches its slice on the radar and donut. */
  accent: string;
  ctaLabel: string;
  onPress: () => void;
}

export function InsightCard({
  tone,
  eyebrow,
  title,
  description,
  value,
  accent,
  ctaLabel,
  onPress,
}: InsightCardProps) {
  const { colors, radius, spacing } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${eyebrow}: ${title}. ${ctaLabel}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radius.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        // A hairline in the source's own colour down the leading edge: enough to
        // tie the card to its chart slice without tinting the whole surface,
        // which reads as an alert rather than a suggestion.
        borderLeftWidth: 3,
        borderLeftColor: accent,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: `${accent}1F`,
        }}
      >
        <Ionicons
          name={tone === 'strength' ? 'ribbon' : 'trending-up'}
          size={20}
          color={accent}
        />
      </View>

      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Text variant="caption" secondary numberOfLines={1}>
          {eyebrow}
        </Text>
        <Text variant="body" weight="bold" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="caption" secondary numberOfLines={2}>
          {description}
        </Text>
      </View>

      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        {value ? (
          <Text variant="bodyLarge" weight="bold" color={accent} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Text variant="caption" weight="semiBold" color={colors.primary} numberOfLines={1}>
            {ctaLabel}
          </Text>
          <Ionicons name="chevron-forward" size={13} color={colors.primary} />
        </View>
      </View>
    </Pressable>
  );
}
