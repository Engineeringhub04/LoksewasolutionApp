// The public "this account is premium" mark.
//
// DESIGN (2026-09-18): the user-supplied SVG seal icon — a starburst with a
// scalloped edge, drawn in BLACK (user request: "black color hos"). The seal
// path fills the whole viewBox; its scalloped edge is the design, so the badge
// never circle-clips it.
//
// It holds no state and asks no questions — whoever renders it has already
// decided the account is premium. That is deliberate: the badge shows up in
// public lists (leaderboards, exam rankings) where the row being drawn belongs
// to somebody else, so the entitlement can only ever come from the data, never
// from the signed-in user's own profile.
import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/** Kept for API compatibility — the seal's colour is now always black. */
export const VERIFIED_BLUE = '#111111';

/** The full user-supplied seal path, INCLUDING the check cut-out (evenodd). */
const SEAL_PATH =
  'M238.738 271.339 210.764 244.4a15 15 0 1 0-20.8 21.6l38.558 37.139a14.965 14.965 0 0 0 21.009-.184l72.719-72.718a15 15 0 0 0-21.215-21.215l-62.294 62.317zM257.03.007a34.56 34.56 0 0 1 23.474 10.1l30.723 30.746a4.21 4.21 0 0 0 4.49 1.214l42-11.249a34.66 34.66 0 0 1 42.43 24.492l11.25 42a4.22 4.22 0 0 0 3.276 3.276l42.018 11.25a34.705 34.705 0 0 1 24.492 42.43l-11.272 42a4.29 4.29 0 0 0 1.214 4.49l30.742 30.744a34.653 34.653 0 0 1 0 48.983l-30.746 30.746a4.29 4.29 0 0 0-1.214 4.491l11.272 42a34.706 34.706 0 0 1-24.492 42.431L414.669 411.4a4.22 4.22 0 0 0-3.276 3.276l-11.25 42a34.66 34.66 0 0 1-42.43 24.491l-42-11.249a4.21 4.21 0 0 0-4.49 1.214L280.5 501.866a34.707 34.707 0 0 1-49.006 0l-30.742-30.746a4.21 4.21 0 0 0-4.468-1.214l-42.007 11.249a34.66 34.66 0 0 1-42.428-24.491l-11.251-42a4.22 4.22 0 0 0-3.281-3.276l-42-11.249a34.7 34.7 0 0 1-24.5-42.431l11.259-41.995a4.22 4.22 0 0 0-1.21-4.491L10.128 280.48a34.664 34.664 0 0 1 0-48.983l30.75-30.746a4.23 4.23 0 0 0 1.2-4.49l-11.259-42a34.7 34.7 0 0 1 24.5-42.43l42-11.25a4.22 4.22 0 0 0 3.281-3.276l11.251-41.995a34.667 34.667 0 0 1 42.428-24.492l42.007 11.249a4.18 4.18 0 0 0 4.468-1.214L231.5 10.111A34.56 34.56 0 0 1 254.971.007z';

/** The check, promoted to a white stroke on top of the black seal. */
const CHECK_PATH =
  'M227.9 281.9 200 255a15 15 0 1 0-20.8 21.6l38.6 37.1a15 15 0 0 0 21-.2l72.7-72.7a15 15 0 0 0-21.2-21.2l-62.4 62.3z';

/** Smallest badge that still reads as a seal. */
const MIN_SIZE = 10;

/**
 * Avatars below this diameter do not get a badge at all.
 *
 * 22px keeps the collapsed Home/Profile header avatars (30px) covered while
 * excluding only the tiniest inline faces.
 */
export const VERIFIED_TICK_MIN_AVATAR = 22;

/**
 * Badge diameter for an avatar of `size` — 26% keeps it small on the rim.
 */
export function verifiedTickSizeFor(avatarSize: number): number {
  return Math.max(MIN_SIZE, Math.round(avatarSize * 0.26));
}

export interface VerifiedTickProps {
  /** Outer diameter of the badge. Defaults to a standalone 18. */
  size?: number;
  /** Deprecated/unused — the seal is always black. Kept for call-site compatibility. */
  borderColor?: string;
  style?: StyleProp<ViewStyle>;
}

export function VerifiedTick({ size = 18, style }: VerifiedTickProps) {
  const diameter = Math.max(MIN_SIZE, Math.round(size));

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Verified premium member"
      style={[
        styles.badge,
        {
          width: diameter,
          height: diameter,
        },
        style,
      ]}
    >
      {/* The full seal, unclipped and uncropped: the scalloped edge is the
          design. Black fill, white check on top. */}
      <Svg width={diameter} height={diameter} viewBox="0 0 512 512">
        <Path d={SEAL_PATH} fill="#111111" fillRule="evenodd" />
        <Path d={CHECK_PATH} fill="#FFFFFF" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  // No clipping: the seal's scalloped edge IS the shape.
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
