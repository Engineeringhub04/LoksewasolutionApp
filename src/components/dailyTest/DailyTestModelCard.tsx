// Premium Daily Test model card — the slide used by the landing carousel.
//
// Built on the same recipe as the "Active Course" banner (3-stop diagonal
// gradient, soft white glow blob, 24dp radius, coloured drop shadow) so the two
// read as one family. Each card carries everything the user needs to decide:
// its slot (today / upcoming / completed / missed), a RED blinking LIVE indicator
// while today's test is still unattempted, its RELEASE DATE, the difficulty
// category, the Free vs Premium tier, and the model's exam config (question
// count, per-question timer, negative marking).
//
// Slots map to real scheduling states, not positions:
//   today     — released for the current date and playable (or already done)
//   upcoming  — a model whose release date has not arrived; CTA shows the actual
//               date it unlocks on. May also be the stand-in card for a subcourse
//               with nothing queued, which looks like any other upcoming test.
//   completed — an older model this account has finished; reopens the result
//   missed    — released, the date has passed, never attempted: locked for good
//
// COLOUR belongs to the model, not the slot — see CARD_PALETTES. Every slide
// being the same blue made a strip of four look like one card repeated.
//
// EVERY CARD IS THE SAME SIZE. The card grows to fill its slide, and the CTA is
// pushed to the bottom by a spacer, so a short card and a long one line up
// instead of the strip stepping up and down as it scrolls.
//
// The call to action changes with entitlement: a Premium model the user has not
// subscribed to shows "Go to Subscription" instead of "Start Test", and once the
// subscription is active the tier pill becomes "Purchased (active)".
import React, { useEffect } from 'react';
import { View, Pressable, StyleSheet, type DimensionValue } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Text } from '@/src/components/misc/Text';
import {
  formatDailyTestDuration,
  formatDateKeyShort,
  relativeDayLabel,
  totalTestSeconds,
  type DailyTestModel,
} from '@/src/core/firebase/services/dailyTest';

export type DailyTestCardSlot = 'today' | 'upcoming' | 'completed' | 'missed';

interface CardPalette {
  gradient: readonly [string, string, string];
  shadow: string;
}

/**
 * Per-model palettes, picked by a stable hash of the model id.
 *
 * Hashing rather than indexing by position means a model keeps its colour on
 * every render, on every device and across restarts — nothing is stored, and
 * re-ordering or filtering the list never re-paints the cards the user already
 * recognises.
 *
 * The set is deliberately all COOL hues. Green, red and dark orange are reserved
 * for things that sit ON the card: the green "Completed" pill and "View Result"
 * button, the red LIVE pill, the orange "Premium" pill. A badge the same colour
 * as the body underneath it simply vanishes, so the body never uses those three.
 */
const CARD_PALETTES: readonly CardPalette[] = [
  { gradient: ['#2563EB', '#1D4ED8', '#0B1F5B'], shadow: '#1D4ED8' }, // blue
  { gradient: ['#4F46E5', '#3730A3', '#1E1B4B'], shadow: '#3730A3' }, // indigo
  { gradient: ['#7C3AED', '#5B21B6', '#2A0E4F'], shadow: '#5B21B6' }, // violet
  { gradient: ['#A21CAF', '#701A75', '#2E0A31'], shadow: '#701A75' }, // plum
  { gradient: ['#0E7490', '#155E75', '#082F3F'], shadow: '#155E75' }, // deep cyan
  { gradient: ['#0369A1', '#075985', '#082F49'], shadow: '#075985' }, // ocean
  { gradient: ['#4338CA', '#312E81', '#171449'], shadow: '#312E81' }, // royal
  { gradient: ['#6D28D9', '#4C1D95', '#241063'], shadow: '#4C1D95' }, // grape
];

/** Slate a missed card is pulled towards, and how far. See paletteFor(). */
const MISSED_MIX = '#1E293B';
const MISSED_MIX_AMOUNT = 0.66;

