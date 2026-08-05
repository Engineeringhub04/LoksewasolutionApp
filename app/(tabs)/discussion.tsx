// §31 Discussion Feed
import React, { useState } from 'react';
import { View, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/core/theme';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchDiscussions, toggleLikeDiscussion } from '@/src/core/firebase/services/discussions';
import { Text } from '@/src/components/misc/Text';
import { DiscussionPostCard } from '@/src/components/cards/DiscussionPostCard';
import { FAB } from '@/src/components/buttons/FAB';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';

export default function DiscussionFeedScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { data, loading, refreshing, error, refetch, refresh } = useAsyncData(() => fetchDiscussions(), []);
  const [likedIds, setLikedIds] = useState<Record<string, boolean>>({});

  const handleToggleLike = async (id: string) => {
    const nowLiked = !likedIds[id];
    setLikedIds((prev) => ({ ...prev, [id]: nowLiked }));
    try {
      await toggleLikeDiscussion(id, nowLiked);
    } catch {
      setLikedIds((prev) => ({ ...prev, [id]: !nowLiked }));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.screenPadding, paddingBottom: spacing.sm }}>
        <Text variant="display" weight="bold">{t('discussion.title')}</Text>
      </View>

      <PageLoaderOverlay visible={loading || refreshing} label="Loading Discussions..." />
      {loading ? null : error ? (
        <DataNotFound onRetry={refetch} />
      ) : !data || data.length === 0 ? (
        <EmptyState title={t('discussion.empty')} ctaLabel={t('discussion.createFirst')} onCtaPress={() => router.push('/discussion/create')} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.screenPadding, gap: spacing.sm, paddingBottom: 96 }}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={refresh} />}
          renderItem={({ item }) => (
            <DiscussionPostCard
              authorName={item.authorName}
              authorPhoto={item.authorPhoto}
              timestamp={item.createdAt?.toDate().toLocaleDateString() ?? ''}
              title={item.title}
              preview={item.body}
              category={item.category}
              likeCount={item.likeCount + (likedIds[item.id] ? 1 : 0)}
              commentCount={item.commentCount}
              liked={!!likedIds[item.id]}
              onPress={() => router.push(`/discussion/${item.id}`)}
              onToggleLike={() => handleToggleLike(item.id)}
            />
          )}
        />
      )}

      {user ? <FAB icon="add" accessibilityLabel={t('discussion.createPost')} onPress={() => router.push('/discussion/create')} /> : null}
    </View>
  );
}
