// §33 Create Discussion
import React, { useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { useNetworkStatus } from '@/src/core/hooks/useNetworkStatus';
import { createDiscussion } from '@/src/core/firebase/services/discussions';
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
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { isOffline } = useNetworkStatus();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const hasUnsavedContent = title.trim().length > 0 || body.trim().length > 0;

  const handleBack = () => {
    if (hasUnsavedContent) setShowDiscardConfirm(true);
    else router.back();
  };

  const handlePost = async () => {
    if (!user || !title.trim() || !body.trim()) return;
    setPosting(true);
    try {
      await createDiscussion({
        title: title.trim(),
        body: body.trim(),
        category: category ?? undefined,
        authorName: user.displayName ?? 'Anonymous',
        authorPhoto: user.photoURL,
        authorId: user.uid,
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
      <TopAppBar title={t('discussion.createPost')} onBackPress={handleBack} />

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
        <TextField
          label={t('discussion.postBody')}
          value={body}
          onChangeText={setBody}
          multiline
          numberOfLines={6}
          style={{ minHeight: 120, textAlignVertical: 'top' }}
        />
        <Button label={t('discussion.post')} onPress={handlePost} loading={posting} disabled={isOffline || !title.trim() || !body.trim()} />
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
