// Shared podium for both leaderboards — the exam-set ranking and the main
// course leaderboard.
//
// It lives here rather than in either screen because the two must look like the
// same product: same medal colours, same proportions, same motion. Only the
// labels under each avatar differ (an exam shows one score; the main board shows
// percent and points), which is what the `variant` and the per-entry labels are
// for.
//
// PALETTE NOTE: these colours are fixed and do NOT come from the theme. The
// podium is a designed surface — re-tinting medals per light/dark theme wrecks
// the contrast that makes gold read as gold. The screens using it are fixed
// dark-blue for the same reason.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Text } from '@/src/components/misc/Text';
import { Avatar } from '@/src/components/misc/Avatar';
import { NameWithTick } from '@/src/components/misc/NameWithTick';

export const LEADERBOARD_BG_TOP = '#12275C';
export const LEADERBOARD_BG_BOTTOM = '#1D4ED8';
export const LEADERBOARD_CARD = 'rgba(255,255,255,0.10)';
export const LEADERBOARD_CARD_BORDER = 'rgba(255,255,255,0.18)';
export const LEADERBOARD_TEXT = '#FFFFFF';
export const LEADERBOARD_TEXT_DIM = 'rgba(255,255,255,0.72)';

/**
 * First place is GREEN, not the usual gold — a deliberate product choice, and
 * the reason the other two places had to be recoloured too: silver and bronze
 * beside green read as dirty, so they became sky and amber. The three hues are
 * far enough apart to be told apart instantly at podium size.
 */
export interface PlaceTheme {
  place: number;
  /** Avatar ring + badge fill. */
  ring: string;
  /** Coloured shadow behind the avatar. */
  glow: string;
  /** Podium block gradient, top → bottom. */
  block: [string, string];
  /** Text on top of `ring`. */
  onRing: string;
  /** Score pill background. */
  pill: string;
  icon: 'trophy' | 'medal' | 'ribbon';
  height: number;
  avatar: number;
}

/**
 * Sizes are deliberately restrained. Because the podium is PINNED above the
 * scrolling list rather than scrolling with it, every pixel here is permanently
 * taken from the rankings below — on a small phone an over-tall podium leaves
 * room for barely two rows. These values keep the winner clearly dominant while
 * still leaving the list usable.
 */
export const PLACE_THEMES: Record<number, PlaceTheme> = {
  1: {
    place: 1,
    ring: '#34D399',
    glow: 'rgba(52,211,153,0.85)',
    block: ['#34D399', '#047857'],
    onRing: '#052E1A',
    pill: 'rgba(16,185,129,0.35)',
    icon: 'trophy',
    height: 112,
    avatar: 78,
  },
  2: {
    place: 2,
    ring: '#7DD3FC',
    glow: 'rgba(125,211,252,0.7)',
    block: ['#7DD3FC', '#0369A1'],
    onRing: '#052E45',
    pill: 'rgba(56,189,248,0.30)',
    icon: 'medal',
    height: 82,
    avatar: 64,
  },
  3: {
    place: 3,
    ring: '#FBBF24',
    glow: 'rgba(251,191,36,0.7)',
    block: ['#FBBF24', '#B45309'],
    onRing: '#3D2103',
    pill: 'rgba(245,158,11,0.30)',
    icon: 'medal',
    height: 64,
    avatar: 64,
  },
};

/** Left-to-right display order: runner-up, winner, third. */
export const PODIUM_ORDER = [2, 1, 3] as const;

