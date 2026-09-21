// Profile → the one card that answers "how am I doing, across the whole app?"
//
// ===== Where the numbers come from =====
// The ring and the points read the SAME private aggregate the main leaderboard
// ranks people on (mainLeaderboard/{uid}/{subcourseId}), so the percentage shown
// here and the position shown on the board are computed from the same source and
// can never quietly disagree. "Whole app" is meant literally — exams, daily
// tests, practice, question of the day, GK/PM and reading all feed it.
//
// Rank and streak are not on that document. They are mirrored onto
// users/{uid}.stats by the jobs that already compute them (the analytics
// snapshot for the streak, the Leaderboard screen for the rank — see
// writeUserStats in services/profile.ts), because reading them live would mean
// downloading a 180-day analytics map and up to 300 board documents every time
// this tab is opened. The mirror is a field of a document the app already loads
// at launch, so this card costs nothing.
//
// ===== Why it is this small =====
// It used to carry a split bar, a four-item legend and a 2×2 grid underneath —
// roughly twice this height, which pushed the Account section off the first
// screen. The full picture is one tap away on Analytics, so the card keeps only
// what belongs on a profile: how far through the course you are, and the four
// headline numbers.
import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { Text } from '@/src/components/misc/Text';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { compactNumber } from '@/src/components/charts/chartMath';
import { displayCoveragePercent } from '@/src/core/services/scoring';
import { testsTakenOf } from '@/src/core/services/analyticsSnapshot';
import type { UserStats } from '@/src/core/firebase/services/profile';
import type { MainLeaderboardScore } from '@/src/core/services/mainLeaderboard';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RING = 66;
const STROKE = 6;
const RADIUS = (RING - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Fixed so the strip never changes height as values or languages change. */
const STRIP_HEIGHT = 44;

export interface ProfileStatsCardProps {
  /** The stored private aggregate, or null when it hasn't been published yet. */
  score: MainLeaderboardScore | null;
  /**
   * The mirrored headline numbers from users/{uid}.stats. Rank and streak exist
   * ONLY here — the aggregate above carries neither.
   */
  stats: UserStats | null;
  loading: boolean;
  /** Shown as the scope chip so the user knows what the score is measured over. */
  subcourseName: string | null;
  /** Opens the full Analytics page. */
  onPress: () => void;
}

export function ProfileStatsCard({
  score,
  stats,
  loading,
  subcourseName,
  onPress,
}: ProfileStatsCardProps) {
  const { colors, motion, radius, spacing } = useTheme();
  const { t } = useTranslation();
  const progress = useSharedValue(0);

  // The ring shows COVERAGE of the subcourse's content, which for a new learner
  // is a very small number against a large library. Math.round would print a
  // flat "0%" through the first few hundred questions — exactly when seeing the
  // number move matters most — so sub-10% values keep one decimal.
  const percent = displayCoveragePercent(score?.percent ?? 0);

  // Live aggregate first, mirror second. The aggregate is recomputed on every
  // publish, while the mirror is only as fresh as the last one — but the mirror
  // is all there is before the first score of a session lands, and showing a
  // yesterday-accurate number beats showing a zero.
  const points = Math.max(0, Math.round(score?.points ?? stats?.points ?? 0));
  const tests = score?.breakdown ? testsTakenOf(score.breakdown) : Math.max(0, stats?.testsTaken ?? 0);
  const rank = Math.max(0, Math.round(stats?.rank ?? 0));
  const streak = Math.max(0, Math.round(stats?.streak ?? 0));

  const hasData = points > 0 || (score?.activityCount ?? 0) > 0;

  const strip = useMemo(
    () => [
      {
        key: 'rank',
        icon: 'trophy-outline' as const,
        tint: colors.warning,
        // A rank of zero means "never placed", not "last" — the Leaderboard
        // screen is what records it, and it may simply not have been opened yet.
        value: rank > 0 ? `#${rank}` : '—',
        label: t('profile.rank'),
      },
      {
        key: 'streak',
        icon: 'flame-outline' as const,
        tint: colors.error,
        value: compactNumber(streak),
        label: t('profile.streak'),
      },
      {
        key: 'tests',
        icon: 'document-text-outline' as const,
        tint: colors.info,
        value: compactNumber(tests),
        label: t('profile.stats.tests'),
      },
    ],
    [rank, streak, tests, colors.warning, colors.error, colors.info, t],
  );

  // Keyed on a signature rather than on `score`, which is a fresh object on
  // every fetch — otherwise the ring would re-sweep on each pull-to-refresh even
  // when nothing changed.
  const signature = `${percent}:${points}`;

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: motion.emphasis, easing: Easing.out(Easing.cubic) });
  }, [signature, motion.emphasis, progress]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('profile.stats.title')}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.lg,
          opacity: pressed ? 0.94 : 1,
        },
      ]}
    >
      {/* A single accent hairline instead of a gradient wash — the profile
          header directly above is already a gradient, and stacking two makes
          the top of the screen read as noise. */}
      <View style={[styles.accent, { backgroundColor: colors.primary }]} />

      <View style={{ padding: spacing.md, gap: spacing.sm + 2 }}>
        {/* ── Hero: the ring is the card ───────────────────────── */}
        <View style={[styles.hero, { gap: spacing.md }]}>
          <View style={styles.ringWrap}>
            {/* Rotating the whole SVG rather than the arc keeps this working on
                both svg versions — the backing circle is symmetric, so nothing
                else moves, and the centred label lives outside the <Svg>. */}
            <Svg width={RING} height={RING} style={styles.ringSvg}>
              <Circle
                cx={RING / 2}
                cy={RING / 2}
                r={RADIUS}
                stroke={colors.surfaceAlt}
                strokeWidth={STROKE}
                fill="none"
              />
              <RingArc
                percent={percent}
                color={colors.primary}
                progress={progress}
                dim={!hasData}
                dimColor={colors.border}
              />
            </Svg>
            <View style={styles.ringCenter} pointerEvents="none">
              <Text variant="h3" weight="bold" numberOfLines={1}>
                {hasData ? `${percent}%` : '—'}
              </Text>
            </View>
          </View>

          <View style={styles.heroBody}>
            {/* This labels the RING, not the card. Without it the number reads
                as a score, and a low one looks like bad news rather than a big
                syllabus. */}
            <Text variant="caption" secondary numberOfLines={1} style={styles.eyebrow}>
              {t('profile.stats.coverage')}
            </Text>
            <View style={styles.pointsRow}>
              <Text variant="h2" weight="bold" numberOfLines={1}>
                {compactNumber(points)}
              </Text>
              <Text variant="caption" secondary weight="semiBold" style={{ marginBottom: 3 }}>
                {t('profile.stats.points')}
              </Text>
            </View>
            {subcourseName ? (
              <View
                style={[
                  styles.chip,
                  { backgroundColor: `${colors.primary}14`, borderRadius: radius.pill },
                ]}
              >
                <Ionicons name="school-outline" size={10} color={colors.primary} />
                <Text
                  variant="caption"
                  weight="semiBold"
                  color={colors.primary}
                  numberOfLines={1}
                  style={{ flexShrink: 1 }}
                >
                  {subcourseName}
                </Text>
              </View>
            ) : null}
          </View>

          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </View>

        {/* ── Rank / streak / tests, or the reason there are none ── */}
        <View
          style={[
            styles.strip,
            { height: STRIP_HEIGHT, backgroundColor: colors.surfaceAlt, borderRadius: radius.md },
          ]}
        >
          {hasData ? (
            strip.map((item, index) => (
              <View
                key={item.key}
                style={[
                  styles.stripCell,
                  {
                    borderLeftWidth: index > 0 ? StyleSheet.hairlineWidth : 0,
                    borderColor: colors.divider,
                  },
                ]}
              >
                <View style={styles.stripValueRow}>
                  <Ionicons name={item.icon} size={12} color={item.tint} />
                  <Text variant="bodySmall" weight="bold" numberOfLines={1}>
                    {item.value}
                  </Text>
                </View>
                <Text variant="caption" secondary numberOfLines={1}>
                  {item.label}
                </Text>
              </View>
            ))
          ) : (
            // Same container, same height — the card must not resize the moment
            // the first activity lands.
            <View style={styles.stripMessage}>
              <Ionicons name="rocket-outline" size={13} color={colors.primary} />
              <Text variant="caption" weight="semiBold" color={colors.primary} numberOfLines={2} style={{ flex: 1 }}>
                {loading && !score ? t('profile.stats.loading') : t('profile.stats.empty')}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

/** The sweeping arc. Starts at 12 o'clock and runs clockwise. */
function RingArc({
  percent,
  color,
  progress,
  dim,
  dimColor,
}: {
  percent: number;
  color: string;
  progress: SharedValue<number>;
  dim: boolean;
  dimColor: string;
}) {
  const target = (percent / 100) * CIRCUMFERENCE;

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE - target * progress.value,
  }));

  return (
    <AnimatedCircle
      cx={RING / 2}
      cy={RING / 2}
      r={RADIUS}
      stroke={dim ? dimColor : color}
      strokeWidth={STROKE}
      strokeLinecap="round"
      fill="none"
      strokeDasharray={CIRCUMFERENCE}
      animatedProps={animatedProps}
    />
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  accent: { height: 3, width: '100%' },
  hero: { flexDirection: 'row', alignItems: 'center' },
  ringWrap: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  ringSvg: { transform: [{ rotate: '-90deg' }] },
  ringCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  heroBody: { flex: 1, minWidth: 0, gap: 2 },
  eyebrow: { letterSpacing: 0.4, textTransform: 'uppercase' },
  pointsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 5 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    maxWidth: '100%',
  },
  strip: { flexDirection: 'row', overflow: 'hidden' },
  stripCell: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 1, paddingHorizontal: 4 },
  stripValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stripMessage: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
});
