import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, View, FlatList } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { useProfileStore } from '@/src/core/store/profileStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { ErrorState } from '@/src/components/feedback/ErrorState';
import { fetchDiscussion, fetchComments, fetchReplies, addComment, addReply, deleteComment, deleteReply, deleteDiscussion, toggleLikeDiscussion, isDiscussionLiked, isCommentLiked, toggleCommentLike, reportContent, type Reply, type Comment } from '@/src/core/firebase/services/discussions';
import { showToast } from '@/src/core/store/toastStore';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { ThemeToggleButton } from '@/src/components/misc/ThemeToggleButton';
import { Text } from '@/src/components/misc/Text';
import { CommentCard } from '@/src/components/cards/CommentCard';
import { DiscussionPostCard } from '@/src/components/cards/DiscussionPostCard';
import { TextField } from '@/src/components/inputs/TextField';
import { ConfirmDialog } from '@/src/components/feedback/ConfirmDialog';
import { DiscussionActionMenu, type DiscussionActionMenuItem } from '@/src/components/discussion/DiscussionActionMenu';
import { DiscussionReportModal, type DiscussionReportTarget } from '@/src/components/discussion/DiscussionReportModal';

type MenuTarget =
  | { kind: 'post' }
  | { kind: 'comment'; comment: Comment }
  | { kind: 'reply'; commentId: string; reply: Reply };

type ConfirmAction =
  | { kind: 'editPost' }
  | { kind: 'deletePost' }
  | { kind: 'deleteComment'; commentId: string }
  | { kind: 'deleteReply'; commentId: string; replyId: string }
  | { kind: 'report'; target: DiscussionReportTarget };

