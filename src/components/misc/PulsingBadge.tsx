// A notification count badge that PULSES to draw the eye — used on the Home bell
// so a new/unread notification visibly "blinks" instead of sitting there static.
//
// Two coordinated effects, both on the Reanimated UI thread (no per-frame JS):
//   • an expanding halo ring that radiates outward and fades (the "ping"), and
//   • a gentle breathing scale on the badge itself (the "blink").
// Falls back to nothing when there is no unread count, exactly like <Badge/>.
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { Badge } from '@/src/components/misc/Badge';

export interface PulsingBadgeProps {
  count?: number;
  /** Override the halo/badge colour; defaults to the theme error red. */
  color?: string;
}

export function PulsingBadge({ count, color }: PulsingBadgeProps) {
  const { colors } = useTheme();
  const active = (count ?? 0) > 0;

  // 0 → 1 loop drives the radiating halo (scale up + fade out).
  const ping = useSharedValue(0);
  // Subtle 1 → 1.12 → 1 breathing on the badge itself (the "blink").
  const breathe = useSharedValue(1);

  useEffect(() => {
    if (active) {
      ping.value = 0;
      ping.value = withRepeat(
        withTiming(1, { duration: 1400, easing: Easing.out(Easing.ease) }),
        -1,
        false,
      );
      breathe.value = withRepeat(
        withSequence(
          withTiming(1.12, { duration: 700, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    } else {
      cancelAnimation(ping);
      cancelAnimation(breathe);
      ping.value = 0;
      breathe.value = 1;
    }
    return () => {
      cancelAnimation(ping);
      cancelAnimation(breathe);
    };
  }, [active, ping, breathe]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: (1 - ping.value) * 0.5,
    transform: [{ scale: 0.85 + ping.value * 1.15 }],
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathe.value }],
  }));

  if (!active) return null;

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View style={[styles.halo, { backgroundColor: color ?? colors.error }, haloStyle]} />
      <Animated.View style={badgeStyle}>
        <Badge count={count} color={color} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  // Sits centered behind the badge; the badge's own min size is 18×18.
  halo: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
  },
});
