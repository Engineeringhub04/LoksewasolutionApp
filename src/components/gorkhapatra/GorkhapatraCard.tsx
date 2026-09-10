// List card for one Gorkhapatra Loksewa post. Premium feel: an optional
// edge-to-edge cover image on top, then a dark-orange date chip and a DB-driven
// badge, the title, a short excerpt, and a footer row with the "added X ago" time
// and a Read affordance. The whole card is one pressable that opens the native
// detail screen — no stray inner cards.
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation, type Language } from '@/src/core/i18n';
import { Text } from '@/src/components/misc/Text';
import { Card } from '@/src/components/cards/Card';
import type { GorkhapatraPost } from '@/src/core/firebase/services/content';

const ACCENT = '#7C3AED'; // matches the Gorkhapatra quick-link accent on Home

// Dark-orange highlight for the date chip (point 2). Lighter text on a warmer,
// more translucent fill in dark mode so it stays legible on the dark card.
const DATE_CHIP = {
  light: { fg: '#C2410C', bg: 'rgba(234,88,12,0.12)' },
  dark: { fg: '#FDBA74', bg: 'rgba(251,146,60,0.16)' },
} as const;

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
  const { colors, spacing, radius, effective } = useTheme();
  const { t, language } = useTranslation();

  const dateChip = DATE_CHIP[effective === 'dark' ? 'dark' : 'light'];
  // DB-driven badge: use the authored `tag` when present, otherwise fall back to
  // the localized "question set" label so the badge is never hardcoded.
  const badge = post.tag ?? (post.isQuestionSet ? questionSetLabel : null);
  const addedAgo = formatAddedAgo(post.fetchedAt, language, t);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.94 : 1 }]}>
      <Card style={[styles.card, { borderColor: colors.border }]}>
        {post.coverImage ? (
          <Image
            source={{ uri: post.coverImage }}
            style={styles.cover}
            contentFit="cover"
            cachePolicy="disk"
            transition={200}
          />
        ) : null}
        <View style={{ padding: spacing.cardPadding }}>
          <View style={styles.metaRow}>
            <View style={[styles.pill, { backgroundColor: dateChip.bg }]}>
              <Ionicons name="calendar-outline" size={13} color={dateChip.fg} />
              <Text variant="caption" weight="semiBold" style={{ color: dateChip.fg }}>
                {post.dateLabel || formatDate(post.publishedAt)}
              </Text>
            </View>
            {badge ? (
              <View style={[styles.pill, styles.badgePill, { backgroundColor: 'rgba(124,58,237,0.12)' }]}>
                <Ionicons name="pricetag" size={12} color={ACCENT} />
                <Text variant="caption" weight="semiBold" style={{ color: ACCENT }}>{badge}</Text>
              </View>
            ) : null}
          </View>

          <Text variant="bodyLarge" weight="bold" numberOfLines={2} style={{ marginTop: spacing.sm }}>
            {post.title}
          </Text>
          {post.excerpt ? (
            <Text variant="body" secondary numberOfLines={2} style={{ marginTop: spacing.xs, lineHeight: 20 }}>
              {post.excerpt}
            </Text>
          ) : null}

          <View style={[styles.divider, { backgroundColor: colors.border, marginTop: spacing.md }]} />

          <View style={styles.footerRow}>
            {addedAgo ? (
              <View style={styles.addedAgo}>
                <Ionicons name="time-outline" size={13} color={colors.textSecondary} />
                <Text variant="caption" secondary>{addedAgo}</Text>
              </View>
            ) : (
              <View />
            )}
            <View style={[styles.readPill, { backgroundColor: effective === 'dark' ? 'rgba(59,130,246,0.16)' : 'rgba(124,58,237,0.10)' }]}>
              <Text variant="bodySmall" weight="semiBold" style={{ color: colors.primary }}>{readLabel}</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.primary} />
            </View>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Override Card's default padding so the cover image can bleed to the rounded
  // edges; overflow:hidden clips it to the card's border radius. A hairline
  // border crisps the card edge against the background (premium polish).
  card: { padding: 0, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  cover: { width: '100%', height: 168, backgroundColor: '#E5E7EB' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  badgePill: { borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,58,237,0.28)' },
  divider: { height: StyleSheet.hairlineWidth, width: '100%' },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  addedAgo: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  readPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999 },
});
