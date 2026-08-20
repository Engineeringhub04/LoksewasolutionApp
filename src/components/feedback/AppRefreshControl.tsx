// Single source of truth for pull-to-refresh across every screen.
//
// Why this exists: every screen previously passed only `tintColor` to
// RefreshControl. `tintColor` is **iOS-only** — on Android the spinner colour
// comes from the `colors` array prop instead, so Android fell back to the
// platform default grey and the pull-to-refresh indicator looked different
// (or barely visible) from screen to screen. Routing every screen through this
// component guarantees the exact same branded circular spinner everywhere.
import React from 'react';
import { ActivityIndicator, Platform, RefreshControl, StyleSheet, View, type RefreshControlProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
export function IOSRefreshIndicator({ visible }: { visible: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  if (Platform.OS !== 'ios' || !visible) return null;

  return (
    <View pointerEvents="none" style={[styles.iosIndicator, { top: insets.top + 10 }]}>
      <ActivityIndicator size="small" color={colors.primary} />
    </View>
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
