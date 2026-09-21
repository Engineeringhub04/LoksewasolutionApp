// §43 Help Center.
//
// Rebuilt 2026-09-14. The old version had four hard-coded English questions and
// a contact form bolted to the bottom, which meant a Nepali user got an English
// help page and nothing in it mentioned two thirds of the app.
//
// Structure, and why:
// - Search first. People arrive here with a specific question, not a desire to
//   browse. Search looks at answers as well as questions, so "offline" finds the
//   answer that contains the word even when the question doesn't.
// - Topic chips instead of nested sections. A category inside a category means
//   two taps before you can read anything; chips filter the same flat list.
// - The contact form is GONE. It duplicated Contact Us, which is a real screen
//   with its own offline handling — this page links to it instead, so there is
//   one place where a support message is written and one place to maintain.
// - Every contact value comes from AppConfig, the same source App Info reads, so
//   a changed support email updates both screens at once.
import React, { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';

import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { AppConfig } from '@/src/core/config/appConfig';
import { SubpageScrollScreen } from '@/src/components/nav/SubpageScrollScreen';
import { SearchBar } from '@/src/components/inputs/SearchBar';
import { Text } from '@/src/components/misc/Text';

interface HelpTopic {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Fixed hues, like the analytics legend: a topic colour has to mean the same
   *  thing in light and dark, which theme tokens don't guarantee. */
  color: string;
  /** How many q/a pairs exist under `help.faq.<key>` in the locale files. */
  count: number;
}

const TOPICS: HelpTopic[] = [
  { key: 'start', icon: 'rocket-outline', color: '#6366F1', count: 3 },
  { key: 'study', icon: 'book-outline', color: '#10B981', count: 3 },
  { key: 'exams', icon: 'timer-outline', color: '#F59E0B', count: 3 },
  { key: 'daily', icon: 'calendar-outline', color: '#0EA5E9', count: 3 },
  { key: 'current', icon: 'newspaper-outline', color: '#14B8A6', count: 3 },
  { key: 'progress', icon: 'stats-chart-outline', color: '#A855F7', count: 3 },
  { key: 'account', icon: 'person-circle-outline', color: '#EC4899', count: 3 },
  { key: 'app', icon: 'settings-outline', color: '#64748B', count: 3 },
];

interface FaqItem {
  id: string;
  topicKey: string;
  color: string;
  question: string;
  answer: string;
}

export default function HelpCenterScreen() {
  const { colors, radius, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [topic, setTopic] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  // Rebuilt whenever the language changes, because `t` changes identity with it.
  const allItems = useMemo<FaqItem[]>(
    () =>
      TOPICS.flatMap((entry) =>
        Array.from({ length: entry.count }, (_, index) => {
          const n = index + 1;
          return {
            id: `${entry.key}.${n}`,
            topicKey: entry.key,
            color: entry.color,
            question: t(`help.faq.${entry.key}.q${n}`),
            answer: t(`help.faq.${entry.key}.a${n}`),
          };
        }),
      ),
    [t],
  );

  const query = search.trim().toLowerCase();

  // A live query outranks the chip. Someone who types "offline" wants the answer
  // wherever it lives, not "no results in Exams".
  const items = useMemo(() => {
    if (query) {
      return allItems.filter(
        (item) =>
          item.question.toLowerCase().includes(query) || item.answer.toLowerCase().includes(query),
      );
    }
    if (topic) return allItems.filter((item) => item.topicKey === topic);
    return allItems;
  }, [allItems, query, topic]);

  const quickActions: {
    key: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    label: string;
    desc: string;
    onPress: () => void;
  }[] = [
    {
      key: 'report',
      icon: 'warning-outline',
      color: '#EF4444',
      label: t('help.reportTitle'),
      desc: t('help.quickReportDesc'),
      onPress: () => router.push('/settings/report-problem'),
    },
    {
      key: 'contact',
      icon: 'chatbubbles-outline',
      color: '#0EA5E9',
      label: t('help.contactTitle'),
      desc: t('help.quickContactDesc'),
      onPress: () => router.push('/contact-us'),
    },
    {
      key: 'feedback',
      icon: 'star-outline',
      color: '#F59E0B',
      label: t('profile.feedback'),
      desc: t('help.quickFeedbackDesc'),
      onPress: () => router.push('/feedback'),
    },
  ];

  const contactRows: {
    key: string;
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value: string;
    onPress: () => void;
  }[] = [
    {
      key: 'email',
      icon: 'mail-outline',
      label: t('help.contactEmail'),
      value: AppConfig.legal.supportEmail,
      onPress: () => Linking.openURL(`mailto:${AppConfig.legal.supportEmail}`),
    },
    {
      key: 'phone',
      icon: 'call-outline',
      label: t('help.contactPhone'),
      value: AppConfig.legal.contactPhone,
      onPress: () => Linking.openURL(`tel:${AppConfig.legal.contactPhone}`),
    },
    {
      key: 'website',
      icon: 'globe-outline',
      label: t('help.contactWebsite'),
      value: AppConfig.links.website.replace(/^https?:\/\//, ''),
      onPress: () => Linking.openURL(AppConfig.links.website),
    },
  ];

  return (
    <SubpageScrollScreen title={t('help.title')}>
      {/* ===== Hero ===== */}
      <Animated.View
        entering={FadeInDown.duration(360)}
        style={[
          styles.hero,
          { backgroundColor: `${colors.primary}14`, borderRadius: radius.lg, padding: spacing.md },
        ]}
      >
        <View style={[styles.heroIcon, { backgroundColor: colors.primary }]}>
          <Ionicons name="help-buoy" size={20} color={colors.onPrimary} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyLarge" weight="bold">{t('help.heroTitle')}</Text>
          <Text variant="caption" secondary style={styles.para}>{t('help.heroBody')}</Text>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(360).delay(50)}>
        <SearchBar value={search} onChangeText={setSearch} placeholder={t('help.searchFaq')} />
      </Animated.View>

      {/* ===== Topic chips ===== */}
      {/* Hidden while searching: a filter that the results are ignoring is a lie. */}
      {query ? null : (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(120)}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            <Chip
              label={t('help.topicsAll')}
              color={colors.primary}
              active={topic === null}
              onPress={() => {
                setTopic(null);
                setOpenId(null);
              }}
            />
            {TOPICS.map((entry) => (
              <Chip
                key={entry.key}
                icon={entry.icon}
                label={t(`help.faq.${entry.key}.title`)}
                color={entry.color}
                active={topic === entry.key}
                onPress={() => {
                  setTopic(topic === entry.key ? null : entry.key);
                  setOpenId(null);
                }}
              />
            ))}
          </ScrollView>
        </Animated.View>
      )}

      {/* ===== FAQ ===== */}
      {/* Compact inline empty, not the global EmptyState — that one is flex:1 with
          a 64px icon, which inside a scroll view leaves a crater. */}
      {items.length === 0 ? (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={[
            styles.empty,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.lg,
              padding: spacing.lg,
            },
          ]}
        >
          <Ionicons name="search-outline" size={26} color={colors.textDisabled} />
          <Text variant="bodySmall" weight="semiBold">{t('help.noFaq')}</Text>
          <Text variant="caption" secondary style={[styles.para, styles.footnote]}>
            {t('help.noFaqHint')}
          </Text>
        </Animated.View>
      ) : (
        <Animated.View
          layout={LinearTransition.duration(220)}
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
          ]}
        >
          {items.map((item, index) => (
            <React.Fragment key={item.id}>
              {index > 0 ? (
                <View style={[styles.divider, { backgroundColor: colors.divider }]} />
              ) : null}
              <FaqRow
                item={item}
                open={openId === item.id}
                onToggle={() => setOpenId(openId === item.id ? null : item.id)}
              />
            </React.Fragment>
          ))}
        </Animated.View>
      )}

      {/* ===== Still stuck ===== */}
      <Text variant="bodyLarge" weight="bold" style={{ marginTop: spacing.xs }}>
        {t('help.stillStuck')}
      </Text>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
        ]}
      >
        {quickActions.map((action, index) => (
          <React.Fragment key={action.key}>
            {index > 0 ? <View style={[styles.divider, { backgroundColor: colors.divider }]} /> : null}
            <Pressable
              onPress={action.onPress}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.row,
                { padding: spacing.md, gap: spacing.md, opacity: pressed ? 0.65 : 1 },
              ]}
            >
              <View style={[styles.iconBox, { backgroundColor: `${action.color}1F`, borderRadius: radius.md }]}>
                <Ionicons name={action.icon} size={19} color={action.color} />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text variant="body" weight="semiBold" numberOfLines={1}>{action.label}</Text>
                <Text variant="caption" secondary numberOfLines={2} style={styles.para}>{action.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={colors.textSecondary} />
            </Pressable>
          </React.Fragment>
        ))}
      </View>

      {/* ===== Reach us — same values App Info shows ===== */}
      <Text variant="bodyLarge" weight="bold" style={{ marginTop: spacing.xs }}>
        {t('help.reachTitle')}
      </Text>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
        ]}
      >
        {contactRows.map((row, index) => (
          <React.Fragment key={row.key}>
            {index > 0 ? <View style={[styles.divider, { backgroundColor: colors.divider }]} /> : null}
            <Pressable
              onPress={row.onPress}
              accessibilityRole="link"
              style={({ pressed }) => [
                styles.row,
                { padding: spacing.md, gap: spacing.md, opacity: pressed ? 0.65 : 1 },
              ]}
            >
              <View style={[styles.iconBox, { backgroundColor: `${colors.primary}17`, borderRadius: radius.md }]}>
                <Ionicons name={row.icon} size={19} color={colors.primary} />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text variant="caption" secondary>{row.label}</Text>
                <Text variant="body" weight="semiBold" numberOfLines={1}>{row.value}</Text>
              </View>
              <Ionicons name="open-outline" size={17} color={colors.textSecondary} />
            </Pressable>
          </React.Fragment>
        ))}
      </View>

      <Text variant="caption" secondary style={[styles.para, styles.footnote]}>
        {t('help.responseNote')}
      </Text>
    </SubpageScrollScreen>
  );
}

