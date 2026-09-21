// The multi-colour ring worn by a premium member's avatar.
//
// The web reference for this is a CSS `conic-gradient`. React Native has no
// conic gradient, so the sweep is drawn as a run of short SVG arcs whose colours
// are interpolated around the wheel. Two things make that cheap rather than
// expensive:
//
//   1. The arcs are built once, in a useMemo keyed only on the circumference,
//      and never re-render.
//   2. Every arc is the same <Circle>, differing only in strokeDasharray /
//      strokeDashoffset — no path maths, no per-arc geometry.
//
// IT DOES NOT MOVE, ON PURPOSE
//
// This ring used to spin one full turn every five seconds. In practice it read
// as a loading spinner wrapped around the user's face: on the Profile and Home
// headers — the two screens a user opens most — something was always turning,
// which made a static page feel busy and unfinished. A premium mark should be a
// mark, not an animation, so the sweep is now fixed in place. The palette,
// geometry and outer box are unchanged; only the rotation is gone.
//
// SIZING CONTRACT: the outer box is exactly `size + ringWidth * 2`, which is the
// same box the plain green glow occupies at every avatar size this app uses. A
// premium user and a free user must get identically sized headers, so changing
// the widths below without checking the green ring in ProfileAvatar will shift
// layout.
//
// The verified tick is NOT drawn here. It belongs to the avatar itself (see
// misc/Avatar), so that lists which show a face without a ring — leaderboards,
// rankings, comments — still get the badge from the same place.
import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

/**
 * The four hues of the sweep, blended into each other and wrapping from the last
 * back to the first, so there is no visible seam anywhere on the wheel.
 */
const RING_COLORS = ['#4C7CF0', '#7B5FE8', '#E257A6', '#F6B94E'] as const;

/**
 * Ring thickness per avatar size. Three steps rather than a formula because
 * these numbers are pinned to the green ring they replace: 88 → 7 (4 padding +
 * 3 border), 44 → 5.5 (3 + 2.5), 30 → 4 (2 + 2). Those are the only avatar sizes
 * the headers use, and the outer box has to match at each of them.
 */
function ringWidthFor(size: number): number {
  if (size >= 64) return 7;
  if (size >= 36) return 5.5;
  return 4;
}

/**
 * How many arcs the sweep is cut into.
 *
 * Deliberately NOT scaled with the avatar size, which is the intuitive thing to
 * do and is wrong. What the eye catches is the colour step between neighbouring
 * arcs, and that is set by the palette, not by the circumference: the widest gap
 * in RING_COLORS is the amber→blue wrap at 170/255 on one channel, so each step
 * is 170/(segments/4). At 36 that is ~19/255 and reads as a gradient; at the 16
 * a 30px ring would "deserve" it is ~43/255 and you can see the bands. Scaling
 * by size therefore bands the small avatars — exactly backwards.
 *
 * Paying for 36 everywhere is fine because they are built once in a useMemo and
 * never re-render.
 */
const RING_SEGMENTS = 36;

function parseHex(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function toHex(r: number, g: number, b: number): string {
  const part = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

/**
 * Colour at a fraction of one turn around the wheel. Interpolating in plain RGB
 * is fine here because the four stops are already close together in hue; a
 * perceptual space would cost more and look the same at this stroke width.
 */
function colorAtTurn(turn: number): string {
  const count = RING_COLORS.length;
  const scaled = (((turn % 1) + 1) % 1) * count;
  const index = Math.floor(scaled) % count;
  const [r1, g1, b1] = parseHex(RING_COLORS[index]);
  const [r2, g2, b2] = parseHex(RING_COLORS[(index + 1) % count]);
  const t = scaled - Math.floor(scaled);
  return toHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

export interface ProAvatarRingProps {
  /** Diameter of the avatar being wrapped. The ring adds its own width outside. */
  size: number;
  /** The avatar itself. Rendered above the ring. */
  children: React.ReactNode;
}

export function ProAvatarRing({ size, children }: ProAvatarRingProps) {
  const ringWidth = ringWidthFor(size);

  const outer = size + ringWidth * 2;
  const radius = (outer - ringWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // The halo is the same sweep drawn fat and faint — this app's stand-in for the
  // reference's `filter: blur()`, which SVG filters support unevenly on Android.
  // It bleeds inward too, but the avatar is painted over that half.
  const haloWidth = ringWidth * 2.6;
  const haloSpread = Math.ceil((haloWidth - ringWidth) / 2);
  const canvas = outer + haloSpread * 2;

  /**
   * Both rings, as dash windows on one circle. Each entry is a slice of the
   * wheel; a slight overlap hides the anti-aliasing seam between neighbours.
   */
  const arcs = useMemo(() => {
    const build = (count: number) => {
      const slot = circumference / count;
      const dash = slot * 1.2;
      return Array.from({ length: count }, (_, i) => ({
        key: i,
        color: colorAtTurn((i + 0.5) / count),
        dash: [dash, circumference - dash] as number[],
        offset: -i * slot,
      }));
    };
    // The halo gets away with half the arcs: at 24% opacity under a stroke 2.6×
    // too fat to hold an edge, a doubled colour step lands well under one shade.
    return { ring: build(RING_SEGMENTS), halo: build(RING_SEGMENTS / 2) };
  }, [circumference]);

  return (
    <View style={{ width: outer, height: outer, alignItems: 'center', justifyContent: 'center' }}>
      {/* Absolutely positioned and inset by the halo's overhang, so the extra
          canvas the bloom needs never widens the layout box above.

          The quarter turn is the one piece of orientation this needs now that it
          stands still: SVG angles start at 3 o'clock, and a ring that is never
          going to move should begin its palette at the top of the circle where
          the eye starts reading it. */}
      <View
        pointerEvents="none"
        style={[
          styles.ringLayer,
          { top: -haloSpread, left: -haloSpread, width: canvas, height: canvas },
        ]}
      >
        <Svg width={canvas} height={canvas}>
          <G opacity={0.24} rotation={-90} origin={`${canvas / 2}, ${canvas / 2}`}>
            {arcs.halo.map((arc) => (
              <Circle
                key={`halo-${arc.key}`}
                cx={canvas / 2}
                cy={canvas / 2}
                r={radius}
                stroke={arc.color}
                strokeWidth={haloWidth}
                strokeDasharray={arc.dash}
                strokeDashoffset={arc.offset}
                fill="none"
              />
            ))}
          </G>
          <G rotation={-90} origin={`${canvas / 2}, ${canvas / 2}`}>
            {arcs.ring.map((arc) => (
              <Circle
                key={`ring-${arc.key}`}
                cx={canvas / 2}
                cy={canvas / 2}
                r={radius}
                stroke={arc.color}
                strokeWidth={ringWidth}
                strokeDasharray={arc.dash}
                strokeDashoffset={arc.offset}
                fill="none"
              />
            ))}
          </G>
        </Svg>
      </View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  ringLayer: { position: 'absolute' },
});
