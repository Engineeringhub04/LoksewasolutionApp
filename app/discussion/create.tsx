// §33 Create Discussion
import React, { useEffect, useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { useNetworkStatus } from '@/src/core/hooks/useNetworkStatus';
import { createDiscussion, fetchDiscussion, updateDiscussion } from '@/src/core/firebase/services/discussions';
import { fetchUserProfile } from '@/src/core/firebase/services/profile';
import { showToast } from '@/src/core/store/toastStore';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { TextField } from '@/src/components/inputs/TextField';
import { Dropdown } from '@/src/components/inputs/Dropdown';
import { Button } from '@/src/components/buttons/Button';
import { ConfirmDialog } from '@/src/components/feedback/ConfirmDialog';
import { Text } from '@/src/components/misc/Text';

const categories = [
  { value: 'tips', label: 'Tips' },
  { value: 'resources', label: 'Resources' },
  { value: 'general', label: 'General' },
  { value: 'question', label: 'Question' },
];

export default function CreateDiscussionScreen() {
  const router = useRouter();
  const { editId: rawEditId } = useLocalSearchParams<{ editId?: string }>();
  const editId = typeof rawEditId === 'string' ? rawEditId : undefined;
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { isOffline } = useNetworkStatus();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [posting, setPosting] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchUserProfile(user.uid).then((profile) => setIsAdmin(profile?.isAdmin === true)).catch(() => undefined);
  }, [user]);

  useEffect(() => {
    if (!editId) return;
    fetchDiscussion(editId).then((post) => {
      if (!post) return;
      setTitle(post.title);
      setBody(post.body);
      setCategory(post.category ?? null);
      setImageUrl(post.imageUrl ?? '');
      setLinkUrl(post.linkUrl ?? '');
    }).catch(() => undefined);
  }, [editId]);

  const hasUnsavedContent = title.trim().length > 0 || body.trim().length > 0 || imageUrl.trim().length > 0 || linkUrl.trim().length > 0;

  const handleBack = () => {
    if (hasUnsavedContent) setShowDiscardConfirm(true);
    else router.back();
  };

  const handlePost = async () => {
    if (!user || !title.trim() || !body.trim()) return;
    setPosting(true);
    try {
      if (editId) {
        await updateDiscussion(editId, {
          title: title.trim(),
          body: body.trim(),
          category: category ?? undefined,
          imageUrl: isAdmin && imageUrl.trim() ? imageUrl.trim() : null,
          linkUrl: isAdmin && linkUrl.trim() ? linkUrl.trim() : null,
        });
        router.replace(`/discussion/${editId}`);
        return;
      }
      await createDiscussion({
        title: title.trim(),
        body: body.trim(),
        category: category ?? undefined,
        authorName: user.displayName ?? 'Anonymous',
        authorPhoto: user.photoURL,
        authorId: user.uid,
        imageUrl: isAdmin && imageUrl.trim() ? imageUrl.trim() : null,
        linkUrl: isAdmin && linkUrl.trim() ? linkUrl.trim() : null,
        isAdmin,
      });
      router.replace('/(tabs)/discussion');
    } catch {
      showToast(t('common.somethingWentWrong'), 'error');
    } finally {
      setPosting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TopAppBar title={editId ? t('common.edit') : t('discussion.createPost')} onBackPress={handleBack} />

      {isOffline ? (
        <View style={{ padding: spacing.md }}>
          <Text variant="body" style={{ color: colors.warning }}>{t('discussion.offlineBlocked')}</Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={{ padding: spacing.screenPadding, gap: spacing.md }} keyboardShouldPersistTaps="handled">
        <TextField label={t('discussion.postTitle')} value={title} onChangeText={setTitle} />
        <View>
          <Text variant="bodySmall" weight="medium" secondary style={{ marginBottom: spacing.xs }}>{t('discussion.category')}</Text>
          <Dropdown options={categories} value={category} onChange={setCategory} />
        </View>
        {isAdmin ? (
          <View style={{ gap: spacing.sm, padding: spacing.md, borderRadius: spacing.sm, backgroundColor: colors.surfaceAlt }}>
            <Text variant="bodySmall" weight="semiBold">{t('discussion.adminPostTools')}</Text>
            <TextField label={`${t('discussion.imageUrl')} (${t('discussion.optional')})`} value={imageUrl} onChangeText={setImageUrl} autoCapitalize="none" keyboardType="url" />
            <TextField label={`${t('discussion.linkUrl')} (${t('discussion.optional')})`} value={linkUrl} onChangeText={setLinkUrl} autoCapitalize="none" keyboardType="url" />
          </View>
        ) : null}
        <TextField
          label={t('discussion.postBody')}
          value={body}
          onChangeText={setBody}
          multiline
          numberOfLines={6}
          style={{ minHeight: 120, textAlignVertical: 'top' }}
        />
        <Button label={editId ? t('common.save') : t('discussion.post')} onPress={handlePost} loading={posting} disabled={isOffline || !title.trim() || !body.trim()} />
      </ScrollView>

      <ConfirmDialog
        visible={showDiscardConfirm}
        title={t('discussion.discardTitle')}
        message={t('discussion.discardMessage')}
        destructive
        onConfirm={() => {
          setShowDiscardConfirm(false);
          router.back();
        }}
        onCancel={() => setShowDiscardConfirm(false)}
      />
    </KeyboardAvoidingView>
  );
}
