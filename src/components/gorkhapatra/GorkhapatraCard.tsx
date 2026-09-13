// List card for one Gorkhapatra Loksewa post.
//
// Deliberately built to the SAME recipe as the notification inbox row
// (src/components/cards/NotificationRow.tsx) — per explicit user feedback that
// the topic list should feel like the notifications page, where every row is
// obviously its own separate card: rounded surface tile, hairline border,
// pressed state swapping surface -> surfaceAlt, a pill icon tile on the left,
// then title / excerpt / meta row, with the cover image inset at the bottom.
//
// The one extra flourish is the left accent spine: at rest it is a short nub
// parked at the vertical centre, and on touch it grows from that centre
// outward (up AND down) to the full card height, then retracts on release.
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { useTranslation, type Language } from '@/src/core/i18n';
import { Text } from '@/src/components/misc/Text';
import type { GorkhapatraPost } from '@/src/core/firebase/services/content';

const ACCENT = '#7C3AED'; // matches the Gorkhapatra quick-link accent on Home
const ACCENT_DARK = '#A78BFA'; // lighter violet so the spine stays visible on the dark surface

// Dark-orange highlight for the date chip. Lighter text on a warmer, more
// translucent fill in dark mode so it stays legible on the dark card.
const DATE_CHIP = {
  light: { fg: '#C2410C', bg: 'rgba(234,88,12,0.12)' },
  dark: { fg: '#FDBA74', bg: 'rgba(251,146,60,0.16)' },
} as const;

// Height of the resting nub. Small enough to read as a quiet accent mark, big
// enough that the "grows from here" origin is obvious once you press.
const SPINE_NUB_HEIGHT = 26;
const SPINE_WIDTH = 4;

