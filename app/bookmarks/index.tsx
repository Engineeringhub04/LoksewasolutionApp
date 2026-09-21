// §34 Bookmarks — the saved library.
//
// DESIGN — this page reads entirely from `useBookmarkStore`, never from its own
// query. The store is already loaded by whichever bookmark icon the user pressed,
// so opening this page costs zero extra reads and the list is instantly in sync
// with every icon in the app (remove here → the icon on the exam screen flips
// back immediately, no refetch).
//
// Cards never redirect into the source flow. Tapping one opens
// /bookmarks/[id], which renders the saved SNAPSHOT in place — that is the whole
// point of storing `payload` alongside the reference.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { FadeInDown, LinearTransition } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { useProfileStore } from '@/src/core/store/profileStore';
import { useBookmarkStore } from '@/src/core/store/bookmarkStore';
import { hasActivePremium } from '@/src/core/firebase/services/profile';
import { BOOKMARK_LIMIT_PER_SUBCOURSE, type Bookmark, type BookmarkContext } from '@/src/core/firebase/services/bookmarks';
import { showToast } from '@/src/core/store/toastStore';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';
import { Text } from '@/src/components/misc/Text';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { Preloading } from '@/src/components/Preloading';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';
import { ConfirmDialog } from '@/src/components/feedback/ConfirmDialog';

/** Per-context identity: icon + accent. Keeps the list scannable at a glance. */
const CONTEXT_STYLE: Record<BookmarkContext, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  exam: { icon: 'school-outline', color: '#2563EB' },
  read: { icon: 'book-outline', color: '#0D9488' },
  practice: { icon: 'barbell-outline', color: '#EA580C' },
  'daily-test': { icon: 'today-outline', color: '#7C3AED' },
  qotd: { icon: 'sunny-outline', color: '#D97706' },
  quiz: { icon: 'help-circle-outline', color: '#DB2777' },
  discussion: { icon: 'chatbubbles-outline', color: '#4F46E5' },
  article: { icon: 'newspaper-outline', color: '#059669' },
  note: { icon: 'document-text-outline', color: '#475569' },
  chapter: { icon: 'layers-outline', color: '#0891B2' },
  other: { icon: 'bookmark-outline', color: '#64748B' },
};

function contextStyle(context: BookmarkContext) {
  return CONTEXT_STYLE[context] ?? CONTEXT_STYLE.other;
}