type LikeState = { liked: boolean; delta: number };

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
  const storeProfile = useProfileStore((s) => s.profile);
  const discussion = useAsyncData(() => fetchDiscussion(id), [id]);
  const comments = useAsyncData(() => fetchComments(id), [id]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<{ name?: string | null; photoURL?: string | null } | null>(null);
  const [commentText, setCommentText] = useState('');
  const [replyText, setReplyText] = useState('');
  const [liked, setLiked] = useState(false);
  const [posting, setPosting] = useState(false);
  const [replying, setReplying] = useState(false);
  const [repliesByComment, setRepliesByComment] = useState<Record<string, Reply[]>>({});
  const [openReplyId, setOpenReplyId] = useState<string | null>(null);
  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);
  const [menuAnchor, setMenuAnchor] = useState({ top: 0, right: 16 });
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [reportTarget, setReportTarget] = useState<DiscussionReportTarget | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [commentLikes, setCommentLikes] = useState<Record<string, LikeState>>({});
  const [replyLikes, setReplyLikes] = useState<Record<string, LikeState>>({});
  const [likesLoading, setLikesLoading] = useState(true);
  const [postLikeLoading, setPostLikeLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    setPostLikeLoading(true);
    setProfileLoading(Boolean(user));
    if (!user) {
      setCurrentProfile(null);
      setIsAdmin(false);
      setLiked(false);
      setPostLikeLoading(false);
      return;
    }
    // Use the shared profile store as the primary identity source — its user
    // document was already read at app start, so this avoids a duplicate read
    // every time the comment screen mounts or the post id changes.
    setCurrentProfile(storeProfile ? { name: storeProfile.name, photoURL: storeProfile.photoURL } : null);
    setIsAdmin(storeProfile?.isAdmin === true);
    setProfileLoading(false);
    isDiscussionLiked(id).then(setLiked).catch(() => undefined).finally(() => setPostLikeLoading(false));
  }, [id, user, storeProfile]);

  useEffect(() => {
    const currentComments = comments.data ?? [];
    let active = true;
    setLikesLoading(true);
    if (currentComments.length === 0) {
      setCommentLikes({});
      setLikesLoading(false);
      return () => { active = false; };
    }
    Promise.all(currentComments.map(async (comment) => [comment.id, await isCommentLiked(id, comment.id).catch(() => false)] as const))
      .then((entries) => {
        if (!active) return;
        setCommentLikes(Object.fromEntries(entries.map(([commentId, isLiked]) => [commentId, { liked: isLiked, delta: 0 }])));
      })
      .finally(() => {
        if (active) setLikesLoading(false);
      });
    return () => { active = false; };
  }, [comments.data, id]);

  const loadReplies = async (commentId: string) => {
    const nextReplies = await fetchReplies(id, commentId);
    setRepliesByComment((prev) => ({ ...prev, [commentId]: nextReplies }));
    const entries = await Promise.all(nextReplies.map(async (reply) => [reply.id, await isCommentLiked(id, commentId, reply.id).catch(() => false)] as const));
    setReplyLikes((prev) => ({
      ...prev,
      ...Object.fromEntries(entries.map(([replyId, isLiked]) => [`${commentId}:${replyId}`, { liked: isLiked, delta: 0 }])),
    }));
  };

  const handleTogglePostLike = async () => {
    const next = !liked;
    setLiked(next);
    try {
      await toggleLikeDiscussion(id, next);
    } catch {
      setLiked(!next);
    }
  };

  const handleToggleCommentLike = async (commentId: string, next: boolean, replyId?: string, baseLikeCount = 0) => {
    const key = replyId ? `${commentId}:${replyId}` : commentId;
    const setter = replyId ? setReplyLikes : setCommentLikes;
    setter((prev) => ({ ...prev, [key]: { liked: next, delta: (prev[key]?.delta ?? 0) + (next ? 1 : -1) } }));
    try {
      await toggleCommentLike(id, commentId, next, replyId);
      if (replyId) {
        const latestReplies = await fetchReplies(id, commentId);
        const latestReply = latestReplies.find((reply) => reply.id === replyId);
        if (latestReply) setter((prev) => ({ ...prev, [key]: { liked: next, delta: latestReply.likeCount - baseLikeCount } }));
      } else {
        const latestComments = await fetchComments(id);
        const latestComment = latestComments.find((comment) => comment.id === commentId);
        if (latestComment) setter((prev) => ({ ...prev, [key]: { liked: next, delta: latestComment.likeCount - baseLikeCount } }));
      }
    } catch {
      setter((prev) => ({ ...prev, [key]: { liked: !next, delta: (prev[key]?.delta ?? 0) + (next ? -1 : 1) } }));
    }
  };

  const handlePostComment = async () => {
    if (!user || !commentText.trim()) return;
    setPosting(true);
    try {
      // Store profile is the source of truth; `user.displayName/photoURL`
      // covers signed-out edge cases without an extra user-document read.
      const profile = storeProfile ?? { name: user.displayName || 'Anonymous', photoURL: user.photoURL ?? null };
      await addComment(id, { body: commentText.trim(), authorName: profile.name || 'Anonymous', authorPhoto: profile.photoURL ?? null, authorId: user.uid });
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
      const profile = storeProfile ?? { name: user.displayName || 'Anonymous', photoURL: user.photoURL ?? null };
      await addReply(id, commentId, { body: replyText.trim(), authorName: profile.name || 'Anonymous', authorPhoto: profile.photoURL ?? null, authorId: user.uid });
      setReplyText('');
      await loadReplies(commentId);
      showToast(t('discussion.replyPosted'), 'success');
    } catch {
      showToast(t('common.somethingWentWrong'), 'error');
    } finally {
      setReplying(false);
    }
  };

  const openReport = (target: DiscussionReportTarget) => {
    setReportTarget(target);
    setShowReportModal(true);
  };

  const handleReport = async (reason: string) => {
    if (!reportTarget) return;
    setReportSubmitting(true);
    try {
      await reportContent(reportTarget.type, reportTarget.id, reason, {
        title: discussion.data?.title,
        preview: reportTarget.preview ?? discussion.data?.body,
        authorName: reportTarget.authorName ?? discussion.data?.authorName,
        authorPhoto: reportTarget.authorPhoto ?? discussion.data?.authorPhoto,
      });
      setShowReportModal(false);
      setReportTarget(null);
      showToast(t('discussion.postReported'), 'success');
    } catch {
      showToast(t('common.somethingWentWrong'), 'error');
    } finally {
      setReportSubmitting(false);
    }
  };

  const performDeletePost = async () => {
    try {
      await deleteDiscussion(id);
      router.replace('/(tabs)/discussion');
    } catch {
      showToast(t('common.somethingWentWrong'), 'error');
    }
  };

  const performDeleteComment = async (commentId: string) => {
    try {
      await deleteComment(id, commentId);
      comments.refetch();
    } catch {
      showToast(t('common.somethingWentWrong'), 'error');
    }
  };

  const performDeleteReply = async (commentId: string, replyId: string) => {
    try {
      await deleteReply(id, commentId, replyId);
      await loadReplies(commentId);
    } catch {
      showToast(t('common.somethingWentWrong'), 'error');
    }
  };

  const confirmTitle = useMemo(() => {
    if (!confirmAction) return '';
    if (confirmAction.kind === 'editPost') return t('discussion.confirmEditTitle');
    if (confirmAction.kind === 'report') return t('discussion.confirmReportTitle');
    return confirmAction.kind === 'deletePost' ? t('discussion.deleteConfirm') : t('discussion.deleteCommentConfirm');
  }, [confirmAction, t]);

  const confirmMessage = useMemo(() => {
    if (!confirmAction) return '';
    if (confirmAction.kind === 'editPost') return t('discussion.confirmEditMessage');
    if (confirmAction.kind === 'report') return t('discussion.confirmReportMessage');
    return t('discussion.deleteConfirmMessage');
  }, [confirmAction, t]);

  const handleConfirmAction = () => {
    const action = confirmAction;
    setConfirmAction(null);
    if (!action) return;
    if (action.kind === 'editPost') {
      router.push({ pathname: '/discussion/create', params: { editId: id } });
    } else if (action.kind === 'deletePost') {
      void performDeletePost();
    } else if (action.kind === 'deleteComment') {
      void performDeleteComment(action.commentId);
    } else if (action.kind === 'deleteReply') {
      void performDeleteReply(action.commentId, action.replyId);
    } else {
      openReport(action.target);
    }
  };

  const handlePostMenu = (anchor: { top: number; right: number }) => {
    setMenuAnchor(anchor);
    setMenuTarget({ kind: 'post' });
  };

  const handleCommentMenu = (comment: Comment, anchor: { top: number; right: number }) => {
    setMenuAnchor(anchor);
    setMenuTarget({ kind: 'comment', comment });
  };

  const handleReplyMenu = (commentId: string, reply: Reply, anchor: { top: number; right: number }) => {
    setMenuAnchor(anchor);
    setMenuTarget({ kind: 'reply', commentId, reply });
  };

  const menuActions: DiscussionActionMenuItem[] = useMemo(() => {
    if (!menuTarget || !discussion.data) return [];
    if (menuTarget.kind === 'post') {
      const post = discussion.data;
      return user?.uid === post.authorId || isAdmin
        ? [
            { label: t('common.edit'), icon: 'create-outline', onPress: () => setConfirmAction({ kind: 'editPost' }) },
            { label: t('common.delete'), icon: 'trash-outline', destructive: true, onPress: () => setConfirmAction({ kind: 'deletePost' }) },
          ]
        : [{ label: t('discussion.reportPost'), icon: 'flag-outline', destructive: true, onPress: () => openReport({ type: 'post', id, authorName: post.authorName, authorPhoto: post.authorPhoto, preview: post.body }) }];
    }
    if (menuTarget.kind === 'comment') {
      const comment = menuTarget.comment;
      return user?.uid === comment.authorId || isAdmin
        ? [{ label: t('common.delete'), icon: 'trash-outline', destructive: true, onPress: () => setConfirmAction({ kind: 'deleteComment', commentId: comment.id }) }]
        : [{ label: t('discussion.reportComment'), icon: 'flag-outline', destructive: true, onPress: () => openReport({ type: 'comment', id: comment.id, authorName: comment.authorName, authorPhoto: comment.authorPhoto, preview: comment.body }) }];
    }
    const reply = menuTarget.reply;
    return user?.uid === reply.authorId || isAdmin
      ? [{ label: t('common.delete'), icon: 'trash-outline', destructive: true, onPress: () => setConfirmAction({ kind: 'deleteReply', commentId: menuTarget.commentId, replyId: reply.id }) }]
      : [{ label: t('discussion.reportComment'), icon: 'flag-outline', destructive: true, onPress: () => openReport({ type: 'comment', id: reply.id, authorName: reply.authorName, authorPhoto: reply.authorPhoto, preview: reply.body }) }];
  }, [discussion.data, id, isAdmin, menuTarget, t, user?.uid]);

  if (discussion.loading || comments.loading || likesLoading || postLikeLoading || profileLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <TopAppBar title={t('discussion.commentsTitle')} actions={<ThemeToggleButton isDark={effective === 'dark'} onToggle={() => setMode(effective === 'dark' ? 'light' : 'dark')} />} />
        <PageLoaderOverlay visible label={t('discussion.loadingComments')} />
      </View>
    );
  }
  if (discussion.error || !discussion.data) {
    return <View style={{ flex: 1, backgroundColor: colors.background }}><TopAppBar title={t('discussion.commentsTitle')} /><ErrorState onRetry={discussion.refetch} /></View>;
  }

  const post = discussion.data;
  const commentComposer = user ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, paddingBottom: insets.bottom + spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }}>
      <TextField value={commentText} onChangeText={setCommentText} placeholder={t('discussion.writeComment')} containerStyle={{ flex: 1 }} />
      <Pressable
        onPress={handlePostComment}
        disabled={posting || !commentText.trim()}
        accessibilityLabel={t('common.submit')}
        style={({ pressed }) => [{ width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, opacity: posting || !commentText.trim() ? 0.45 : 1 }, pressed && { transform: [{ scale: 0.92 }] }]}
      >
        {posting ? <ActivityIndicator size="small" color={colors.onPrimary} /> : <Text style={{ color: colors.onPrimary }}>➤</Text>}
      </Pressable>
    </View>
  ) : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TopAppBar title={t('discussion.commentsTitle')} actions={<ThemeToggleButton isDark={effective === 'dark'} onToggle={() => setMode(effective === 'dark' ? 'light' : 'dark')} />} />
      <FlatList
        data={comments.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: spacing.screenPadding, paddingTop: spacing.sm, paddingBottom: spacing.xxl }}
        refreshControl={<AppRefreshControl refreshing={discussion.refreshing || comments.refreshing} onRefresh={() => { discussion.refresh(); comments.refresh(); }} />}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.md }}>
            <DiscussionPostCard
              authorName={post.authorName}
              authorPhoto={post.authorPhoto}
              timestamp={formatTimestamp(post.createdAt, true)}
              title={post.title}
              preview={post.body}
              courseName={post.courseName}
              subcourseName={post.subcourseName}
              imageUrl={post.imageUrl}
              linkUrl={post.linkUrl}
              isAdmin={post.isAdmin}
              isSeed={post.isSeed}
              likeCount={post.likeCount}
              commentCount={comments.data?.length ?? 0}
              liked={liked}
              onPress={() => undefined}
              onToggleLike={handleTogglePostLike}
              onMenuPress={handlePostMenu}
            />
            <Text variant="bodyLarge" weight="bold" style={{ marginTop: spacing.lg }}>{t('discussion.comments')}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const commentLike = commentLikes[item.id] ?? { liked: false, delta: 0 };
          const replies = repliesByComment[item.id] ?? [];
          return (
            <View style={{ marginBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing.xs }}>
              <CommentCard
                authorName={item.authorName}
                authorPhoto={item.authorPhoto ?? (item.authorId === user?.uid ? currentProfile?.photoURL ?? user?.photoURL : null)}
                body={item.body}
                timestamp={formatTimestamp(item.createdAt)}
                likeCount={item.likeCount + commentLike.delta}
                liked={commentLike.liked}
                onToggleLike={() => handleToggleCommentLike(item.id, !commentLike.liked, undefined, item.likeCount)}
                onMenuPress={(anchor) => handleCommentMenu(item, anchor)}
              />
              <View style={{ flexDirection: 'row', gap: spacing.md, marginLeft: spacing.xl, marginBottom: spacing.xs }}>
                <Text variant="caption" style={{ color: colors.primary }} onPress={() => { if (openReplyId === item.id) setOpenReplyId(null); else { setOpenReplyId(item.id); void loadReplies(item.id); } }}>{openReplyId === item.id ? t('discussion.hideReplies') : t('discussion.viewReplies')}</Text>
                <Text variant="caption" style={{ color: colors.primary }} onPress={() => { setOpenReplyId(item.id); void loadReplies(item.id); }}>{t('discussion.reply')}</Text>
              </View>
              {openReplyId === item.id ? (
                <View style={{ marginLeft: spacing.lg, paddingLeft: spacing.sm, borderLeftWidth: 2, borderLeftColor: colors.border, gap: spacing.xs }}>
                  {replies.map((reply) => {
                    const replyKey = `${item.id}:${reply.id}`;
                    const replyLike = replyLikes[replyKey] ?? { liked: false, delta: 0 };
                    return (
                      <CommentCard
                        key={reply.id}
                        authorName={reply.authorName}
                        authorPhoto={reply.authorPhoto ?? (reply.authorId === user?.uid ? currentProfile?.photoURL ?? user?.photoURL : null)}
                        body={reply.body}
                        timestamp={formatTimestamp(reply.createdAt)}
                        likeCount={reply.likeCount + replyLike.delta}
                        liked={replyLike.liked}
                        indent
                        onToggleLike={() => handleToggleCommentLike(item.id, !replyLike.liked, reply.id, reply.likeCount)}
                        onMenuPress={(anchor) => handleReplyMenu(item.id, reply, anchor)}
                      />
                    );
                  })}
                  {user ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                      <TextField value={replyText} onChangeText={setReplyText} placeholder={t('discussion.writeReply')} containerStyle={{ flex: 1 }} />
                      <Pressable
                        onPress={() => handlePostReply(item.id)}
                        disabled={replying || !replyText.trim()}
                        accessibilityLabel={t('common.submit')}
                        style={{ width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, opacity: replying || !replyText.trim() ? 0.45 : 1 }}
                      >
                        {replying ? <ActivityIndicator size="small" color={colors.onPrimary} /> : <Text style={{ color: colors.onPrimary }}>➤</Text>}
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        }}
        ListEmptyComponent={<View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}><Text variant="body" secondary>{t('discussion.noComments')}</Text></View>}
      />
      {commentComposer}
      <DiscussionActionMenu visible={Boolean(menuTarget)} top={menuAnchor.top} right={menuAnchor.right} actions={menuActions} onClose={() => setMenuTarget(null)} />
      <ConfirmDialog
        visible={Boolean(confirmAction)}
        title={confirmTitle}
        message={confirmMessage}
        destructive={confirmAction?.kind === 'deletePost' || confirmAction?.kind === 'deleteComment' || confirmAction?.kind === 'deleteReply' || confirmAction?.kind === 'report'}
        confirmLabel={confirmAction?.kind === 'editPost' ? t('common.edit') : confirmAction?.kind === 'report' ? t('discussion.submitReport') : t('common.delete')}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmAction(null)}
      />
      <DiscussionReportModal
        visible={showReportModal}
        target={reportTarget}
        submitting={reportSubmitting}
        onClose={() => { setShowReportModal(false); setReportTarget(null); }}
        onSubmit={handleReport}
      />
    </KeyboardAvoidingView>
  );
}