/** Green for everything "done": the Completed pill and the View Result button. */
const DONE_GREEN = '#16A34A';
const DONE_GREEN_DEEP = '#15803D';
/** Light red for the LIVE badge, with the deeper red it prints and glows in. */
const LIVE_BG = '#FCA5A5';
const LIVE_INK = '#7F1D1D';
const LIVE_GLOW = '#EF4444';
/** Dark orange for the Premium badge. */
const PREMIUM_ORANGE = '#C2410C';

const SLOT_LABEL: Record<DailyTestCardSlot, string> = {
  today: "TODAY'S TEST",
  upcoming: 'UPCOMING TEST',
  completed: 'COMPLETED TEST',
  missed: 'MISSED TEST',
};

const CATEGORY_META: Record<string, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  easy: { label: 'Easy', color: '#86EFAC', icon: 'leaf-outline' },
  medium: { label: 'Medium', color: '#FDE68A', icon: 'flame-outline' },
  hard: { label: 'Hard', color: '#FCA5A5', icon: 'skull-outline' },
};

/** FNV-1a. Tiny, dependency-free, and spreads short ids evenly across buckets. */
function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

/** Linear blend of two #rrggbb colours; returns `from` unchanged if unparseable. */
function mix(from: string, to: string, amount: number): string {
  const parse = (hex: string) => {
    const match = /^#([0-9a-f]{6})$/i.exec(hex);
    return match ? parseInt(match[1], 16) : null;
  };
  const a = parse(from);
  const b = parse(to);
  if (a === null || b === null) return from;
  const blend = (shift: number) => {
    const x = (a >> shift) & 0xff;
    const y = (b >> shift) & 0xff;
    return Math.round(x + (y - x) * amount);
  };
  const r = blend(16);
  const g = blend(8);
  const bl = blend(0);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
}

function paletteFor(modelId: string, slot: DailyTestCardSlot): CardPalette {
  const base = CARD_PALETTES[hashString(modelId) % CARD_PALETTES.length];
  if (slot !== 'missed') return base;
  // A missed test is over. It keeps its own hue — so two missed cards are still
  // told apart — but is pulled most of the way to slate, which is what stops a
  // dead card from competing with a live one for attention.
  return {
    gradient: [
      mix(base.gradient[0], MISSED_MIX, MISSED_MIX_AMOUNT),
      mix(base.gradient[1], MISSED_MIX, MISSED_MIX_AMOUNT),
      mix(base.gradient[2], MISSED_MIX, MISSED_MIX_AMOUNT),
    ] as const,
    shadow: mix(base.shadow, MISSED_MIX, MISSED_MIX_AMOUNT),
  };
}

export interface DailyTestModelCardProps {
  model: DailyTestModel;
  slot: DailyTestCardSlot;
  /** True when this user has already submitted this model. */
  completed: boolean;
  /** Score to show on a completed card. */
  scorePercent?: number | null;
  /** True when the user's premium entitlement is currently active. */
  hasPremiumAccess: boolean;
  /**
   * A stand-in rather than a real document — shown in the Upcoming slot when a
   * subcourse has nothing scheduled ahead. It does NOT announce itself as a
   * sample (the learner has no use for that distinction); it simply has no
   * question count to print and cannot be opened.
   */
  demo?: boolean;
  /**
   * Position among the models sharing this date, 1-based, with how many there
   * are. Renders as "Test 2 of 3" so two tests released on the same day are
   * clearly two tests. Omitted when the date has only one.
   */
  indexInDay?: { index: number; total: number };
  /** Today's date key — makes the date chip read "Today"/"Tomorrow" where apt. */
  todayKey?: string;
  /** Defaults to filling its parent — the carousel sizes each slide for it. */
  width?: DimensionValue;
  /** Start / View Result — not called for a locked premium model. */
  onPrimaryPress: () => void;
  /** Opens the subscription page for a locked premium model. */
  onSubscribePress: () => void;
}

