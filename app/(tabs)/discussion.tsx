import React, { useEffect, useMemo, useState } from 'react';
import { View, FlatList, Pressable, Modal, ScrollView, StyleSheet, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { useProfileStore } from '@/src/core/store/profileStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { useRefreshOnFocus } from '@/src/core/hooks/useRefreshOnFocus';
import { fetchDiscussions, toggleLikeDiscussion, type DiscussionPost } from '@/src/core/firebase/services/discussions';
import { fetchDiscussionGuidelines, seedDiscussionGuidelines, type DiscussionGuidelines } from '@/src/core/firebase/services/discussionGuidelines';
import { fetchUserProfile } from '@/src/core/firebase/services/profile';
import { showToast } from '@/src/core/store/toastStore';
import { Text } from '@/src/components/misc/Text';
import { Avatar } from '@/src/components/misc/Avatar';
import { DiscussionPostCard } from '@/src/components/cards/DiscussionPostCard';
import { FAB } from '@/src/components/buttons/FAB';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { Card } from '@/src/components/cards/Card';

export default function DiscussionFeedScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const profile = useProfileStore((s) => s.profile);
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
    fetchUserProfile(user.uid).then((value) => setIsAdmin(value?.isAdmin === true)).catch(() => undefined);
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

  const displayName = profile?.name || user?.displayName || user?.email || 'User';
  const photoURL = profile?.photoURL || user?.photoURL || null;

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
      <LinearGradient
        colors={['#172554', '#1D4ED8', '#2563EB']}
        style={[styles.header, { paddingTop: insets.top + spacing.sm }]}
      >
        <View style={styles.headerTopRow}>
          <View style={styles.headerTitleRow}>
            <View style={styles.headerIconBox}>
              <Ionicons name="chatbubbles" size={19} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="h2" weight="bold" style={styles.headerTitle} numberOfLines={1}>{t('discussion.title')}</Text>
              <Text variant="caption" style={styles.headerSubtitle} numberOfLines={1}>{t('discussion.guidelines')}</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => setShowGuidelines(true)}
              accessibilityLabel={t('discussion.guidelines')}
              style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}
            >
              <Ionicons name="information-circle-outline" size={21} color="#FFF" />
            </Pressable>
            <Pressable
              onPress={() => router.push('/(tabs)/profile')}
              accessibilityLabel={t('profile.title')}
              style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}
            >
              <Avatar uri={photoURL} name={displayName} size={38} />
            </Pressable>
          </View>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={19} color="rgba(255,255,255,0.78)" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('discussion.searchPlaceholder')}
            placeholderTextColor="rgba(255,255,255,0.68)"
            style={styles.searchInput}
            returnKeyType="search"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} accessibilityLabel="Clear search" style={styles.clearSearch}>
              <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.78)" />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.headerBottomRow}>
          <View style={styles.feedLabel}>
            <Ionicons name="sparkles-outline" size={16} color="#BFDBFE" />
            <Text variant="bodySmall" weight="semiBold" style={styles.feedLabelText}>{t('discussion.title')}</Text>
          </View>
          <Pressable
            onPress={() => setShowGuidelines(true)}
            style={({ pressed }) => [styles.guidelinesButton, pressed && styles.pressed]}
          >
            <Ionicons name="book-outline" size={15} color="#DBEAFE" />
            <Text variant="caption" weight="semiBold" style={styles.guidelinesButtonText}>{t('discussion.guidelines')}</Text>
          </Pressable>
        </View>
      </LinearGradient>

      <PageLoaderOverlay visible={loading} label={t('discussion.loading')} />
      {error ? (
        <DataNotFound onRetry={refetch} />
      ) : filteredPosts.length === 0 && !loading ? (
        <EmptyState
          icon="chatbubbles-outline"
          title={query ? t('discussion.noSearchResults') : t('discussion.empty')}
          ctaLabel={!query ? t('discussion.createFirst') : undefined}
          onCtaPress={!query ? () => router.push('/discussion/create') : undefined}
        />
      ) : (
        <FlatList
          data={filteredPosts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: spacing.screenPadding, paddingTop: spacing.md, paddingBottom: 112, gap: spacing.md }}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={refresh} />}
          renderItem={renderPost}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.listIntro}>
              <Text variant="bodyLarge" weight="bold" style={{ color: colors.textPrimary }}>{t('discussion.title')}</Text>
              <Text variant="bodySmall" secondary>{query ? t('discussion.noSearchResults') : t('discussion.guidelines')}</Text>
            </View>
          }
        />
      )}

      <Modal visible={showGuidelines} transparent animationType="fade" onRequestClose={() => setShowGuidelines(false)}>
        <View style={styles.modalBackdrop}>
          <Card style={[styles.guidelinesSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View style={[styles.modalIcon, { backgroundColor: `${colors.primary}18` }]}>
                <Ionicons name="book" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="h2" weight="bold">{guidelines?.title ?? t('discussion.guidelines')}</Text>
                <Text variant="caption" secondary>{t('discussion.title')}</Text>
              </View>
              <View style={styles.modalActions}>
                {isAdmin ? (
                  <Pressable onPress={handleSeedGuidelines} accessibilityLabel={t('discussion.seedGuidelines')} style={styles.modalIconButton}>
                    <Ionicons name="cloud-upload-outline" size={20} color={colors.primary} />
                  </Pressable>
                ) : null}
                <Pressable onPress={() => setShowGuidelines(false)} accessibilityLabel="Close" style={styles.modalIconButton}>
                  <Ionicons name="close" size={22} color={colors.textPrimary} />
                </Pressable>
              </View>
            </View>
            {guidelinesLoading ? (
              <View style={styles.guidelinesLoading}>
                <Ionicons name="sync-outline" size={22} color={colors.primary} />
                <Text variant="body" secondary>{t('common.loading')}</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
                <Text variant="body" secondary style={{ lineHeight: 22 }}>{guidelines?.body ?? t('discussion.guidelinesBody')}</Text>
                {(guidelines?.bullets ?? []).map((bullet, index) => (
                  <View key={`${bullet}-${index}`} style={styles.guidelineRow}>
                    <View style={[styles.checkIcon, { backgroundColor: `${colors.primary}18` }]}>
                      <Ionicons name="checkmark" size={15} color={colors.primary} />
                    </View>
                    <Text variant="body" style={{ flex: 1, lineHeight: 21 }}>{bullet}</Text>
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

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 13,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  headerIconBox: { width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.17)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  headerTitle: { color: '#FFF', fontSize: 21 },
  headerSubtitle: { color: 'rgba(255,255,255,0.72)', marginTop: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerAction: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  avatarButton: { padding: 2, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.3)' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 15, paddingHorizontal: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  searchInput: { flex: 1, color: '#FFF', paddingVertical: 12, fontSize: 14 },
  clearSearch: { padding: 4 },
  headerBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  feedLabel: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  feedLabelText: { color: '#DBEAFE' },
  guidelinesButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)' },
  guidelinesButtonText: { color: '#DBEAFE' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  listIntro: { gap: 3, marginBottom: 2 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2,6,23,0.62)' },
  guidelinesSheet: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, maxHeight: '82%', paddingHorizontal: 18, paddingTop: 10, paddingBottom: 26, borderWidth: 1 },
  modalHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 4, backgroundColor: '#CBD5E1', marginBottom: 18 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 18 },
  modalIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  modalActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  modalIconButton: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  guidelinesLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 28 },
  guidelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkIcon: { width: 26, height: 26, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
});
