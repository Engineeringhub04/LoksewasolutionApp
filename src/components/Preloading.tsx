// The loading state for BOTH ranking screens — the main course leaderboard and
// the per-exam ranking — and, since the whole-app loading refactor, for every
// content screen in the app.
//
// WHY IT EXISTS AT ALL
// Screens used to render their real layout the moment they mounted and float
// `PageLoaderOverlay` over the top of it. Because the data was not in yet, what
// sat behind that overlay was fake content: empty podium stands reading "Open
// spot", "--" score pills, empty lists that read as "no data". Nothing there was
// demo data in the source — it was the real components rendering an empty array
// — but on screen it looked exactly like placeholder content, and it was visible
// for the whole fetch.
//
// So screens now show nothing but this until every piece has arrived, and then
// reveal the finished body in one step.
//
// PALETTES
// The ranking screens are a FIXED dark-blue gradient that deliberately ignores
// the theme — see the palette note in Podium.tsx — so the default colours here
// come from that palette (white text, podium-green accent, white halo). Every
// other screen in the app is theme-coloured, and passes `tinted={false}`, which
// switches to `colors.primary` + themed text on the app background. Either way
// there is no card: two thin arcs and a label, sitting IN the background.
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/src/components/misc/Text';
import { useTheme } from '@/src/core/theme';
import {
  LEADERBOARD_TEXT as BOARD_TEXT,
  LEADERBOARD_TEXT_DIM as BOARD_TEXT_DIM,
  PLACE_THEMES,
} from '@/src/components/leaderboard/Podium';

/** Same green as first place, so the loader already belongs to those screens. */
const BOARD_ACCENT = PLACE_THEMES[1].ring;

const HALO = 108;
const OUTER = 66;
const INNER = 44;
const STROKE = 3.5;

/**
 * Fraction of each ring that is actually drawn. A quarter is enough to read as
 * motion; much more and a spinning ring stops looking like it is spinning.
 */
const ARC_FRACTION = 0.26;

function Ring({ size, color, opacity, dashOffsetSeed }: { size: number; color: string; opacity: number; dashOffsetSeed: number }) {
  const radius = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <Svg width={size} height={size}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeOpacity={opacity}
        fill="none"
        strokeDasharray={`${circumference * ARC_FRACTION} ${circumference}`}
        strokeDashoffset={circumference * dashOffsetSeed}
      />
    </Svg>
  );
}

export interface PreloadingProps {
  /** What is being waited on, e.g. "Loading Leaderboard…". */
  label: string;
  /** Optional second line, dimmer — context for a wait the user can feel. */
  hint?: string;
  /**
   * Drawn from the fixed dark-blue leaderboard palette by default. Pass false
   * on any theme-coloured page: the accent becomes the theme primary, the text
   * becomes themed, and the halo tints to the theme instead of white.
   */
  tinted?: boolean;
}

