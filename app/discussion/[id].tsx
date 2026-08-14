// §32 Discussion Detail / Comments
import React, { useEffect, useState } from 'react';
import { View, FlatList, KeyboardAvoidingView, Platform, Pressable, Image, Linking, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';
import {
  fetchDiscussion,
  fetchComments,
  fetchReplies,
  addComment,
  addReply,
  deleteComment,
  deleteDiscussion,
  toggleLikeDiscussion,
  isDiscussionLiked,
  reportContent,
  type Reply,
} from '@/src/core/firebase/services/discussions';
import { fetchUserProfile } from '@/src/core/firebase/services/profile';
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
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  const discussion = useAsyncData(() => fetchDiscussion(id), [id]);
  const comments = useAsyncData(() => fetchComments(id), [id]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [liked, setLiked] = useState(false);
  const [posting, setPosting] = useState(false);
  const [showReportSheet, setShowReportSheet] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: 'post' | 'comment'; id: string; authorName?: string | null; authorPhoto?: string | null; preview?: string | null } | null>(null);
  const [showDeletePostConfirm, setShowDeletePostConfirm] = useState(false);
  const [deleteCommentId, setDeleteCommentId] = useState<string | null>(null);
  const [openReplyId, setOpenReplyId] = useState<string | null>(null);
  const [repliesByComment, setRepliesByComment] = useState<Record<string, Reply[]>>({});
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchUserProfile(user.uid).then((profile) => setIsAdmin(profile?.isAdmin === true)).catch(() => undefined);
    isDiscussionLiked(id).then(setLiked).catch(() => undefined);
  }, [id, user]);

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

  const handlePostReply = async (commentId: string) => {
    if (!user || !replyText.trim()) return;
    setReplying(true);
    try {
      await addReply(id, commentId, {
        body: replyText.trim(),
        authorName: user.displayName ?? 'Anonymous',
        authorPhoto: user.photoURL,
        authorId: user.uid,
      });
      setReplyText('');
      const next = await fetchReplies(id, commentId);
      setRepliesByComment((prev) => ({ ...prev, [commentId]: next }));
    } catch {
      showToast(t('common.somethingWentWrong'), 'error');
    } finally {
      setReplying(false);
    }
  };

  const handleReport = async () => {
    if (!reportTarget) return;
    setShowReportSheet(false);
    try {
      await reportContent(reportTarget.type, reportTarget.id, 'user-reported', {
        title: discussion.data?.title,
        preview: reportTarget.preview ?? discussion.data?.body,
        authorName: reportTarget.authorName ?? discussion.data?.authorName,
        authorPhoto: reportTarget.authorPhoto ?? discussion.data?.authorPhoto,
      });
      showToast(t('discussion.postReported'), 'success');
    } catch {
      showToast(t('common.somethingWentWrong'), 'error');
    } finally {
      setReportTarget(null);
    }
  };

  const openReport = (target: typeof reportTarget) => {
    setReportTarget(target);
    setShowReportSheet(true);
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

  const toggleReplies = async (commentId: string) => {
    if (openReplyId === commentId) {
      setOpenReplyId(null);
      return;
    }
    setOpenReplyId(commentId);
    if (!repliesByComment[commentId]) {
      try {
        const replies = await fetchReplies(id, commentId);
        setRepliesByComment((prev) => ({ ...prev, [commentId]: replies }));
      } catch {
        showToast(t('common.somethingWentWrong'), 'error');
      }
    }
  };

  if (discussion.loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <TopAppBar title={t('discussion.loading')} />
        <View style={{ padding: spacing.screenPadding, gap: spacing.sm }}><Skeleton height={20} width="60%" /><Skeleton height={80} /></View>
      </View>
    );
  }

  if (discussion.error || !discussion.data) {
    return <View style={{ flex: 1, backgroundColor: colors.background }}><TopAppBar title="" /><ErrorState onRetry={discussion.refetch} /></View>;
  }

  const post = discussion.data;
  const isOwnPost = user?.uid === post.authorId;
  const canEditPost = isOwnPost || isAdmin;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TopAppBar
        title={t('discussion.title')}
        actions={
          <IconButton
            name="ellipsis-horizontal"
            accessibilityLabel={t('discussion.moreOptions')}
            onPress={() => {
              if (!canEditPost) {
                openReport({ type: 'post', id, authorName: post.authorName, authorPhoto: post.authorPhoto, preview: post.body });
                return;
              }
              Alert.alert(t('discussion.moreOptions'), undefined, [
                { text: t('common.edit'), onPress: () => router.push({ pathname: '/discussion/create', params: { editId: id } }) },
                { text: t('common.delete'), style: 'destructive', onPress: () => setShowDeletePostConfirm(true) },
                { text: t('common.cancel'), style: 'cancel' },
              ]);
            }}
          />
        }
      />
      <FlatList
        data={comments.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: spacing.xxl }}
        refreshControl={<AppRefreshControl refreshing={discussion.refreshing || comments.refreshing} onRefresh={() => { discussion.refresh(); comments.refresh(); }} />}
        ListHeaderComponent={
          <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Avatar uri={post.authorPhoto} name={post.authorName} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <Text variant="body" weight="semiBold">{post.authorName}</Text>
                  {post.isAdmin ? <Text variant="caption" style={{ color: colors.primary }}>{t('discussion.adminTag')}</Text> : null}
                </View>
                <Text variant="caption" secondary>{post.createdAt?.toDate().toLocaleString() ?? ''}</Text>
                {post.courseName || post.subcourseName ? <Text variant="caption" secondary>{[post.courseName, post.subcourseName].filter(Boolean).join(' · ')}</Text> : null}
              </View>
            </View>
            <Text variant="h3" weight="semiBold">{post.title}</Text>
            <Text variant="body">{post.body}</Text>
            {post.imageUrl ? <Image source={{ uri: post.imageUrl }} style={{ width: '100%', height: 220, borderRadius: radius.md }} resizeMode="cover" /> : null}
            {post.linkUrl ? <Pressable onPress={() => Linking.openURL(post.linkUrl!).catch(() => undefined)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}><Ionicons name="link-outline" size={18} color={colors.primary} /><Text variant="bodySmall" style={{ color: colors.primary, flex: 1 }}>{post.linkUrl}</Text></Pressable> : null}
            <View style={{ flexDirection: 'row', gap: spacing.lg, paddingTop: spacing.sm }}>
              <Pressable onPress={handleToggleLike} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Ionicons name={liked ? 'heart' : 'heart-outline'} size={20} color={liked ? colors.error : colors.textSecondary} /><Text variant="bodySmall" secondary>{post.likeCount + (liked ? 1 : 0)}</Text></Pressable>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Ionicons name="chatbubble-outline" size={18} color={colors.textSecondary} /><Text variant="bodySmall" secondary>{comments.data?.length ?? 0}</Text></View>
            </View>
            <Text variant="bodySmall" secondary>{t('discussion.comments')}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const replies = repliesByComment[item.id] ?? [];
          const ownComment = user?.uid === item.authorId;
          return (
            <View style={{ marginBottom: spacing.sm }}>
              <Pressable onLongPress={() => ownComment || isAdmin ? setDeleteCommentId(item.id) : openReport({ type: 'comment', id: item.id, authorName: item.authorName, authorPhoto: item.authorPhoto, preview: item.body })}>
                <CommentCard authorName={item.authorName} authorPhoto={item.authorPhoto} body={item.body} timestamp={item.createdAt?.toDate().toLocaleDateString() ?? ''} />
              </Pressable>
              <View style={{ flexDirection: 'row', gap: spacing.md, marginLeft: spacing.xl, marginTop: spacing.xs }}>
                <Pressable onPress={() => toggleReplies(item.id)}><Text variant="caption" style={{ color: colors.primary }}>{openReplyId === item.id ? t('discussion.hideReplies') : t('discussion.viewReplies')}</Text></Pressable>
                <Pressable onPress={() => { setOpenReplyId(item.id); }}><Text variant="caption" style={{ color: colors.primary }}>{t('discussion.reply')}</Text></Pressable>
              </View>
              {openReplyId === item.id ? (
                <View style={{ marginLeft: spacing.xl, marginTop: spacing.sm, gap: spacing.sm }}>
                  {replies.map((reply) => <CommentCard key={reply.id} authorName={reply.authorName} authorPhoto={reply.authorPhoto} body={reply.body} timestamp={reply.createdAt?.toDate().toLocaleDateString() ?? ''} />)}
                  {user ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}><TextField value={replyText} onChangeText={setReplyText} placeholder={t('discussion.writeReply')} containerStyle={{ flex: 1 }} /><IconButton name="send" accessibilityLabel={t('common.submit')} onPress={() => handlePostReply(item.id)} disabled={replying || !replyText.trim()} /></View> : null}
                </View>
              ) : null}
            </View>
          );
        }}
      />

      {user ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, paddingBottom: insets.bottom + spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }}><TextField value={commentText} onChangeText={setCommentText} placeholder={t('discussion.writeComment')} containerStyle={{ flex: 1 }} /><IconButton name="send" accessibilityLabel={t('common.submit')} onPress={handlePostComment} disabled={posting || !commentText.trim()} /></View> : null}

      <BottomSheet visible={showReportSheet} onClose={() => { setShowReportSheet(false); setReportTarget(null); }}><Text variant="h3" weight="semiBold" style={{ marginBottom: spacing.md }}>{t('discussion.reportReasonTitle')}</Text><Button label={t('common.confirm')} onPress={handleReport} /></BottomSheet>
      <ConfirmDialog visible={showDeletePostConfirm} title={t('discussion.deleteConfirm')} destructive onConfirm={handleDeletePost} onCancel={() => setShowDeletePostConfirm(false)} />
      <ConfirmDialog visible={!!deleteCommentId} title={t('discussion.deleteCommentConfirm')} destructive onConfirm={handleDeleteComment} onCancel={() => setDeleteCommentId(null)} />
    </KeyboardAvoidingView>
  );
}