export function DailyTestModelCard({
  model,
  slot,
  completed,
  scorePercent,
  hasPremiumAccess,
  demo = false,
  indexInDay,
  todayKey,
  width = '100%',
  onPrimaryPress,
  onSubscribePress,
}: DailyTestModelCardProps) {
  // The LIVE badge pulses — only while today's test is live and unattempted. The
  // whole pill fades in and out (not just the dot) so the red glow breathes with
  // it, which is what makes it read as "happening now" from across the screen.
  const isLive = slot === 'today' && !completed;
  const blink = useSharedValue(1);
  useEffect(() => {
    if (!isLive) {
      blink.value = 1;
      return;
    }
    blink.value = withRepeat(
      withSequence(
        withTiming(0.45, { duration: 620, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 620, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, [blink, isLive]);
  const blinkStyle = useAnimatedStyle(() => ({ opacity: blink.value }));

  const palette = paletteFor(model.id, slot);

  // A missed test is locked by date, so premium gating is irrelevant to it — the
  // subscribe CTA would be a false promise.
  const locked = model.isPro && !hasPremiumAccess && slot !== 'missed';
  const isUpcoming = slot === 'upcoming';
  const isMissed = slot === 'missed';
  const category = CATEGORY_META[model.category] ?? CATEGORY_META.medium;

  /** "Today" / "Tomorrow" / "Sat, 12 Sep" for the model's release date. */
  const dateLabel = model.testDate
    ? todayKey
      ? relativeDayLabel(model.testDate, todayKey)
      : formatDateKeyShort(model.testDate)
    : '';

  // The stand-in card has no questions on purpose, so counting them would print
  // "0 Qs". It advertises the shape of a normal model instead.
  const meta: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = demo
    ? [
        { icon: 'sparkles-outline', label: 'Fresh questions' },
        { icon: 'timer-outline', label: 'Timed per question' },
        { icon: 'notifications-outline', label: 'Unlocks at 12:00 AM' },
      ]
    : [
        { icon: 'help-circle-outline', label: `${model.questions.length} Qs` },
        { icon: 'timer-outline', label: `${model.perQuestionTimeSeconds}s / Q` },
        { icon: 'hourglass-outline', label: formatDailyTestDuration(totalTestSeconds(model)) },
        {
          icon: model.negativeMarking ? 'remove-circle-outline' : 'checkmark-circle-outline',
          label: model.negativeMarking
            ? `Neg -${Math.round(model.negativeMarkPercent * 100)}%`
            : 'No neg. marking',
        },
      ];

  // `green` marks the one CTA that is a reward rather than an invitation: the
  // result is already earned, so it reads in the same green as the Completed
  // badge. Start Test and Go to Subscription keep the plain white button.
  const cta: {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: (() => void) | null;
    muted: boolean;
    green?: boolean;
  } = isMissed
    ? { label: 'Missed - Locked', icon: 'lock-closed', onPress: null, muted: true }
    : locked
      ? { label: 'Go to Subscription', icon: 'card-outline', onPress: onSubscribePress, muted: false }
      : isUpcoming || demo
        ? {
            // The real release date, not a hardcoded "Tomorrow" — a model can be
            // scheduled any number of days out.
            label: dateLabel ? `Unlocks ${dateLabel}` : 'Unlocks soon',
            icon: 'lock-closed-outline',
            onPress: null,
            muted: true,
          }
        : completed
          ? { label: 'View Result', icon: 'eye-outline', onPress: onPrimaryPress, muted: false, green: true }
          : { label: 'Start Test', icon: 'play', onPress: onPrimaryPress, muted: false };

  const ctaInk = cta.muted ? 'rgba(255,255,255,0.9)' : cta.green ? '#FFFFFF' : palette.shadow;

  return (
    <LinearGradient
      colors={palette.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, { width, shadowColor: palette.shadow }]}
    >
      <View style={styles.glow} />
      <View style={styles.glowSmall} />

      {/* Status + tier */}
      <View style={styles.topRow}>
        {isMissed ? (
          <View style={[styles.pill, styles.missedPill]}>
            <Ionicons name="lock-closed" size={12} color="#FECACA" />
            <Text variant="caption" weight="bold" style={{ color: '#FEE2E2' }}>
              Missed
            </Text>
          </View>
        ) : isLive ? (
          <Animated.View style={[styles.pill, styles.livePill, blinkStyle]}>
            <View style={styles.liveDot} />
            <Text variant="caption" weight="bold" style={styles.liveText}>
              LIVE
            </Text>
          </Animated.View>
        ) : completed ? (
          <View style={[styles.pill, styles.donePill]}>
            <Ionicons name="checkmark-circle" size={13} color="#FFFFFF" />
            <Text variant="caption" weight="bold" style={{ color: '#FFFFFF' }}>
              Completed
            </Text>
          </View>
        ) : (
          <View style={[styles.pill, styles.softPill]}>
            <Ionicons name="calendar-outline" size={12} color="#E0E7FF" />
            <Text variant="caption" weight="bold" style={{ color: '#E0E7FF' }}>
              Upcoming
            </Text>
          </View>
        )}

        {model.isPro && !demo ? (
          hasPremiumAccess ? (
            <View style={[styles.pill, styles.purchasedPill]}>
              <Ionicons name="shield-checkmark" size={12} color="#BBF7D0" />
              <Text variant="caption" weight="bold" style={{ color: '#DCFCE7' }}>
                Purchased (active)
              </Text>
            </View>
          ) : (
            <View style={[styles.pill, styles.premiumPill]}>
              <Ionicons name="diamond" size={11} color="#FFEDD5" />
              <Text variant="caption" weight="bold" style={{ color: '#FFF7ED' }}>
                Premium
              </Text>
            </View>
          )
        ) : (
          <View style={[styles.pill, styles.freePill]}>
            <Ionicons name="gift-outline" size={12} color="#BBF7D0" />
            <Text variant="caption" weight="bold" style={{ color: '#DCFCE7' }}>
              Free
            </Text>
          </View>
        )}
      </View>

      {/* Title block. The eyebrow carries the slot, the release date and — when a
          day holds more than one test — which of them this is. */}
      <View style={styles.eyebrowRow}>
        <Text variant="caption" weight="bold" style={styles.slotLabel}>
          {SLOT_LABEL[slot]}
        </Text>
        {dateLabel ? (
          <>
            <View style={styles.eyebrowDot} />
            <Ionicons name="calendar-clear-outline" size={11} color="rgba(255,255,255,0.72)" />
            <Text variant="caption" weight="bold" style={styles.slotLabel}>
              {dateLabel}
            </Text>
          </>
        ) : null}
        {indexInDay && indexInDay.total > 1 ? (
          <>
            <View style={styles.eyebrowDot} />
            <Text variant="caption" weight="bold" style={styles.slotLabel}>
              TEST {indexInDay.index} OF {indexInDay.total}
            </Text>
          </>
        ) : null}
      </View>
      <View style={styles.titleRow}>
        <Text variant="h2" weight="bold" style={styles.title} numberOfLines={2}>
          {model.modelName || model.name}
        </Text>
        {completed && typeof scorePercent === 'number' ? (
          <View style={styles.scoreBadge}>
            <Text variant="bodyLarge" weight="bold" style={{ color: '#FFFFFF' }}>
              {scorePercent}%
            </Text>
          </View>
        ) : null}
      </View>

      {/* Category */}
      <View style={styles.categoryRow}>
        <View style={[styles.pill, styles.softPill]}>
          <Ionicons name={category.icon} size={12} color={category.color} />
          <Text variant="caption" weight="bold" style={{ color: category.color }}>
            {category.label}
          </Text>
        </View>
        {/* The demo card has no real pass mark, so it does not claim one. */}
        {!demo ? (
          <View style={[styles.pill, styles.softPill]}>
            <Ionicons name="ribbon-outline" size={12} color="#E0E7FF" />
            <Text variant="caption" weight="bold" style={{ color: '#E0E7FF' }}>
              Pass {model.passPercent}%
            </Text>
          </View>
        ) : null}
        {locked && model.price > 0 ? (
          <View style={[styles.pill, styles.softPill]}>
            <Ionicons name="pricetag-outline" size={12} color="#FDE68A" />
            <Text variant="caption" weight="bold" style={{ color: '#FEF3C7' }}>
              Rs. {model.price}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Exam config */}
      <View style={styles.metaRow}>
        {meta.map((item) => (
          <View key={item.label} style={styles.metaChip}>
            <Ionicons name={item.icon} size={13} color="rgba(255,255,255,0.82)" />
            <Text variant="caption" style={styles.metaText}>
              {item.label}
            </Text>
          </View>
        ))}
      </View>

      {/* Pushes the CTA to the bottom edge. This is what makes every card the
          same shape: a card with a one-line title absorbs the difference here
          instead of ending up shorter than its neighbours. */}
      <View style={styles.spacer} />

      {/* CTA */}
      <Pressable
        onPress={cta.onPress ?? undefined}
        disabled={!cta.onPress}
        style={({ pressed }) => [
          styles.cta,
          cta.muted ? styles.ctaMuted : styles.ctaSolid,
          !cta.muted && cta.green ? styles.ctaGreen : null,
          { opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Ionicons name={cta.icon} size={16} color={ctaInk} />
        <Text variant="bodySmall" weight="bold" style={{ color: ctaInk }}>
          {cta.label}
        </Text>
      </Pressable>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 18,
    overflow: 'hidden',
    // flexGrow (not flex) on purpose: flexBasis stays `auto`, so the card is at
    // least as tall as its own content and then STRETCHES to match the tallest
    // slide beside it. `flex: 1` would zero the basis and collapse the card
    // wherever it is used outside a stretching row.
    flexGrow: 1,
    minHeight: 300,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  glow: {
    position: 'absolute',
    top: -34,
    right: -22,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  glowSmall: {
    position: 'absolute',
    bottom: -40,
    left: -26,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  // Light red, glowing: the shadow is red rather than black so the badge looks
  // lit from within, and the pill's own opacity is animated to make it breathe.
  livePill: {
    backgroundColor: LIVE_BG,
    borderColor: '#FEE2E2',
    shadowColor: LIVE_GLOW,
    shadowOpacity: 0.95,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 0 },
    elevation: 7,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#B91C1C' },
  liveText: { color: LIVE_INK, letterSpacing: 0.7 },
  // Solid green, not a green tint: "Completed" is a verdict, and at pill size a
  // 28%-opacity fill on a coloured card barely registered as green at all.
  donePill: { backgroundColor: DONE_GREEN, borderColor: DONE_GREEN_DEEP },
  missedPill: { backgroundColor: 'rgba(220,38,38,0.24)', borderColor: 'rgba(248,113,113,0.5)' },
  softPill: { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.22)' },
  freePill: { backgroundColor: 'rgba(34,197,94,0.24)', borderColor: 'rgba(134,239,172,0.5)' },
  // Dark orange, solid — it has to stand apart from both the Free pill's green
  // and the card body behind it.
  premiumPill: { backgroundColor: PREMIUM_ORANGE, borderColor: 'rgba(253,186,116,0.9)' },
  purchasedPill: { backgroundColor: 'rgba(16,185,129,0.28)', borderColor: 'rgba(167,243,208,0.6)' },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginTop: 14 },
  eyebrowDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.5)',
    marginHorizontal: 2,
  },
  slotLabel: { color: 'rgba(255,255,255,0.72)', letterSpacing: 0.9 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 3 },
  title: { color: '#FFFFFF', flex: 1 },
  scoreBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 12 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 14 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { color: 'rgba(255,255,255,0.82)' },
  spacer: { flexGrow: 1, minHeight: 0 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 16,
  },
  ctaSolid: { backgroundColor: '#FFFFFF' },
  ctaGreen: { backgroundColor: DONE_GREEN },
  ctaMuted: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.3)',
  },
});
