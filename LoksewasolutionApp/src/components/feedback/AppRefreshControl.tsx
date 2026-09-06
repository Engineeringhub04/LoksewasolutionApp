// Single source of truth for pull-to-refresh across every screen.
//
// Why this exists: every screen previously passed only `tintColor` to
// RefreshControl. `tintColor` is **iOS-only** — on Android the spinner colour
// comes from the `colors` array prop instead, so Android fell back to the
// platform default grey and the pull-to-refresh indicator looked different
// (or barely visible) from screen to screen. Routing every screen through this
// component guarantees the exact same branded circular spinner everywhere.
import React from 'react';
import { RefreshControl, type RefreshControlProps } from 'react-native';
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
