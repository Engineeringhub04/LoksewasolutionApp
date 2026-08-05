// §19 Topic Detail / Notes Viewer
import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchTopic } from '@/src/core/firebase/services/content';
import { showToast } from '@/src/core/store/toastStore';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { IconButton } from '@/src/components/buttons/IconButton';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';
import { ErrorState } from '@/src/components/feedback/ErrorState';
import { Skeleton } from '@/src/components/feedback/Skeleton';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';

export default function TopicDetailScreen() {
  const { id, chapterId, topicId } = useLocalSearchParams<{ id: string; chapterId: string; topicId: string }>();
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [bookmarked, setBookmarked] = useState(false);
  const [completed, setCompleted] = useState(false);

  const { data: topic, loading, error, refreshing, refetch, refresh } = useAsyncData(
    () => fetchTopic(id, chapterId, topicId),
    [id, chapterId, topicId]
  );

  const toggleBookmark = () => {
    setBookmarked((b) => !b);
    if (!bookmarked) showToast(t('subjects.addedToBookmarks'), 'success');
  };

  const markComplete = () => {
    setCompleted(true);
    showToast(t('subjects.markedComplete'), 'success');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TopAppBar
        title={topic?.title ?? ''}
        actions={
          <>
            <IconButton
              name={bookmarked ? 'bookmark' : 'bookmark-outline'}
              accessibilityLabel="Bookmark"
              color={bookmarked ? colors.primary : colors.textPrimary}
              onPress={toggleBookmark}
            />
            <IconButton name="share-outline" accessibilityLabel={t('common.share')} onPress={() => {}} />
          </>
        }
      />

      {loading ? (
        <View style={{ padding: spacing.screenPadding, gap: spacing.sm }}>
          <Skeleton height={20} width="60%" />
          <Skeleton height={16} /><Skeleton height={16} /><Skeleton height={16} width="80%" />
        </View>
      ) : error || !topic ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: spacing.xxl }}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={refresh} />}
        >
          <Text variant="body">{topic.body}</Text>
        </ScrollView>
      )}

      <View
        style={{
          flexDirection: 'row',
          padding: spacing.md,
          paddingBottom: insets.bottom + spacing.sm,
          gap: spacing.sm,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        <Button label={t('common.back')} variant="secondary" onPress={() => router.back()} style={{ flex: 1 }} />
        <Button
          label={completed ? t('subjects.completed') : t('subjects.markComplete')}
          onPress={markComplete}
          disabled={completed}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}