function savedDate(item: Bookmark): string {
  try {
    const date = item.createdAt?.toDate?.();
    if (!date) return '';
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

export default function BookmarksScreen() {
  const { colors, spacing, radius, elevation, effective } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const uid = useAuthStore((s) => s.user?.uid ?? null);
  const profile = useProfileStore((s) => s.profile);

  const items = useBookmarkStore((s) => s.items);
  const loading = useBookmarkStore((s) => s.loading);
  const error = useBookmarkStore((s) => s.error);
  const loadedUid = useBookmarkStore((s) => s.loadedUid);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<BookmarkContext | 'all'>('all');
  const [pendingRemove, setPendingRemove] = useState<Bookmark | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const premium = hasActivePremium(profile);
  const subcourseId = profile?.subcourseId ?? null;

  useEffect(() => {
    if (uid) void useBookmarkStore.getState().load(uid);
  }, [uid]);

  const refresh = useCallback(async () => {
    if (!uid) return;
    setRefreshing(true);
    await useBookmarkStore.getState().load(uid, true);
    setRefreshing(false);
  }, [uid]);

  // Only contexts the user actually has get a chip — an empty filter is noise.
  const chips = useMemo(() => {
    const seen = new Map<BookmarkContext, number>();
    for (const item of items) seen.set(item.context, (seen.get(item.context) ?? 0) + 1);
    return [...seen.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filter !== 'all' && item.context !== filter) return false;
      if (!needle) return true;
      return (
        item.title.toLowerCase().includes(needle) ||
        (item.preview ?? '').toLowerCase().includes(needle) ||
        (item.sourceLabel ?? '').toLowerCase().includes(needle)
      );
    });
  }, [filter, items, query]);

  const used = useBookmarkStore((s) => s.countFor(subcourseId));
  const left = Math.max(0, BOOKMARK_LIMIT_PER_SUBCOURSE - used);
  const ratio = premium ? 1 : Math.min(1, used / BOOKMARK_LIMIT_PER_SUBCOURSE);

  const confirmRemove = async () => {
    const target = pendingRemove;
    setPendingRemove(null);
    if (!target || !uid) return;
    const ok = await useBookmarkStore.getState().remove(uid, target.id);
    showToast(ok ? t('bookmarks.removedToast') : t('common.somethingWentWrong'), ok ? 'info' : 'error');
  };

  const hasLoadedOnce = uid ? loadedUid === uid || !!error : true;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SubpageHeader title={t('bookmarks.title')} showThemeToggle />

      {!hasLoadedOnce ? (
        <Preloading tinted={false} label={t('common.loading')} hint={t('loadHints.common')} />
      ) : error && items.length === 0 ? (
        <DataNotFound onRetry={() => void refresh()} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
          contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: spacing.xxl * 2, gap: 10 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={{ gap: 14, marginBottom: 4 }}>
              {/* Slot meter — the 15-per-sub-course cap made visible before it bites. */}
              <LinearGradient
                colors={premium ? ['#0F3D2E', '#166534', '#15803D'] : ['#0B1F51', '#153E90', '#2257C7']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.meter, elevation[3]]}
              >
                <View style={styles.meterTop}>
                  <View style={{ flex: 1 }}>
                    <Text variant="overline" weight="bold" style={styles.meterEyebrow}>
                      {t('bookmarks.slotsTitle').toUpperCase()}
                    </Text>
                    <Text variant="bodySmall" style={styles.meterSub}>
                      {premium
                        ? t('bookmarks.slotsUnlimited')
                        : t('bookmarks.slotsUsed', { used: String(used), limit: String(BOOKMARK_LIMIT_PER_SUBCOURSE) })}
                    </Text>
                  </View>
                  <View style={styles.meterBadge}>
                    <Ionicons name={premium ? 'diamond' : 'bookmark'} size={13} color="#FFF" />
                    <Text variant="caption" weight="bold" style={{ color: '#FFF' }}>
                      {premium ? t('bookmarks.slotsPremium') : `${used}/${BOOKMARK_LIMIT_PER_SUBCOURSE}`}
                    </Text>
                  </View>
                </View>

                <View style={styles.track}>
                  <View
                    style={[
                      styles.trackFill,
                      { width: `${Math.round(ratio * 100)}%`, backgroundColor: !premium && left === 0 ? '#FCA5A5' : '#93C5FD' },
                    ]}
                  />
                </View>

                <View style={styles.meterBottom}>
                  <Text variant="caption" style={styles.meterHint}>
                    {premium
                      ? t('bookmarks.itemsCount', { count: String(items.length) })
                      : left === 0
                        ? t('bookmarks.slotsFull')
                        : t('bookmarks.slotsLeft', { left: String(left) })}
                  </Text>
                  {!premium && left === 0 ? (
                    <Pressable onPress={() => router.push('/subscription' as never)} style={styles.upgradeBtn}>
                      <Text variant="caption" weight="bold" style={{ color: '#0B1F51' }}>{t('bookmarks.upgrade')}</Text>
                    </Pressable>
                  ) : null}
                </View>
              </LinearGradient>

              {items.length > 0 ? (
                <>
                  <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md }]}>
                    <Ionicons name="search-outline" size={17} color={colors.textSecondary} />
                    <TextInput
                      value={query}
                      onChangeText={setQuery}
                      placeholder={t('bookmarks.searchPlaceholder')}
                      placeholderTextColor={colors.textDisabled}
                      style={[styles.searchInput, { color: colors.textPrimary }]}
                      returnKeyType="search"
                    />
                    {query ? (
                      <Pressable onPress={() => setQuery('')} hitSlop={8}>
                        <Ionicons name="close-circle" size={17} color={colors.textDisabled} />
                      </Pressable>
                    ) : null}
                  </View>

                  <FlatList
                    horizontal
                    data={[['all', items.length] as const, ...chips]}
                    keyExtractor={([key]) => String(key)}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 7 }}
                    renderItem={({ item: [key, count] }) => {
                      const active = filter === key;
                      const style = key === 'all' ? null : contextStyle(key as BookmarkContext);
                      const accent = style?.color ?? colors.primary;
                      return (
                        <Pressable
                          onPress={() => setFilter(key as BookmarkContext | 'all')}
                          style={({ pressed }) => [
                            styles.chip,
                            {
                              backgroundColor: active ? `${accent}${effective === 'dark' ? '2E' : '18'}` : colors.surface,
                              borderColor: active ? `${accent}${effective === 'dark' ? '88' : '55'}` : colors.border,
                              opacity: pressed ? 0.85 : 1,
                            },
                          ]}
                        >
                          {style ? <Ionicons name={style.icon} size={13} color={active ? accent : colors.textSecondary} /> : null}
                          <Text variant="caption" weight={active ? 'bold' : 'medium'} style={{ color: active ? accent : colors.textSecondary }}>
                            {key === 'all' ? t('bookmarks.all') : t(`bookmarks.ctx.${key}`)}
                          </Text>
                          <Text variant="caption" weight="bold" style={{ color: active ? accent : colors.textDisabled }}>{count}</Text>
                        </Pressable>
                      );
                    }}
                  />
                </>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            !hasLoadedOnce ? null : items.length === 0 ? (
              <EmptyState
                icon="bookmark-outline"
                title={t('bookmarks.empty')}
                description={t('bookmarks.emptyHint')}
                ctaLabel={t('bookmarks.browseSubjects')}
                ctaIcon="search"
                onCtaPress={() => router.push('/subjects')}
              />
            ) : (
              <EmptyState icon="search-outline" title={t('bookmarks.noResults')} />
            )
          }
          renderItem={({ item, index }) => (
            <BookmarkCard
              item={item}
              index={index}
              onPress={() => router.push(`/bookmarks/${encodeURIComponent(item.id)}` as never)}
              onRemove={() => setPendingRemove(item)}
            />
          )}
        />
      )}

      <ConfirmDialog
        visible={pendingRemove !== null}
        icon="bookmark-outline"
        title={t('bookmarks.removeTitle')}
        subtitle={pendingRemove?.title}
        message={t('bookmarks.removeBody')}
        confirmLabel={t('bookmarks.removeConfirm')}
        destructive
        onConfirm={() => void confirmRemove()}
        onCancel={() => setPendingRemove(null)}
      />
    </View>
  );
}