/** Topic filter pill. Fills with its own hue when active. */
function Chip({
  icon,
  label,
  color,
  active,
  onPress,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors, radius } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.chip,
        {
          borderRadius: radius.pill,
          backgroundColor: active ? color : colors.surface,
          borderColor: active ? color : colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      {icon ? <Ionicons name={icon} size={13} color={active ? '#FFFFFF' : color} /> : null}
      <Text
        variant="caption"
        weight="semiBold"
        color={active ? '#FFFFFF' : colors.textPrimary}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * One question. Only one row is open at a time — an accordion that lets
 * everything expand at once is just a long page with extra taps in it.
 */
function FaqRow({ item, open, onToggle }: { item: FaqItem; open: boolean; onToggle: () => void }) {
  const { colors, radius, spacing } = useTheme();

  return (
    <Animated.View layout={LinearTransition.duration(200)}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [
          styles.row,
          { padding: spacing.md, gap: spacing.sm + 2, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <View style={[styles.qDot, { backgroundColor: `${item.color}1F`, borderRadius: radius.sm }]}>
          <Ionicons name="help" size={13} color={item.color} />
        </View>
        <Text variant="bodySmall" weight="semiBold" style={{ flex: 1 }}>
          {item.question}
        </Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textSecondary}
        />
      </Pressable>

      {open ? (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(120)}
          style={{
            paddingHorizontal: spacing.md,
            paddingBottom: spacing.md,
            paddingLeft: spacing.md + 26 + spacing.sm + 2,
          }}
        >
          <Text variant="caption" secondary style={styles.para}>
            {item.answer}
          </Text>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  para: { lineHeight: 17 },
  footnote: { textAlign: 'center', marginTop: 4 },
  chipRow: { gap: 8, paddingVertical: 2, paddingRight: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: StyleSheet.hairlineWidth,
  },
  card: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  empty: { alignItems: 'center', gap: 6, borderWidth: StyleSheet.hairlineWidth },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  row: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  qDot: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
});
