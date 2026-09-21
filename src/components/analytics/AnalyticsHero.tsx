// The page's identity card: which subcourse these numbers describe, how far
// along it is, and the three figures worth checking first.
//
// The gradient, radius and glow are lifted from the Syllabus page's active-course
// banner on purpose — a user arriving here should recognise the card that told
// them which course they were studying. The one change is that Syllabus's static
// trending-up box becomes a live progress ring, because on this page the number
// IS the subject.
//
// This is the single place on the screen that does NOT follow the app theme. The
// gradient is fixed, so everything drawn on it is fixed white too.
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Circle, G } from 'react-native-svg';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';

import { Text } from '@/src/components/misc/Text';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const GRADIENT = ['#2563EB', '#1D4ED8', '#0B1F5B'] as const;
const ON_BLUE = '#FFFFFF';
const ON_BLUE_DIM = 'rgba(255,255,255,0.74)';

const RING_SIZE = 62;
const RING_STROKE = 5;

export interface AnalyticsHeroProps {
  courseName: string;
  subcourseName: string;
  /** 0..100 — the weighted score the leaderboard ranks on. */
  percent: number;
  points: number;
  /** Current streak in days. */
  streak: number;
  /** Days with real work inside the selected window. */
  activeDays: number;
  /**
   * Only known once the cohort section has been opened (Phase 4). Until then the
   * middle cell shows active days rather than a placeholder — a dash where a rank
   * belongs reads as "unranked", which would be wrong.
   */
  rank?: number | null;
  /** Shows the switch affordance; the card is only tappable when true. */
  switchable?: boolean;
  onPress?: () => void;
}

export function AnalyticsHero({
  courseName,
  subcourseName,
  percent,
  points,
  streak,
  activeDays,
  rank = null,
  switchable = false,
  onPress,
}: AnalyticsHeroProps) {
  const { t } = useTranslation();
  const interactive = switchable && !!onPress;

  const body = (
    <LinearGradient
      colors={GRADIENT}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.glow} />

      <View style={styles.topRow}>
        <View style={styles.iconBox}>
          <Ionicons name="school" size={26} color={ON_BLUE} />
        </View>

        <View style={styles.textCol}>
          <Text variant="caption" color={ON_BLUE_DIM} numberOfLines={1} style={styles.eyebrow}>
            {t('analytics.hero.eyebrow')}
          </Text>
          <Text variant="h2" weight="bold" color={ON_BLUE} numberOfLines={1}>
            {courseName}
          </Text>
          {/* The switch affordance is inline with the subcourse name rather than
              a corner chip: the card's top-right corner belongs to the ring, and
              a chip there would sit on top of it. */}
          <View style={styles.subRow}>
            <Text variant="bodySmall" color={ON_BLUE_DIM} numberOfLines={1} style={{ flexShrink: 1 }}>
              {subcourseName}
            </Text>
            {interactive ? <Ionicons name="swap-horizontal" size={14} color={ON_BLUE_DIM} /> : null}
          </View>
        </View>

        <HeroRing percent={percent} />
      </View>

      <View style={styles.strip}>
        <StripCell value={formatCount(points)} label={t('analytics.hero.points')} />
        <View style={styles.stripDivider} />
        {rank != null ? (
          <StripCell value={`#${rank}`} label={t('analytics.hero.rank')} />
        ) : (
          <StripCell value={formatCount(activeDays)} label={t('analytics.hero.activeDays')} />
        )}
        <View style={styles.stripDivider} />
        <StripCell value={formatCount(streak)} label={t('analytics.hero.streak')} icon="flame" />
      </View>
    </LinearGradient>
  );

  if (!interactive) return body;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('analytics.hero.switch')}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.985 : 1 }] })}
    >
      {body}
    </Pressable>
  );
}

function StripCell({
  value,
  label,
  icon,
}: {
  value: string;
  label: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}) {
  return (
    <View style={styles.stripCell}>
      <View style={styles.stripValueRow}>
        {icon ? <Ionicons name={icon} size={13} color="#FDBA74" /> : null}
        <Text variant="bodyLarge" weight="bold" color={ON_BLUE} numberOfLines={1}>
          {value}
        </Text>
      </View>
      <Text variant="caption" color={ON_BLUE_DIM} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/**
 * A local ring rather than the shared `ProgressRing`.
 *
 * That component takes its track from `colors.surfaceAlt` and its label from
 * `colors.textPrimary`, both of which are theme colours — on a fixed blue
 * gradient they render as a near-invisible track in one theme and dark-on-blue
 * text in the other. Forty lines of white-on-blue is the cheaper fix.
 */
function HeroRing({ percent }: { percent: number }) {
  const { motion } = useTheme();
  const progress = useSharedValue(0);

  const radius = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = RING_SIZE / 2;
  const ratio = Math.max(0, Math.min(1, (Number.isFinite(percent) ? percent : 0) / 100));

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: motion.emphasis,
      easing: Easing.out(Easing.cubic),
    });
    // Keyed on the percentage itself: switching subcourse should redraw the ring,
    // a parent re-render for any other reason should not.
  }, [ratio, motion.emphasis, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - ratio * progress.value),
  }));

  return (
    <View style={{ width: RING_SIZE, height: RING_SIZE }}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke="rgba(255,255,255,0.24)"
          strokeWidth={RING_STROKE}
          fill="none"
        />
        <G rotation={-90} origin={`${center}, ${center}`}>
          <AnimatedCircle
            cx={center}
            cy={center}
            r={radius}
            stroke={ON_BLUE}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={circumference}
            fill="none"
            animatedProps={animatedProps}
          />
        </G>
      </Svg>

      <View style={[StyleSheet.absoluteFillObject, styles.ringLabel]} pointerEvents="none">
        <Text variant="bodySmall" weight="bold" color={ON_BLUE} numberOfLines={1}>
          {Math.round(ratio * 100)}%
        </Text>
      </View>
    </View>
  );
}

/** Keeps four-digit figures from pushing the strip cells out of alignment. */
function formatCount(value: number): string {
  const safe = Number.isFinite(value) ? Math.round(value) : 0;
  if (safe >= 10000) return `${(safe / 1000).toFixed(1)}k`;
  return String(safe);
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 18,
    gap: 14,
    overflow: 'hidden',
    shadowColor: '#1D4ED8',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  glow: {
    position: 'absolute',
    top: -30,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1, minWidth: 0 },
  eyebrow: { letterSpacing: 0.3 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    paddingVertical: 10,
  },
  stripCell: { flex: 1, alignItems: 'center', gap: 1 },
  stripValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stripDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  ringLabel: { alignItems: 'center', justifyContent: 'center' },
});
