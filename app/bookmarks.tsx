// §34 Bookmarks
import React, { useState } from 'react';
import { View, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchBookmarks, removeBookmark, type BookmarkType } from '@/src/core/firebase/services/bookmarks';
import { showToast } from '@/src/core/store/toastStore';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { TabBar } from '@/src/components/nav/TabBar';
import { Text } from '@/src/components/misc/Text';
import { Card } from '@/src/components/cards/Card';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { ErrorState } from '@/src/components/feedback/ErrorState';
import { Skeleton } from '@/src/components/feedback/Skeleton';

export default function BookmarksScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<BookmarkType>('note');

  const { data, loading, error, refetch } = useAsyncData(async () => {
    if (!user) return [];
    return fetchBookmarks(user.uid);
  }, [user?.uid]);

  const filtered = (data ?? []).filter((b) => b.type === tab);

  const handleRemove = async (id: string) => {
    try {
      await removeBookmark(user!.uid, id);
      showToast(t('bookmarks.removed'), 'success');
      refetch();
    } catch {
      showToast(t('common.somethingWentWrong'), 'error');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TopAppBar title={t('bookmarks.title')} />
      <View style={{ paddingHorizontal: spacing.screenPadding }}>
        <TabBar
          items={[
            { key: 'note', label: t('bookmarks.notes') },
            { key: 'currentAffairs', label: t('bookmarks.currentAffairs') },
            { key: 'question', label: t('bookmarks.questions') },
            { key: 'discussion', label: t('bookmarks.discussions') },
          ]}
          active={tab}
          onChange={setTab}
        />
      </View>

      {loading ? (
        <View style={{ padding: spacing.screenPadding, gap: spacing.sm }}>
          <Skeleton height={56} /><Skeleton height={56} />
        </View>
      ) : error ? (
        <ErrorState onRetry={refetch} />
      ) : filtered.length === 0 ? (
        <EmptyState title={t('bookmarks.empty')} ctaLabel={t('bookmarks.browseSubjects')} onCtaPress={() => router.push('/subjects')} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.screenPadding, gap: spacing.sm }}
          renderItem={({ item }) => (
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Text variant="body" weight="medium" numberOfLines={1}>{item.title}</Text>
                  {item.preview ? <Text variant="bodySmall" secondary numberOfLines={2}>{item.preview}</Text> : null}
                </View>
                <Pressable onPress={() => handleRemove(item.id)} accessibilityLabel={t('bookmarks.removed')}>
                  <Ionicons name="close-circle-outline" size={22} color={colors.textSecondary} />
                </Pressable>
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}