export function Preloading({ label, hint, tinted = true }: PreloadingProps) {
  const { colors } = useTheme();

  // The `withRepeat` loops below run on the UI thread, so they never block the
  // page transition. Every loop is armed from a cancelled zero (see the note
  // inside the effect) so re-runs can never break a lap mid-flight.
  const accent = tinted ? BOARD_ACCENT : colors.primary;
  const text = tinted ? BOARD_TEXT : colors.textPrimary;
  const textDim = tinted ? BOARD_TEXT_DIM : colors.textSecondary;
  const haloBg = tinted ? 'rgba(255,255,255,0.07)' : `${colors.primary}0F`;
  const haloBorder = tinted ? 'rgba(255,255,255,0.16)' : `${colors.primary}29`;
  const innerRing = tinted ? BOARD_TEXT : colors.primary;

  const spin = useSharedValue(0);
  const innerSpin = useSharedValue(0);
  const breathe = useSharedValue(0);

  useEffect(() => {
    // EVERY LOOP MUST BE ARMED FROM A KNOWN ZERO. This is not defensive
    // tidiness, it is the whole correctness of the animation.
    //
    // `withRepeat` captures the value the shared value held at the instant it
    // was assigned (`animation.startValue = value` in its onStart) and returns
    // to THAT value at the top of every lap — not to 0. So if this effect is
    // ever re-run while a ring is mid-flight, say at 0.63, then every lap from
    // then on animates 0.63 → 1: the ring sweeps about a third of a turn, snaps
    // back, and repeats. It looks like the loader restarting forever instead of
    // rotating. Cancelling and zeroing first guarantees each lap is a true
    // 0 → 1 full revolution no matter when the effect runs.
    cancelAnimation(spin);
    cancelAnimation(innerSpin);
    cancelAnimation(breathe);
    spin.value = 0;
    innerSpin.value = 0;
    breathe.value = 0;

    // Linear easing matters here: `withRepeat` restarts the value at 0, and any
    // ease-out would make that restart visible as a stutter once per lap.
    spin.value = withRepeat(withTiming(1, { duration: 1150, easing: Easing.linear }), -1, false);
    // The inner ring gets its OWN clock: slower and counter-rotating, which is
    // what makes the two rings read as a mechanism instead of one thick ring.
    innerSpin.value = withRepeat(withTiming(1, { duration: 1750, easing: Easing.linear }), -1, false);
    breathe.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );

    return () => {
      cancelAnimation(spin);
      cancelAnimation(innerSpin);
      cancelAnimation(breathe);
    };
    // Nothing route- or theme-derived belongs in the deps: a changing
    // dependency is precisely what broke the rotation before.
  }, [spin, innerSpin, breathe]);

  const outerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  // Counter-rotating and slower.
  //
  // CRITICAL: the inner ring must complete a FULL lap (-360°, not some partial
  // arc). withRepeat restarts the value at 0 when the lap ends, and a partial
  // lap restarts from a visibly different angle — the ring would JUMP back to
  // its start point once per cycle. A full lap's restart is invisible because
  // -360° and 0° point the same way.
  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${innerSpin.value * -360}deg` }],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + breathe.value * 0.5,
    transform: [{ scale: 0.96 + breathe.value * 0.06 }],
  }));

  return (
    // No entering animation on the root: this is the FIRST thing a freshly
    // pushed screen paints, so a fade here would run against the page
    // transition and leave the body blank until it finished. It simply appears
    // — the transition is already supplying all the motion the eye needs.
    <View style={styles.root}>
      <View style={styles.stack}>
        {/* A soft breathing disc rather than a card — it sits IN the
            background instead of on top of it, which is the whole point. */}
        <Animated.View
          style={[styles.halo, haloStyle, { backgroundColor: haloBg, borderColor: haloBorder }]}
        />
        <Animated.View style={[styles.ring, outerStyle]}>
          <Ring size={OUTER} color={accent} opacity={1} dashOffsetSeed={0} />
        </Animated.View>
        <Animated.View style={[styles.ring, innerStyle]}>
          <Ring size={INNER} color={innerRing} opacity={0.45} dashOffsetSeed={0.5} />
        </Animated.View>
      </View>

      <Text variant="body" weight="semiBold" style={[styles.label, { color: text }]} numberOfLines={2}>
        {label}
      </Text>
      {hint ? (
        <Text variant="caption" style={[styles.hint, { color: textDim }]} numberOfLines={2}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Sits in the space the body would occupy. The negative offset pulls the
  // group above the true centre: with a header above and nothing below,
  // dead-centre reads as sitting low.
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 48,
    gap: 6,
  },
  stack: {
    width: HALO,
    height: HALO,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  halo: {
    position: 'absolute',
    width: HALO,
    height: HALO,
    borderRadius: HALO / 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  ring: { position: 'absolute' },
  label: { textAlign: 'center' },
  hint: { textAlign: 'center' },
});

