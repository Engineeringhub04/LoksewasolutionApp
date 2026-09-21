// Four things worth aiming at, ordered by how close they are.
//
// Ordering matters more than the list does. A milestone at 3% is discouraging
// noise; the one at 80% is the reason someone opens the app tomorrow, so it goes
// first and anything already earned drops to the bottom.
import React, { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { Text } from '@/src/components/misc/Text';
import { useTheme } from '@/src/core/theme';
import type { Milestone } from './analyticsDerive';

const TRACK = 6;
const STAGGER_SPAN = 0.5;

export interface MilestoneListProps {
  milestones: Milestone[];
  /** milestone key → the line the user reads. Built by the screen so i18n stays there. */
  labelFor: (milestone: Milestone) => string;
  doneLabel: string;
  onPress?: () => void;
}

export function MilestoneList({ milestones, labelFor, doneLabel, onPress }: MilestoneListProps) {
  const { colors, motion, radius, spacing } = useTheme();
  const progress = useSharedValue(0);

  const signature = milestones.map((item) => `${item.key}:${Math.round(item.progress)}`).join('|');

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: motion.emphasis, easing: Easing.out(Easing.cubic) });
  }, [signature, motion.emphasis, progress]);

  const body = (
    <View style={{ gap: spacing.md }}>
      {milestones.map((milestone, index) => (
        <View key={milestone.key} style={{ gap: 6, opacity: milestone.done ? 0.65 : 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: radius.sm,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: `${milestone.color}1F`,
              }}
            >
              <Ionicons
                name={
                  (milestone.done ? 'checkmark' : milestone.icon) as React.ComponentProps<
                    typeof Ionicons
                  >['name']
                }
                size={15}
                color={milestone.color}
              />
            </View>

            <Text variant="bodySmall" weight="medium" numberOfLines={1} style={{ flex: 1 }}>
              {labelFor(milestone)}
            </Text>

            <Text
              variant="caption"
              weight="semiBold"
              color={milestone.done ? colors.success : colors.textSecondary}
              numberOfLines={1}
            >
              {milestone.done
                ? doneLabel
                : `${milestone.currentLabel} / ${milestone.targetLabel}`}
            </Text>
          </View>

          <View
            style={{
              height: TRACK,
              borderRadius: radius.pill,
              backgroundColor: colors.surfaceAlt,
              overflow: 'hidden',
            }}
          >
            <Fill
              ratio={Math.max(0, Math.min(1, milestone.progress / 100))}
              color={milestone.done ? colors.success : milestone.color}
              progress={progress}
              startAt={(index / Math.max(1, milestones.length)) * STAGGER_SPAN}
              radius={radius.pill}
            />
          </View>
        </View>
      ))}
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
      {body}
    </Pressable>
  );
}

function Fill({
  ratio,
  color,
  progress,
  startAt,
  radius,
}: {
  ratio: number;
  color: string;
  progress: SharedValue<number>;
  startAt: number;
  radius: number;
}) {
  // One shared timeline, sliced per row — four bars, one animation.
  const style = useAnimatedStyle(() => {
    const span = 1 - startAt;
    const local = span <= 0 ? 1 : Math.max(0, Math.min(1, (progress.value - startAt) / span));
    return { width: `${ratio * local * 100}%` };
  });

  return <Animated.View style={[{ height: '100%', borderRadius: radius, backgroundColor: color }, style]} />;
}
