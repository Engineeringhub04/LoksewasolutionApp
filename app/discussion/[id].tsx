// §32 Discussion Detail / Comments
import React, { useState } from 'react';
import { View, FlatList, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import {
  fetchDiscussion,
  fetchComments,
  addComment,
  deleteComment,
  deleteDiscussion,
  toggleLikeDiscussion,
  reportContent,
} from '@/src/core/firebase/services/discussions';
import { showToast } from '@/src/core/store/toastStore';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { IconButton } from '@/src/components/buttons/IconButton';
import { Text } from '@/src/components/misc/Text';
import { Avatar } from '@/src/components/misc/Avatar';
import { CommentCard } from '@/src/components/cards/CommentCard';
import { TextField } from '@/src/components/inputs/TextField';
import { ConfirmDialog } from '@/src/components/feedback/ConfirmDialog';
import { BottomSheet } from '@/src/components/feedback/BottomSheet';
import { Button } from '@/src/components/buttons/Button';
import { ErrorState } from '@/src/components/feedback/ErrorState';
import { Skeleton } from '@/src/components/feedback/Skeleton';

export default function DiscussionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  const discussion = useAsyncData(() => fetchDiscussion(id), [id]);
  const comments = useAsyncData(() => fetchComments(id), [id]);

  const [commentText, setCommentText] = useState('');
  const [liked, setLiked] = useState(false);
  const [posting, setPosting] = useState(false);
  const [showReportSheet, setShowReportSheet] = useState(false);
  const [showDeletePostConfirm, setShowDeletePostConfirm] = useState(false);
  const [deleteCommentId, setDeleteCommentId] = useState<string | null>(null);

  const handleToggleLike = async () => {
    const next = !liked;
    setLiked(next);
    try {
      await toggleLikeDiscussion(id, next);
    } catch {
      setLiked(!next);
    }
  };

  const handlePostComment = async () => {
    if (!user || !commentText.trim()) return;
    setPosting(true);
    try {
      await addComment(id, {
        body: commentText.trim(),
        authorName: user.displayName ?? 'Anonymous',
        authorPhoto: user.photoURL,
        authorId: user.uid,
      });
      setCommentText('');
      showToast(t('discussion.commentPosted'), 'success');
      comments.refetch();
    } catch {
      showToast(t('common.somethingWentWrong'), 'error');
    } finally {
      setPosting(false);
    }
  };

  const handleReport = async () => {
    setShowReportSheet(false);
    try {
      await reportContent('post', id, 'user-reported');
      showToast(t('discussion.postReported'), 'success');
    } catch {
      showToast(t('common.somethingWentWrong'), 'error');
    }
  };

  const handleDeletePost = async () => {
    setShowDeletePostConfirm(false);
    try {
      await deleteDiscussion(id);
      router.replace('/(tabs)/discussion');
    } catch {
      showToast(t('common.somethingWentWrong'), 'error');
    }
  };

  const handleDeleteComment = async () => {
    if (!deleteCommentId) return;
    try {
      await deleteComment(id, deleteCommentId);
      comments.refetch();
    } catch {
      showToast(t('common.somethingWentWrong'), 'error');
    } finally {
      setDeleteCommentId(null);
    }
  };

  if (discussion.loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <TopAppBar title="" />
        <View style={{ padding: spacing.screenPadding, gap: spacing.sm }}>
          <Skeleton height={20} width="60%" /><Skeleton height={80} />
        </View>
      </View>
    );
  }

  if (discussion.error || !discussion.data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <TopAppBar title="" />
        <ErrorState onRetry={discussion.refetch} />
      </View>
    );
  }

  const post = discussion.data;
  const isOwnPost = user?.uid === post.authorId;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TopAppBar
        title={t('discussion.title')}
        actions={
          <IconButton
            name="ellipsis-horizontal"
            accessibilityLabel="More options"
            onPress={() => (isOwnPost ? setShowDeletePostConfirm(true) : setShowReportSheet(true))}
          />
        }
      />
      <FlatList
        data={comments.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: spacing.xxl }}
        ListHeaderComponent={
          <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Avatar uri={post.authorPhoto} name={post.authorName} />
              <View>
                <Text variant="body" weight="semiBold">{post.authorName}</Text>
                <Text variant="caption" secondary>{post.createdAt?.toDate().toLocaleString() ?? ''}</Text>
              </View>
            </View>
            <Text variant="h3" weight="semiBold">{post.title}</Text>
            <Text variant="body">{post.body}</Text>
            <View style={{ flexDirection: 'row', gap: spacing.lg, paddingTop: spacing.sm }}>
              <Pressable onPress={handleToggleLike} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name={liked ? 'heart' : 'heart-outline'} size={20} color={liked ? colors.error : colors.textSecondary} />
                <Text variant="bodySmall" secondary>{post.likeCount + (liked ? 1 : 0)}</Text>
              </Pressable>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="chatbubble-outline" size={18} color={colors.textSecondary} />
                <Text variant="bodySmall" secondary>{comments.data?.length ?? 0}</Text>
              </View>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onLongPress={() => user?.uid === item.authorId && setDeleteCommentId(item.id)}>
            <CommentCard
              authorName={item.authorName}
              authorPhoto={item.authorPhoto}
              body={item.body}
              timestamp={item.createdAt?.toDate().toLocaleDateString() ?? ''}
            />
          </Pressable>
        )}
      />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          padding: spacing.md,
          paddingBottom: insets.bottom + spacing.sm,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        <TextField
          value={commentText}
          onChangeText={setCommentText}
          placeholder={t('discussion.writeComment')}
          containerStyle={{ flex: 1 }}
        />
        <IconButton name="send" accessibilityLabel={t('common.submit')} onPress={handlePostComment} disabled={posting || !commentText.trim()} />
      </View>

      <BottomSheet visible={showReportSheet} onClose={() => setShowReportSheet(false)}>
        <Text variant="h3" weight="semiBold" style={{ marginBottom: spacing.md }}>{t('discussion.reportReasonTitle')}</Text>
        <Button label={t('common.confirm')} onPress={handleReport} />
      </BottomSheet>

      <ConfirmDialog
        visible={showDeletePostConfirm}
        title={t('discussion.deleteConfirm')}
        destructive
        onConfirm={handleDeletePost}
        onCancel={() => setShowDeletePostConfirm(false)}
      />

      <ConfirmDialog
        visible={!!deleteCommentId}
        title={t('discussion.deleteCommentConfirm')}
        destructive
        onConfirm={handleDeleteComment}
        onCancel={() => setDeleteCommentId(null)}
      />
    </KeyboardAvoidingView>
  );
}
