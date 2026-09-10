// §22 Gorkhapatra detail — a single post reconstructed natively from its blocks
// (headings, paragraphs, images). Deliberately NOT a webview/iframe. Includes an
// "open original" link back to Gorkhapatra for attribution, and tapping any image
// opens the shared full-screen viewer.
import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchGorkhapatraPost, type GorkhapatraPost } from '@/src/core/firebase/services/content';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { Text } from '@/src/components/misc/Text';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { GorkhapatraBlocks } from '@/src/components/gorkhapatra/GorkhapatraBlocks';
import { ImageViewer } from '@/src/components/media/ImageViewer';

const ACCENT = '#7C3AED';

function formatDate(value: GorkhapatraPost['publishedAt']): string {
  if (!value) return '';
  try {
    return value.toDate().toLocaleDateString('ne-NP', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export default function GorkhapatraDetailScreen() {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const { slug } = useLocalSearchParams<{ slug?: string | string[] }>();
  const id = Array.isArray(slug) ? slug[0] : slug;
  const post = useAsyncData(
    (isRefresh) => (id ? fetchGorkhapatraPost(id, { force: isRefresh }) : Promise.resolve(null)),
    [id],
  );

  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const item = post.data;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TopAppBar title={item?.title ?? t('gorkhapatra.title')} />
      <PageLoaderOverlay visible={post.loading} label={t('gorkhapatra.loading')} />

      {post.error ? (
        <DataNotFound onRetry={post.refetch} />
      ) : !item && !post.loading ? (
        <EmptyState icon="reader-outline" title={t('gorkhapatra.notFound')} />
      ) : item ? (
        <ScrollView
          contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: spacing.xxl * 2 }}
          showsVerticalScrollIndicator={false}
        >
          {item.coverImage ? (
            <Pressable onPress={() => setViewerUri(item.coverImage ?? null)}>
              <Image
                source={{ uri: item.coverImage }}
                style={[styles.hero, { borderRadius: radius.lg }]}
                contentFit="cover"
                cachePolicy="disk"
                transition={200}
              />
            </Pressable>
          ) : null}

          <View style={[styles.metaRow, { marginTop: item.coverImage ? spacing.md : 0 }]}>
            <View style={[styles.pill, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="calendar-outline" size={13} color={colors.textSecondary} />
              <Text variant="caption" secondary>{item.dateLabel || formatDate(item.publishedAt)}</Text>
            </View>
            {item.isQuestionSet ? (
              <View style={[styles.pill, { backgroundColor: 'rgba(124,58,237,0.12)' }]}>
                <Ionicons name="help-circle-outline" size={13} color={ACCENT} />
                <Text variant="caption" weight="semiBold" style={{ color: ACCENT }}>{t('gorkhapatra.questionSet')}</Text>
              </View>
            ) : null}
          </View>

          <Text variant="h2" weight="bold" style={styles.title}>{item.title}</Text>

          <View style={{ marginTop: spacing.lg }}>
            <GorkhapatraBlocks blocks={item.blocks ?? []} onImagePress={(url) => setViewerUri(url)} />
          </View>

          {/* Attribution + open-original link */}
          {item.sourceUrl ? (
            <Pressable
              onPress={() => void Linking.openURL(item.sourceUrl)}
              style={({ pressed }) => [styles.sourceRow, { backgroundColor: colors.surfaceAlt, opacity: pressed ? 0.85 : 1 }]}
            >
              <Ionicons name="open-outline" size={17} color={colors.primary} />
              <Text variant="caption" secondary style={{ flex: 1 }}>{t('gorkhapatra.sourceNote')}</Text>
              <Text variant="caption" weight="bold" style={{ color: colors.primary }}>{t('gorkhapatra.openSource')}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      ) : null}

      <ImageViewer visible={viewerUri !== null} uri={viewerUri ?? ''} onClose={() => setViewerUri(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', height: 200, backgroundColor: '#E5E7EB' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  title: { marginTop: 14, lineHeight: 32 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, marginTop: 22 },
});
