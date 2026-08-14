// §31 Discussion Feed
import React, { useEffect, useMemo, useState } from 'react';
import { View, FlatList, Pressable, Modal, ScrollView, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { useRefreshOnFocus } from '@/src/core/hooks/useRefreshOnFocus';
import { fetchDiscussions, toggleLikeDiscussion, type DiscussionPost } from '@/src/core/firebase/services/discussions';
import { fetchDiscussionGuidelines, seedDiscussionGuidelines, type DiscussionGuidelines } from '@/src/core/firebase/services/discussionGuidelines';
import { fetchUserProfile } from '@/src/core/firebase/services/profile';
import { showToast } from '@/src/core/store/toastStore';
import { Text } from '@/src/components/misc/Text';
import { DiscussionPostCard } from '@/src/components/cards/DiscussionPostCard';
import { FAB } from '@/src/components/buttons/FAB';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { Card } from '@/src/components/cards/Card';

export default function DiscussionFeedScreen() {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { data, loading, refreshing, error, refetch, refresh } = useAsyncData(() => fetchDiscussions(), []);
  const [likedIds, setLikedIds] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [guidelines, setGuidelines] = useState<DiscussionGuidelines | null>(null);
  const [guidelinesLoading, setGuidelinesLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useRefreshOnFocus(refresh);

  useEffect(() => {
    if (!user) return;
    fetchUserProfile(user.uid).then((profile) => setIsAdmin(profile?.isAdmin === true)).catch(() => undefined);
  }, [user]);

  useEffect(() => {
    let active = true;
    setGuidelinesLoading(true);
    fetchDiscussionGuidelines()
      .then((value) => { if (active) setGuidelines(value); })
      .catch(() => undefined)
      .finally(() => { if (active) setGuidelinesLoading(false); });
    return () => { active = false; };
  }, []);

  const filteredPosts = useMemo(() => {
    const posts = data ?? [];
    const normalized = query.trim().toLowerCase();
    if (!normalized) return posts;
    return posts.filter((post) => [post.title, post.body, post.category, post.authorName, post.courseName, post.subcourseName]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(normalized));
  }, [data, query]);

  const handleSeedGuidelines = async () => {
    try {
      await seedDiscussionGuidelines();
      const value = await fetchDiscussionGuidelines();
      setGuidelines(value);
      showToast(t('discussion.guidelinesSeeded'), 'success');
    } catch {
      showToast(t('common.somethingWentWrong'), 'error');
    }
  };

  const handleToggleLike = async (id: string) => {
    const nowLiked = !likedIds[id];
    setLikedIds((prev) => ({ ...prev, [id]: nowLiked }));
    try {
      await toggleLikeDiscussion(id, nowLiked);
    } catch {
      setLikedIds((prev) => ({ ...prev, [id]: !nowLiked }));
    }
  };

  const renderPost = ({ item }: { item: DiscussionPost }) => (
    <DiscussionPostCard
      authorName={item.authorName}
      authorPhoto={item.authorPhoto}
      timestamp={item.createdAt?.toDate().toLocaleDateString() ?? ''}
      title={item.title}
      preview={item.body}
      category={item.category}
      courseName={item.courseName}
      subcourseName={item.subcourseName}
      imageUrl={item.imageUrl}
      linkUrl={item.linkUrl}
      isAdmin={item.isAdmin}
      isSeed={item.isSeed}
      likeCount={item.likeCount + (likedIds[item.id] ? 1 : 0)}
      commentCount={item.commentCount}
      liked={!!likedIds[item.id]}
      onPress={() => router.push(`/discussion/${item.id}`)}
      onToggleLike={() => handleToggleLike(item.id)}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.screenPadding, paddingBottom: spacing.sm, gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text variant="display" weight="bold" style={{ flex: 1 }}>{t('discussion.title')}</Text>
          <Pressable onPress={() => setShowGuidelines(true)} accessibilityLabel={t('discussion.guidelines')} style={{ padding: spacing.xs }}>
            <Ionicons name="information-circle-outline" size={25} color={colors.primary} />
          </Pressable>
          <Pressable onPress={() => router.push('/(tabs)/profile')} accessibilityLabel={t('profile.title')} style={{ padding: spacing.xs }}>
            <Ionicons name="person-circle-outline" size={26} color={colors.textPrimary} />
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.sm, backgroundColor: colors.surface }}>
          <Ionicons name="search-outline" size={19} color={colors.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('discussion.searchPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            style={{ flex: 1, color: colors.textPrimary, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs }}
            returnKeyType="search"
          />
          {query ? <Pressable onPress={() => setQuery('')}><Ionicons name="close-circle" size={18} color={colors.textSecondary} /></Pressable> : null}
        </View>
      </View>

      <PageLoaderOverlay visible={loading || refreshing} label={t('discussion.loading')} />
      {loading ? null : error ? (
        <DataNotFound onRetry={refetch} />
      ) : filteredPosts.length === 0 ? (
        <EmptyState title={query ? t('discussion.noSearchResults') : t('discussion.empty')} ctaLabel={!query ? t('discussion.createFirst') : undefined} onCtaPress={!query ? () => router.push('/discussion/create') : undefined} />
      ) : (
        <FlatList
          data={filteredPosts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.screenPadding, gap: spacing.sm, paddingBottom: 96 }}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={refresh} />}
          renderItem={renderPost}
        />
      )}

      <Modal visible={showGuidelines} transparent animationType="slide" onRequestClose={() => setShowGuidelines(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000055' }}>
          <Card style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, maxHeight: '78%', padding: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
              <Text variant="h2" weight="bold" style={{ flex: 1 }}>{guidelines?.title ?? t('discussion.guidelines')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                {isAdmin ? <Pressable onPress={handleSeedGuidelines} accessibilityLabel={t('discussion.seedGuidelines')}><Ionicons name="cloud-upload-outline" size={21} color={colors.primary} /></Pressable> : null}
                <Pressable onPress={() => setShowGuidelines(false)}><Ionicons name="close" size={24} color={colors.textPrimary} /></Pressable>
              </View>
            </View>
            {guidelinesLoading ? <Text variant="body" secondary>{t('common.loading')}</Text> : (
              <ScrollView contentContainerStyle={{ gap: spacing.md }}>
                <Text variant="body" secondary>{guidelines?.body ?? t('discussion.guidelinesBody')}</Text>
                {(guidelines?.bullets ?? []).map((bullet, index) => (
                  <View key={`${bullet}-${index}`} style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    <Text variant="body" style={{ flex: 1 }}>{bullet}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </Card>
        </View>
      </Modal>

      {user ? <FAB icon="add" accessibilityLabel={t('discussion.createPost')} onPress={() => router.push('/discussion/create')} /> : null}
    </View>
  );
}
