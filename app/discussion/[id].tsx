import React, { useEffect, useState } from 'react';
import { View, FlatList, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';
import { fetchDiscussion, fetchComments, fetchReplies, addComment, addReply, deleteComment, deleteReply, deleteDiscussion, toggleLikeDiscussion, isDiscussionLiked, reportContent, type Reply } from '@/src/core/firebase/services/discussions';
import { fetchUserProfile } from '@/src/core/firebase/services/profile';
import { showToast } from '@/src/core/store/toastStore';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { IconButton } from '@/src/components/buttons/IconButton';
import { Text } from '@/src/components/misc/Text';
import { CommentCard } from '@/src/components/cards/CommentCard';
import { DiscussionPostCard } from '@/src/components/cards/DiscussionPostCard';
import { TextField } from '@/src/components/inputs/TextField';
import { ConfirmDialog } from '@/src/components/feedback/ConfirmDialog';
import { BottomSheet } from '@/src/components/feedback/BottomSheet';
import { Button } from '@/src/components/buttons/Button';
import { ErrorState } from '@/src/components/feedback/ErrorState';
import { Skeleton } from '@/src/components/feedback/Skeleton';

function formatTimestamp(value: { toDate?: () => Date } | null | undefined, withTime = false): string {
  if (!value?.toDate) return '';
  return value.toDate().toLocaleString(undefined, withTime ? undefined : { dateStyle: 'medium' });
}

export default function DiscussionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, effective, setMode } = useTheme();
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
  const [deleteReplyTarget, setDeleteReplyTarget] = useState<{ commentId: string; replyId: string } | null>(null);
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
      await addComment(id, { body: commentText.trim(), authorName: user.displayName ?? 'Anonymous', authorPhoto: user.photoURL, authorId: user.uid });
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
      await addReply(id, commentId, { body: replyText.trim(), authorName: user.displayName ?? 'Anonymous', authorPhoto: user.photoURL, authorId: user.uid });
      setReplyText('');
      const nextReplies = await fetchReplies(id, commentId);
      setRepliesByComment((prev) => ({ ...prev, [commentId]: nextReplies }));
      showToast(t('discussion.replyPosted'), 'success');
    } catch {
      showToast(t('common.somethingWentWrong'), 'error');
    } finally {
      setReplying(false);
    }
  };

  const openReport = (target: typeof reportTarget) => {
    setReportTarget(target);
    setShowReportSheet(true);
  };

  const handleReport = async () => {
    if (!reportTarget) return;
    setShowReportSheet(false);
    try {
      await reportContent(reportTarget.type, reportTarget.id, 'user-reported', { title: discussion.data?.title, preview: reportTarget.preview ?? discussion.data?.body, authorName: reportTarget.authorName ?? discussion.data?.authorName, authorPhoto: reportTarget.authorPhoto ?? discussion.data?.authorPhoto });
      showToast(t('discussion.postReported'), 'success');
    } catch {
      showToast(t('common.somethingWentWrong'), 'error');
    } finally {
      setReportTarget(null);
    }
  };

  const handlePostMenu = () => {
    if (!discussion.data) return;
    const post = discussion.data;
    const isOwner = user?.uid === post.authorId;
    if (isOwner || isAdmin) {
      Alert.alert(t('discussion.postMenu'), undefined, [
        { text: t('common.edit'), onPress: () => router.push({ pathname: '/discussion/create', params: { editId: id } }) },
        { text: t('common.delete'), style: 'destructive', onPress: () => setShowDeletePostConfirm(true) },
        { text: t('common.cancel'), style: 'cancel' },
      ]);
    } else {
      openReport({ type: 'post', id, authorName: post.authorName, authorPhoto: post.authorPhoto, preview: post.body });
    }
  };

  const handleCommentMenu = (comment: { id: string; authorId?: string; authorName: string; authorPhoto?: string | null; body: string }) => {
    const canManage = user?.uid === comment.authorId || isAdmin;
    if (canManage) {
      Alert.alert(t('discussion.commentOptions'), undefined, [
        { text: t('common.delete'), style: 'destructive', onPress: () => setDeleteCommentId(comment.id) },
        { text: t('common.cancel'), style: 'cancel' },
      ]);
    } else {
      openReport({ type: 'comment', id: comment.id, authorName: comment.authorName, authorPhoto: comment.authorPhoto, preview: comment.body });
    }
  };

  const handleReplyMenu = (commentId: string, reply: Reply) => {
    const canManage = user?.uid === reply.authorId || isAdmin;
    if (canManage) {
      Alert.alert(t('discussion.commentOptions'), undefined, [
        { text: t('common.delete'), style: 'destructive', onPress: () => setDeleteReplyTarget({ commentId, replyId: reply.id }) },
        { text: t('common.cancel'), style: 'cancel' },
      ]);
    } else {
      openReport({ type: 'comment', id: reply.id, authorName: reply.authorName, authorPhoto: reply.authorPhoto, preview: reply.body });
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

  const handleDeleteReply = async () => {
    if (!deleteReplyTarget) return;
    try {
      await deleteReply(id, deleteReplyTarget.commentId, deleteReplyTarget.replyId);
      const next = await fetchReplies(id, deleteReplyTarget.commentId);
      setRepliesByComment((prev) => ({ ...prev, [deleteReplyTarget.commentId]: next }));
    } catch {
      showToast(t('common.somethingWentWrong'), 'error');
    } finally {
      setDeleteReplyTarget(null);
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
        const nextReplies = await fetchReplies(id, commentId);
        setRepliesByComment((prev) => ({ ...prev, [commentId]: nextReplies }));
      } catch {
        showToast(t('common.somethingWentWrong'), 'error');
      }
    }
  };

  if (discussion.loading) {
    return <View style={{ flex: 1, backgroundColor: colors.background }}><TopAppBar title={t('discussion.commentsTitle')} /><View style={{ padding: spacing.screenPadding, gap: spacing.sm }}><Skeleton height={170} /><Skeleton height={72} /><Skeleton height={72} /></View></View>;
  }
  if (discussion.error || !discussion.data) {
    return <View style={{ flex: 1, backgroundColor: colors.background }}><TopAppBar title={t('discussion.commentsTitle')} /><ErrorState onRetry={discussion.refetch} /></View>;
  }

  const post = discussion.data;
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TopAppBar title={t('discussion.commentsTitle')} actions={<IconButton name={effective === 'dark' ? 'sunny-outline' : 'moon-outline'} accessibilityLabel={t('discussion.toggleTheme')} onPress={() => setMode(effective === 'dark' ? 'light' : 'dark')} />} />
      <FlatList
        data={comments.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: spacing.screenPadding, paddingTop: spacing.sm, paddingBottom: spacing.xxl }}
        refreshControl={<AppRefreshControl refreshing={discussion.refreshing || comments.refreshing} onRefresh={() => { discussion.refresh(); comments.refresh(); }} />}
        ListHeaderComponent={<View style={{ marginBottom: spacing.md }}><DiscussionPostCard authorName={post.authorName} authorPhoto={post.authorPhoto} timestamp={formatTimestamp(post.createdAt, true)} title={post.title} preview={post.body} courseName={post.courseName} subcourseName={post.subcourseName} imageUrl={post.imageUrl} linkUrl={post.linkUrl} isAdmin={post.isAdmin} isSeed={post.isSeed} likeCount={post.likeCount} commentCount={comments.data?.length ?? 0} liked={liked} onPress={() => undefined} onToggleLike={handleToggleLike} onMenuPress={handlePostMenu} /><Text variant="bodyLarge" weight="bold" style={{ marginTop: spacing.lg }}>{t('discussion.comments')}</Text></View>}
        renderItem={({ item }) => {
          const replies = repliesByComment[item.id] ?? [];
          return (
            <View style={{ marginBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing.xs }}>
              <CommentCard authorName={item.authorName} authorPhoto={item.authorPhoto} body={item.body} timestamp={formatTimestamp(item.createdAt)} onMenuPress={() => handleCommentMenu(item)} />
              <View style={{ flexDirection: 'row', gap: spacing.md, marginLeft: spacing.xl, marginBottom: spacing.xs }}>
                <Text variant="caption" style={{ color: colors.primary }} onPress={() => toggleReplies(item.id)}>{openReplyId === item.id ? t('discussion.hideReplies') : t('discussion.viewReplies')}</Text>
                <Text variant="caption" style={{ color: colors.primary }} onPress={() => { setOpenReplyId(item.id); }}>{t('discussion.reply')}</Text>
              </View>
              {openReplyId === item.id ? (
                <View style={{ marginLeft: spacing.lg, paddingLeft: spacing.sm, borderLeftWidth: 2, borderLeftColor: colors.border, gap: spacing.xs }}>
                  {replies.map((reply) => <CommentCard key={reply.id} authorName={reply.authorName} authorPhoto={reply.authorPhoto} body={reply.body} timestamp={formatTimestamp(reply.createdAt)} indent onMenuPress={() => handleReplyMenu(item.id, reply)} />)}
                  {user ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}><TextField value={replyText} onChangeText={setReplyText} placeholder={t('discussion.writeReply')} containerStyle={{ flex: 1 }} /><IconButton name={replying ? 'hourglass-outline' : 'send'} accessibilityLabel={t('common.submit')} onPress={() => handlePostReply(item.id)} disabled={replying || !replyText.trim()} /></View> : null}
                </View>
              ) : null}
            </View>
          );
        }}
        ListEmptyComponent={<View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}><Text variant="body" secondary>{t('discussion.noComments')}</Text></View>}
      />
      {user ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, paddingBottom: insets.bottom + spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }}><TextField value={commentText} onChangeText={setCommentText} placeholder={t('discussion.writeComment')} containerStyle={{ flex: 1 }} /><IconButton name={posting ? 'hourglass-outline' : 'send'} accessibilityLabel={t('common.submit')} onPress={handlePostComment} disabled={posting || !commentText.trim()} /></View> : null}
      <BottomSheet visible={showReportSheet} onClose={() => { setShowReportSheet(false); setReportTarget(null); }}><Text variant="h3" weight="semiBold" style={{ marginBottom: spacing.md }}>{t('discussion.reportReasonTitle')}</Text><Button label={t('common.confirm')} onPress={handleReport} /></BottomSheet>
      <ConfirmDialog visible={showDeletePostConfirm} title={t('discussion.deleteConfirm')} destructive onConfirm={handleDeletePost} onCancel={() => setShowDeletePostConfirm(false)} />
      <ConfirmDialog visible={!!deleteCommentId} title={t('discussion.deleteCommentConfirm')} destructive onConfirm={handleDeleteComment} onCancel={() => setDeleteCommentId(null)} />
      <ConfirmDialog visible={!!deleteReplyTarget} title={t('discussion.deleteCommentConfirm')} destructive onConfirm={handleDeleteReply} onCancel={() => setDeleteReplyTarget(null)} />
    </KeyboardAvoidingView>
  );
}
