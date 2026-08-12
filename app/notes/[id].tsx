// §35 Keep Notes — editor (title, body, color picker, save/delete).
import React, { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';
import { loadNotes, saveNote, deleteNote } from '@/src/core/firebase/services/notes';
import { showToast } from '@/src/core/store/toastStore';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { IconButton } from '@/src/components/buttons/IconButton';
import { TextField } from '@/src/components/inputs/TextField';
import { Button } from '@/src/components/buttons/Button';
import { ConfirmDialog } from '@/src/components/feedback/ConfirmDialog';

const colorOptions = ['#FFFFFF', '#FEF3C7', '#DBEAFE', '#DCFCE7', '#FCE7F3', '#EDE9FE'];

export default function NoteEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const { data: notes, refreshing, refresh } = useAsyncData(() => loadNotes(), []);
  const existing = notes?.find((n) => n.id === id);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const [color, setColor] = useState(existing?.color ?? colorOptions[0]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  React.useEffect(() => {
    if (existing) {
      setTitle(existing.title);
      setBody(existing.body);
      setColor(existing.color);
    }
  }, [existing]);

  const handleSave = async () => {
    const noteId = isNew ? Crypto.randomUUID() : id;
    await saveNote({ id: noteId, title: title.trim(), body: body.trim(), color });
    showToast(t('keepNotes.saved'), 'success');
    router.back();
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    await deleteNote(id);
    showToast(t('keepNotes.deleted'), 'success');
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: color }}>
      <TopAppBar
        title=""
        actions={
          !isNew ? <IconButton name="trash-outline" accessibilityLabel={t('common.delete')} onPress={() => setShowDeleteConfirm(true)} /> : undefined
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: spacing.screenPadding, gap: spacing.md, flexGrow: 1 }}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <TextField
          value={title}
          onChangeText={setTitle}
          placeholder={t('keepNotes.titlePlaceholder')}
          style={{ fontSize: 20, fontWeight: '700' }}
        />
        <TextField
          value={body}
          onChangeText={setBody}
          placeholder={t('keepNotes.bodyPlaceholder')}
          multiline
          style={{ flex: 1, minHeight: 200, textAlignVertical: 'top' }}
        />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {colorOptions.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              style={{
                width: 32,
                height: 32,
                borderRadius: radius.pill,
                backgroundColor: c,
                borderWidth: color === c ? 2 : 1,
                borderColor: color === c ? colors.primary : colors.border,
              }}
            />
          ))}
        </View>
      </ScrollView>
      <View style={{ padding: spacing.screenPadding }}>
        <Button label={t('common.save')} onPress={handleSave} />
      </View>

      <ConfirmDialog
        visible={showDeleteConfirm}
        title={t('keepNotes.deleteConfirm')}
        destructive
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </View>
  );
}