/**
 * One saved item. The left rail is tinted per context so the list reads as
 * grouped even when the filter is "All". Entry is staggered by index, capped so
 * a long list never feels like it is loading in slow motion.
 */
function BookmarkCard({
  item,
  index,
  onPress,
  onRemove,
}: {
  item: Bookmark;
  index: number;
  onPress: () => void;
  onRemove: () => void;
}) {
  const { colors, radius, elevation, effective } = useTheme();
  const { t } = useTranslation();
  const style = contextStyle(item.context);
  const date = savedDate(item);
  const badge = item.sourceLabel || t(`bookmarks.ctx.${item.context}`);

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 45).duration(320)} layout={LinearTransition.duration(220)}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: pressed ? `${style.color}66` : colors.border,
            borderRadius: radius.lg,
            opacity: pressed ? 0.96 : 1,
          },
          elevation[1],
        ]}
      >
        <View style={[styles.rail, { backgroundColor: style.color }]} />
        <View style={[styles.cardIcon, { backgroundColor: `${style.color}${effective === 'dark' ? '26' : '14'}` }]}>
          <Ionicons name={style.icon} size={19} color={style.color} />
        </View>

        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="body" weight="semiBold" numberOfLines={2}>{item.title}</Text>
          {item.preview ? (
            <Text variant="bodySmall" secondary numberOfLines={2}>{item.preview}</Text>
          ) : null}
          <View style={styles.cardMeta}>
            <View style={[styles.cardBadge, { backgroundColor: `${style.color}${effective === 'dark' ? '22' : '12'}` }]}>
              <Text variant="caption" weight="semiBold" numberOfLines={1} style={{ color: style.color }}>{badge}</Text>
            </View>
            {date ? <Text variant="caption" style={{ color: colors.textDisabled }}>{t('bookmarks.savedOn', { date })}</Text> : null}
          </View>
        </View>

        <Pressable onPress={onRemove} hitSlop={10} accessibilityLabel={t('bookmarks.removeAction')} style={styles.cardRemove}>
          <Ionicons name="trash-outline" size={17} color={colors.textDisabled} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  meter: { borderRadius: 22, padding: 16, overflow: 'hidden', gap: 11 },
  meterTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  meterEyebrow: { color: '#93C5FD', letterSpacing: 1.1 },
  meterSub: { color: 'rgba(239,246,255,.82)', marginTop: 3 },
  meterBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999, backgroundColor: 'rgba(255,255,255,.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,.22)',
  },
  track: { height: 7, borderRadius: 999, backgroundColor: 'rgba(255,255,255,.18)', overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: 999 },
  meterBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  meterHint: { color: 'rgba(255,255,255,.76)', flex: 1 },
  upgradeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#FFF' },

  search: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 44, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },

  card: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13, paddingLeft: 17, borderWidth: 1, overflow: 'hidden' },
  rail: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  cardIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 },
  cardBadge: { maxWidth: '65%', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  cardRemove: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
