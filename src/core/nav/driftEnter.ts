// Reference-project transitions, done the ONLY way native-stack can do them.
//
// WHY NOT entering/exiting LAYOUT ANIMATIONS: with a native navigator, the
// entering animation can finish before the screen is actually presented (reads
// as "too fast" or as nothing), and on pop the screen is torn down natively so
// the exiting animation never plays at all. The reference project avoided this
// by using the JS stack's cardStyleInterpolator; expo-router has no JS stack,
// so the motion is driven manually instead:
//
// OPEN  — on mount, fade 0→1 while translating +12% of screen width → 0
//         (that project's ENTER_OFFSET 0.12).
// CLOSE — the caller calls exitThen(goBack): fade 1→0 while translating
//         0 → -10% of width (EXIT_OFFSET 0.10), and ONLY after the 500ms is
//         up does the navigator pop fire. The navigator itself plays nothing
//         (root layout `animation: 'none'`), so this is the whole animation.
//
// DURATION / CURVE mirror the reference timing curve (bezier 0.2,0,0,1),
// slowed from 260ms to 500ms because the user asked for it slower.
import { useEffect, useRef } from 'react';
import { useWindowDimensions } from 'react-native';
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

export const DRIFT_DURATION = 500;
const CURVE = Easing.bezier(0.2, 0, 0, 1);
const ENTER_OFFSET = 0.12; // naya page dayan bata kati sarcha (width %)
const EXIT_OFFSET = 0.10; // close ma bayan tira kati sarcha (width %)
const TIMING = { duration: DRIFT_DURATION, easing: CURVE };
// Close is snappier than open — the user asked for a faster back animation.
const EXIT_TIMING = { duration: 260, easing: CURVE };

/**
 * Wire a screen's root with this:
 *   const { driftStyle, exitThen } = useDriftScreen();
 *   <Animated.View style={[styles.container, driftStyle]} ...>
 * Back buttons call `exitThen(() => router.back())` instead of router.back().
 */
export function useDriftScreen() {
  const { width } = useWindowDimensions();
  // OPEN: opacity stays 1 — the navigator's own cross-fade supplies the fade
  // while this view is still opaque enough to keep the background covered.
  // Drifting with opacity 0 AND a navigator fade made BOTH screens transparent
  // mid-transition = the white flash. progress 1→0 on open, 0→-0.10 on close.
  const opacity = useSharedValue(1);
  const progress = useSharedValue(1);
  const exiting = useRef(false);

  useEffect(() => {
    progress.value = withTiming(0, TIMING);
  }, [progress]);

  const driftStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: progress.value * width }],
  }));

  const exitThen = (after: () => void) => {
    if (exiting.current) return;
    exiting.current = true;
    // NO opacity fade on exit: fading out made the screen transparent, which
    // exposed the surface underneath and read as a white flash. The page stays
    // fully opaque and drifts back RIGHT (the exact reverse of open) — the gap
    // that opens on the LEFT is the real screen below (Home), which is already
    // theme-coloured, so dark mode shows dark and light mode shows light —
    // never a blank surface.
    //
    // `after` fires IMMEDIATELY, not after the drift. The navigator's pop fade
    // (250ms) and this drift (260ms) play CONCURRENTLY — waiting for the drift
    // first then popping read as "drift, pause, sudden fast pop".
    progress.value = withTiming(EXIT_OFFSET, EXIT_TIMING);
    // Small head-start so the drift is visibly moving before the pop fires —
    // popping in the same tick let the native side tear the screen down before
    // Reanimated could paint a single drifting frame. 60ms of head-start keeps
    // the drift and the pop's 250ms fade overlapping, so there is no pause.
    setTimeout(after, 60);
  };

  return { driftStyle, exitThen };
}