export interface PodiumEntry {
  uid: string;
  name: string;
  photoURL: string | null;
  /**
   * Premium status as published ON THE RANKING ROW — never read from the other
   * person's profile document, which the rules (correctly) forbid.
   */
  isPro?: boolean;
  /** Big value under the name — "88%" on the main board, "88%" score on an exam. */
  primaryLabel: string;
  /** Small value beside it — points on the main board, time on an exam. */
  secondaryLabel?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** Slow breathing glow on the winner only — enough to draw the eye, not a strobe. */
function useWinnerPulse(active: boolean) {
  const pulse = useSharedValue(active ? 0 : 1);

  React.useEffect(() => {
    if (!active) {
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.55, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [active, pulse]);

  return useAnimatedStyle(() => ({ shadowOpacity: pulse.value }));
}

function PodiumSlot({ entry, theme, emptyLabel }: { entry?: PodiumEntry; theme: PlaceTheme; emptyLabel: string }) {
  const filled = Boolean(entry);
  const isWinner = theme.place === 1;
  const glowStyle = useWinnerPulse(filled && isWinner);
  const size = theme.avatar;

  return (
    <Animated.View
      entering={FadeInDown.delay(theme.place === 1 ? 0 : 120).duration(420)}
      style={styles.slot}
    >
      <View style={styles.crownRow}>
        {filled ? (
          <Ionicons name={theme.icon} size={isWinner ? 24 : 17} color={theme.ring} />
        ) : (
          <View style={{ height: isWinner ? 24 : 17 }} />
        )}
      </View>

      <Animated.View
        style={[
          styles.avatarRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: filled ? theme.ring : 'rgba(255,255,255,0.22)',
            backgroundColor: filled ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.06)',
            shadowColor: theme.glow,
          },
          filled && isWinner ? glowStyle : { shadowOpacity: filled ? 0.9 : 0 },
        ]}
      >
        {filled && entry?.photoURL ? (
          <Avatar uri={entry.photoURL} name={entry.name} size={size - 12} />
        ) : (
          <Text variant="h3" weight="bold" style={{ color: filled ? LEADERBOARD_TEXT : LEADERBOARD_TEXT_DIM }}>
            {filled ? initials(entry!.name) : '—'}
          </Text>
        )}

        <View style={[styles.placeBadge, { backgroundColor: filled ? theme.ring : 'rgba(255,255,255,0.25)' }]}>
          <Text variant="caption" weight="bold" style={{ color: filled ? theme.onRing : LEADERBOARD_TEXT }}>
            {theme.place}
          </Text>
        </View>

        {/* The verified tick no longer rides on the photo/ring — it sits beside
            the name below (Facebook style), like every other screen. */}
      </Animated.View>

      <NameWithTick
        name={filled ? entry!.name : emptyLabel}
        pro={filled && entry?.isPro}
        variant="bodySmall"
        weight="bold"
        containerStyle={styles.name}
        style={{ color: filled ? LEADERBOARD_TEXT : LEADERBOARD_TEXT_DIM, textAlign: 'center' }}
      />

      <View style={[styles.pill, { backgroundColor: filled ? theme.pill : 'rgba(255,255,255,0.08)' }]}>
        <Text variant="caption" weight="bold" style={{ color: filled ? LEADERBOARD_TEXT : LEADERBOARD_TEXT_DIM }}>
          {filled ? entry!.primaryLabel : '--'}
        </Text>
      </View>

      {filled && entry?.secondaryLabel ? (
        <Text variant="caption" numberOfLines={1} style={[styles.secondary, { color: LEADERBOARD_TEXT_DIM }]}>
          {entry.secondaryLabel}
        </Text>
      ) : (
        <View style={styles.secondarySpacer} />
      )}

      {/* The block itself. A gradient rather than a flat fill, with a bright cap
          across the top edge so the three stands read as lit from above. */}
      <LinearGradient
        colors={filled ? theme.block : ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.05)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[styles.block, { height: theme.height }]}
      >
        <View style={[styles.blockCap, { backgroundColor: filled ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.18)' }]} />
        <Text
          variant="h1"
          weight="bold"
          style={{ color: filled ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.45)' }}
        >
          {theme.place}
        </Text>
        <Text variant="caption" weight="bold" style={{ color: 'rgba(255,255,255,0.65)' }}>
          {theme.place === 1 ? 'FIRST' : theme.place === 2 ? 'SECOND' : 'THIRD'}
        </Text>
      </LinearGradient>
    </Animated.View>
  );
}

/**
 * Renders all three stands. Always three, even with a single participant — empty
 * places show as "Open spot" so the layout never collapses or jumps when the
 * second and third competitors eventually arrive.
 */
export function Podium({
  entries,
  emptyLabel = 'Open spot',
}: {
  entries: (PodiumEntry | undefined)[];
  emptyLabel?: string;
}) {
  return (
    <View style={styles.row}>
      {PODIUM_ORDER.map((place, index) => (
        <PodiumSlot key={place} entry={entries[index]} theme={PLACE_THEMES[place]} emptyLabel={emptyLabel} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6 },
  slot: { flex: 1, alignItems: 'center' },
  crownRow: { height: 26, justifyContent: 'flex-end', marginBottom: 2 },
  avatarRing: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  placeBadge: {
    position: 'absolute',
    bottom: -7,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Lower-right, matching the header avatars on Home/Profile — the user asked
  // for one consistent tick placement everywhere. The place badge sits centred
  // on the bottom rim, so the two don't collide.
  name: { marginTop: 10, maxWidth: '100%' },
  pill: { marginTop: 5, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  secondary: { marginTop: 3 },
  secondarySpacer: { height: 3 },
  block: {
    marginTop: 9,
    width: '100%',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  blockCap: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
});
