// Premium notice card — used by BOTH Home's "Recent Notices" section and the
// full Notices list, so the two can never drift apart.
//
// UI only — same props plus two optional presentation hints (`kind`, the
// excerpt), same onPress. What changed:
//   * every notice used to be a `megaphone` in a blue chip, so a maintenance
//     report and a welcome message were visually identical. The icon and the
//     colour now come from the notice's kind (src/components/notice/noticeVisuals.ts).
//   * the static 4px primary bar became the house accent spine: a short nub at
//     rest that grows out from the centre — up and down at once — while pressed.
//     Same recipe as GorkhapatraCard, so list rows across the app answer touch
//     the same way.
//   * pressing no longer just fades the whole card to 0.9 opacity (which dims
//     the text too). The surface swaps to surfaceAlt and the border picks up the
//     accent, exactly like the notification rows.
//   * the date left its hand-rolled surfaceAlt pill for the shared StatusPill.
import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';
import { StatusPill, useTones } from '@/src/components/premium';
import { noticeVisual } from '@/src/components/notice/noticeVisuals';
import type { NoticeKind } from '@/src/core/firebase/services/notices';

// Height of the resting nub — small enough to read as a quiet accent mark, big
// enough that the "grows from here" origin is obvious once you press.
const SPINE_NUB_HEIGHT = 24;
const SPINE_WIDTH = 4;

export interface PremiumNoticeCardProps {
  title: string;
  date: string;
  onPress: () => void;
  /** Picks the icon + colour. Omitted falls back to the generic notice look. */
  kind?: NoticeKind;
  /** Optional two-line excerpt. Home passes it too, so both lists match. */
  description?: string;
}

export function PremiumNoticeCard({ title, date, onPress, kind, description }: PremiumNoticeCardProps) {
  const { colors, radius, spacing, elevation, motion } = useTheme();
  const tones = useTones();
  const visual = noticeVisual(kind);
  const tone = tones[visual.tone];

  const fill = useSharedValue(0);
  // scaleY on a full-height bar, not an animated `height`. RN scales around the
  // view's centre, so one shared value gives the exact "opens from the middle,
  // upward and downward at once" motion.
  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: fill.value }] }));
  const nubStyle = useAnimatedStyle(() => ({ opacity: 1 - fill.value }));

  const handlePressIn = () => {
    fill.value = withTiming(1, { duration: motion.standard, easing: Easing.out(Easing.cubic) });
  };
  const handlePressOut = () => {
    fill.value = withTiming(0, { duration: motion.standard, easing: Easing.in(Easing.cubic) });
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={({ pressed }) => [
        styles.card,
        elevation[1],
        {
          backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
          borderColor: pressed ? `${tone.solid}55` : colors.divider,
          borderRadius: radius.lg,
          padding: spacing.md,
          // Extra left inset so the accent spine never crowds the icon tile.
          paddingLeft: spacing.md + 6,
        },
      ]}
    >
      <View style={styles.spineTrack} pointerEvents="none">
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: tone.solid }, fillStyle]} />
        <Animated.View style={[styles.spineNub, { backgroundColor: tone.solid }, nubStyle]} />
      </View>

      <View style={[styles.iconTile, { backgroundColor: tone.bg, borderColor: tone.border, borderRadius: radius.md }]}>
        <Ionicons name={visual.icon} size={18} color={tone.fg} />
      </View>

      <View style={styles.textCol}>
        <Text variant="bodySmall" weight="bold" numberOfLines={2}>{title}</Text>
        {description ? (
          <Text variant="caption" secondary numberOfLines={2} style={{ lineHeight: 17 }}>{description}</Text>
        ) : null}
        <View style={styles.metaRow}>
          <StatusPill label={visual.label} tone={visual.tone} size="sm" />
          <StatusPill label={date} tone="neutral" icon="time-outline" size="sm" />
        </View>
      </View>

      <Ionicons name="chevron-forward" size={18} color={colors.textDisabled} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // overflow:hidden clips the spine to the card's rounded corners.
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  spineTrack: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SPINE_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spineNub: { width: SPINE_WIDTH, height: SPINE_NUB_HEIGHT, borderRadius: SPINE_WIDTH / 2 },
  iconTile: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  textCol: { flex: 1, gap: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
});