function formatDate(value: GorkhapatraPost['publishedAt']): string {
  if (!value) return '';
  try {
    return value.toDate().toLocaleDateString('ne-NP', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

const NEPALI_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
function toNepaliDigits(n: number): string {
  return String(n).replace(/[0-9]/g, (d) => NEPALI_DIGITS[Number(d)]);
}

/**
 * "Added X ago" using the post's fetchedAt (when the admin last seeded it).
 * Compact English form ("2m ago") to match the requested style; a natural
 * Devanagari form in Nepali ("२ मिनेट अघि"). Hidden for missing/garbage times and
 * for posts older than a month so we never show "120d ago".
 */
function formatAddedAgo(
  fetchedAt: GorkhapatraPost['fetchedAt'],
  language: Language,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (!fetchedAt) return '';
  let ms: number;
  try {
    ms = fetchedAt.toMillis();
  } catch {
    return '';
  }
  const diff = Date.now() - ms;
  if (!Number.isFinite(diff) || diff < 0) return '';

  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('gorkhapatra.justNow');

  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 30) return ''; // too old → the date chip is enough

  let n: number;
  let enUnit: string;
  let neUnit: string;
  if (days >= 1) {
    n = days;
    enUnit = 'd';
    neUnit = 'दिन';
  } else if (hours >= 1) {
    n = hours;
    enUnit = 'h';
    neUnit = 'घण्टा';
  } else {
    n = mins;
    enUnit = 'm';
    neUnit = 'मिनेट';
  }

  const time = language === 'ne' ? `${toNepaliDigits(n)} ${neUnit}` : `${n}${enUnit}`;
  return t('gorkhapatra.addedAgo', { time });
}

export interface GorkhapatraCardProps {
  post: GorkhapatraPost;
  onPress: () => void;
  questionSetLabel: string;
  readLabel: string;
}

export function GorkhapatraCard({ post, onPress, questionSetLabel, readLabel }: GorkhapatraCardProps) {
  const { colors, spacing, radius, motion, effective } = useTheme();
  const { t, language } = useTranslation();

  const isDark = effective === 'dark';
  const accent = isDark ? ACCENT_DARK : ACCENT;
  const dateChip = DATE_CHIP[isDark ? 'dark' : 'light'];
  // DB-driven badge: use the authored `tag` when present, otherwise fall back to
  // the localized "question set" label so the badge is never hardcoded.
  const badge = post.tag ?? (post.isQuestionSet ? questionSetLabel : null);
  const addedAgo = formatAddedAgo(post.fetchedAt, language, t);
  const dateLabel = post.dateLabel || formatDate(post.publishedAt);

  // 0 = resting nub, 1 = spine filled to the full card height.
  const fill = useSharedValue(0);

  // scaleY on a full-height bar, not an animated `height`. RN scales around the
  // view's centre, so one shared value gives the exact "opens from the middle,
  // upward and downward at once" motion the design asks for — and it runs on
  // the UI thread instead of re-laying-out the card on every frame.
  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: fill.value }] }));
  // The nub dissolves as the full bar takes over, so the two never read as two
  // separate marks stacked on top of each other mid-animation.
  const nubStyle = useAnimatedStyle(() => ({ opacity: 1 - fill.value }));

  const handlePressIn = () => {
    fill.value = withTiming(1, { duration: motion.standard, easing: Easing.out(Easing.cubic) });
  };
  const handlePressOut = () => {
    fill.value = withTiming(0, { duration: motion.standard, easing: Easing.in(Easing.cubic) });
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={post.title}
      accessibilityHint={readLabel}
      style={({ pressed }) => [
        styles.card,
        {
          padding: spacing.md,
          // Extra left inset so the accent spine never crowds the icon tile.
          paddingLeft: spacing.md + 6,
          borderRadius: radius.lg,
          borderColor: pressed ? accent + '55' : colors.divider,
          backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
        },
      ]}
    >
      {/* Accent spine track. Absolute + full height so the fill can reach the
          card's top and bottom edges; overflow:hidden on the card clips it to
          the rounded corners. */}
      <View style={styles.spineTrack} pointerEvents="none">
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: accent }, fillStyle]} />
        <Animated.View style={[styles.spineNub, { backgroundColor: accent }, nubStyle]} />
      </View>

      <View style={styles.row}>
        <View
          style={[
            styles.iconWrap,
            { borderRadius: radius.pill, backgroundColor: isDark ? 'rgba(167,139,250,0.18)' : 'rgba(124,58,237,0.12)' },
          ]}
        >
          <Ionicons name={post.isQuestionSet ? 'help-circle' : 'document-text'} size={20} color={accent} />
        </View>

        <View style={styles.content}>
          <Text variant="body" weight="bold" numberOfLines={2} style={styles.title}>
            {post.title}
          </Text>

          {post.excerpt ? (
            <Text variant="bodySmall" secondary numberOfLines={3} style={styles.preview}>
              {post.excerpt}
            </Text>
          ) : null}

          <View style={styles.metaRow}>
            {dateLabel ? (
              <View style={[styles.pill, { backgroundColor: dateChip.bg }]}>
                <Ionicons name="calendar-outline" size={12} color={dateChip.fg} />
                <Text variant="caption" weight="semiBold" style={{ color: dateChip.fg }}>
                  {dateLabel}
                </Text>
              </View>
            ) : null}
            {badge ? (
              <Text variant="caption" weight="semiBold" numberOfLines={1} style={{ color: accent }}>
                {badge}
              </Text>
            ) : null}
            {addedAgo ? (
              <Text variant="caption" secondary style={styles.time}>
                {addedAgo}
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      {/* Cover image sits at the bottom, inset by the card padding — same place
          the notification card puts its image. */}
      {post.coverImage ? (
        <Image
          source={{ uri: post.coverImage }}
          style={[styles.image, { borderRadius: radius.md, backgroundColor: colors.surfaceAlt }]}
          contentFit="cover"
          cachePolicy="disk"
          transition={150}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // overflow:hidden keeps the animated spine inside the rounded corners.
  card: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  spineTrack: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SPINE_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spineNub: { width: SPINE_WIDTH, height: SPINE_NUB_HEIGHT, borderRadius: SPINE_WIDTH / 2 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  iconWrap: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, gap: 4 },
  title: { flex: 1 },
  preview: { lineHeight: 18 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 9, marginTop: 3 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  time: { marginLeft: 'auto' },
  image: { width: '100%', height: 150, marginTop: 12 },
});
