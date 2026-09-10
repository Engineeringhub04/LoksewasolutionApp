// §22 Gorkhapatra Loksewa — a card feed of Loksewa posts ingested from
// Gorkhapatra. Global content (no course/subcourse gating). Tapping a card opens
// a natively-rendered detail screen (not a webview). Newest first, with
// cursor-based "load more" pagination on publishedAt.
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import {
  fetchGorkhapatraPosts,
  GORKHAPATRA_PAGE_SIZE,
  type GorkhapatraPost,
} from '@/src/core/firebase/services/content';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { ThemeToggleButton } from '@/src/components/misc/ThemeToggleButton';
import { Text } from '@/src/components/misc/Text';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { GorkhapatraCard } from '@/src/components/gorkhapatra/GorkhapatraCard';

const ACCENT = '#7C3AED';
// Official Gorkhapatra Loksewa section — the source all posts are collected from.
const OFFICIAL_URL = 'https://gorkhapatraonline.com/categories/loksewa';

export default function GorkhapatraScreen() {
  const { colors, spacing, effective, setMode } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  // Page 1 comes through the shared async-data hook (loading/error/refresh).
  // On mount it may serve the cached first page (very low reads); pull-to-refresh
  // passes isRefresh=true, forcing a fresh Firestore read. Further pages are
  // appended locally so pagination doesn't refetch page 1.
  const page1 = useAsyncData(
    (isRefresh) => fetchGorkhapatraPosts({ limit: GORKHAPATRA_PAGE_SIZE, force: isRefresh }),
    [],
  );
  const [more, setMore] = useState<GorkhapatraPost[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);

  const toggleTheme = () => setMode(effective === 'dark' ? 'light' : 'dark');

  // Merge page 1 + appended pages, de-duplicating by id in case two posts share
  // an identical publishedAt at a page boundary.
  const posts = useMemo(() => {
    const seen = new Set<string>();
    const merged: GorkhapatraPost[] = [];
    for (const post of [...(page1.data ?? []), ...more]) {
      if (seen.has(post.id)) continue;
      seen.add(post.id);
      merged.push(post);
    }
    return merged;
  }, [page1.data, more]);

  const onRefresh = useCallback(() => {
    setMore([]);
    setReachedEnd(false);
    void page1.refresh();
  }, [page1]);

  const loadMore = useCallback(async () => {
    if (loadingMore || reachedEnd || posts.length === 0) return;
    const cursor = posts[posts.length - 1]?.publishedAt;
    const before = cursor ? cursor.toDate() : null;
    if (!before) {
      setReachedEnd(true);
      return;
    }
    setLoadingMore(true);
    try {
      const next = await fetchGorkhapatraPosts({ limit: GORKHAPATRA_PAGE_SIZE, before });
      setMore((prev) => [...prev, ...next]);
      if (next.length < GORKHAPATRA_PAGE_SIZE) setReachedEnd(true);
    } catch {
      // Keep what we have; the user can pull-to-refresh or retry the button.
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, reachedEnd, posts]);

  const headerActions = (
    <ThemeToggleButton isDark={effective === 'dark'} onToggle={toggleTheme} size={36} />
  );

  const openPost = (post: GorkhapatraPost) =>
    router.push({ pathname: '/gorkhapatra/[slug]', params: { slug: post.slug } } as never);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TopAppBar title={t('gorkhapatra.title')} actions={headerActions} />
      <PageLoaderOverlay visible={page1.loading} label={t('gorkhapatra.loading')} />

      {page1.error && !page1.data ? (
        <DataNotFound onRetry={page1.refetch} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: spacing.xxl * 2, gap: spacing.md }}
          refreshControl={<AppRefreshControl refreshing={page1.refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Intro banner — sets context that this is auto-updated Loksewa content. */}
          <View style={[styles.intro, { backgroundColor: effective === 'dark' ? 'rgba(124,58,237,0.16)' : '#F3EEFF' }]}>
            <View style={styles.introIcon}><Ionicons name="reader" size={22} color={ACCENT} /></View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyLarge" weight="bold">{t('gorkhapatra.title')}</Text>
              <Text variant="bodySmall" secondary style={{ marginTop: 2 }}>{t('gorkhapatra.intro')}</Text>
            </View>
          </View>

          {/* Source notice: all posts are collected from the official Gorkhapatra
              Loksewa site. Bilingual (switches with the language toggle); the
              site name is an inline tappable link. */}
          {(() => {
            const parts = t('gorkhapatra.sourceBanner').split('{{link}}');
            return (
              <View style={[styles.sourceNotice, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                <Ionicons name="link-outline" size={16} color={ACCENT} style={{ marginTop: 1 }} />
                <Text variant="bodySmall" secondary style={{ flex: 1, lineHeight: 22 }}>
                  {parts[0]}
                  <Text
                    variant="bodySmall"
                    weight="bold"
                    color={ACCENT}
                    onPress={() => void Linking.openURL(OFFICIAL_URL)}
                  >
                    {t('gorkhapatra.title')}
                  </Text>
                  {parts[1] ?? ''}
                </Text>
              </View>
            );
          })()}

          {posts.length === 0 && !page1.loading ? (
            <EmptyState icon="reader-outline" title={t('gorkhapatra.empty')} />
          ) : (
            posts.map((post) => (
              <GorkhapatraCard
                key={post.id}
                post={post}
                onPress={() => openPost(post)}
                questionSetLabel={t('gorkhapatra.questionSet')}
                readLabel={t('gorkhapatra.read')}
              />
            ))
          )}

          {/* Pagination footer */}
          {posts.length > 0 ? (
            loadingMore ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.sm }} />
            ) : reachedEnd ? (
              <Text variant="caption" secondary style={styles.footerNote}>{t('gorkhapatra.noMore')}</Text>
            ) : (
              <Pressable
                onPress={() => void loadMore()}
                style={({ pressed }) => [
                  styles.loadMore,
                  { backgroundColor: colors.surfaceAlt, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text variant="bodySmall" weight="semiBold" style={{ color: colors.primary }}>{t('gorkhapatra.loadMore')}</Text>
                <Ionicons name="chevron-down" size={16} color={colors.primary} />
              </Pressable>
            )
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16 },
  introIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(124,58,237,0.14)', alignItems: 'center', justifyContent: 'center' },
  sourceNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  loadMore: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, marginTop: 4 },
  footerNote: { textAlign: 'center', marginTop: 6 },
});
