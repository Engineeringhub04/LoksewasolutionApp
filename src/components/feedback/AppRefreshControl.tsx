// Single source of truth for pull-to-refresh across every screen.
//
// Why this exists: every screen previously passed only `tintColor` to
// RefreshControl. `tintColor` is **iOS-only** — on Android the spinner colour
// comes from the `colors` array prop instead, so Android fell back to the
// platform default grey and the pull-to-refresh indicator looked different
// (or barely visible) from screen to screen. Routing every screen through this
// component guarantees the exact same branded circular spinner everywhere.
import React from 'react';
import { ActivityIndicator, Platform, RefreshControl, StyleSheet, type RefreshControlProps } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';

export type AppRefreshControlProps = Omit<RefreshControlProps, 'tintColor' | 'colors' | 'progressBackgroundColor'>;

/**
 * NOTE on `progressViewOffset` (inherited from RefreshControlProps):
 * screens whose header is a FIXED absolute overlay (Home, Profile) must pass
 * their header height here. The spinner is drawn at the top edge of the scroll
 * view's frame, which on those screens sits *underneath* the header overlay —
 * so without an offset the spinner is completely hidden and pull-to-refresh
 * looks broken even though it is firing.
 */
export function AppRefreshControl(props: AppRefreshControlProps) {
  const { colors } = useTheme();
  return (
    <RefreshControl
      {...props}
      // iOS
      tintColor={colors.primary}
      // Android (array is required — a single colour prop is ignored there)
      colors={[colors.primary]}
      progressBackgroundColor={colors.surface}
    />
  );
}

/**
 * Home and Profile have a fixed collapsing header above their native scroll
 * view. On iOS, UIRefreshControl is rendered inside that scroll view and can
 * therefore sit behind the header. This small native spinner mirrors the
 * platform refresh indicator while the real RefreshControl still owns the
 * pull gesture and refresh lifecycle.
 */
export function IOSRefreshIndicator({
  pullDistance,
  headerBottom,
}: {
  /** Native ScrollView offset; negative values mean the user is pulling down. */
  pullDistance: SharedValue<number>;
  /** The bottom edge of the fixed/collapsing header. */
  headerBottom: number;
}) {
  const { colors } = useTheme();
  const indicatorStyle = useAnimatedStyle(() => {
    const pull = Math.max(0, -pullDistance.value);
    return {
      opacity: Math.min(1, pull / 18),
      transform: [{ translateY: Math.min(pull, 72) }],
    };
  });

  if (Platform.OS !== 'ios') return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.iosIndicator, { top: headerBottom }, indicatorStyle]}>
      <ActivityIndicator size="small" color={colors.primary} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  iosIndicator: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 70,
  },
});
