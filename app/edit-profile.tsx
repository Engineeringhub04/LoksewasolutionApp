// §40 Edit Profile
import React, { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { useNetworkStatus } from '@/src/core/hooks/useNetworkStatus';
import { updateCurrentUserProfile } from '@/src/core/firebase/auth';
import { showToast } from '@/src/core/store/toastStore';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { Avatar } from '@/src/components/misc/Avatar';
import { TextField } from '@/src/components/inputs/TextField';
import { Button } from '@/src/components/buttons/Button';
import { Text } from '@/src/components/misc/Text';
import { BottomSheet } from '@/src/components/feedback/BottomSheet';

export default function EditProfileScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { isOffline } = useNetworkStatus();

  const [name, setName] = useState(user?.displayName ?? '');
  const [phone, setPhone] = useState('');
  const [photoURL, setPhotoURL] = useState(user?.photoURL ?? null);
  const [saving, setSaving] = useState(false);
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);

  const pickImage = async (source: 'camera' | 'gallery') => {
    setShowPhotoSheet(false);
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });

    if (!result.canceled && result.assets[0]) {
      setPhotoURL(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await updateCurrentUserProfile({ displayName: name.trim(), photoURL });
      showToast(t('editProfile.updated'), 'success');
      router.back();
    } catch {
      showToast(t('common.somethingWentWrong'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TopAppBar title={t('editProfile.title')} />
      <ScrollView contentContainerStyle={{ padding: spacing.screenPadding, gap: spacing.md, alignItems: 'center' }}>
        <Pressable onPress={() => setShowPhotoSheet(true)} style={{ alignItems: 'center', gap: spacing.xs }}>
          <Avatar uri={photoURL} name={name} size={96} />
          <Text variant="bodySmall" style={{ color: colors.primary }}>{t('editProfile.changePhoto')}</Text>
        </Pressable>

        <View style={{ width: '100%', gap: spacing.md }}>
          <TextField label={t('auth.name')} value={name} onChangeText={setName} />
          <TextField label={t('auth.email')} value={user?.email ?? ''} editable={false} />
          <TextField label={t('editProfile.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        </View>

        {isOffline ? <Text variant="bodySmall" style={{ color: colors.warning }}>{t('editProfile.offlineBlocked')}</Text> : null}

        <Button label={t('editProfile.saveChanges')} onPress={handleSave} loading={saving} disabled={isOffline} />
      </ScrollView>

      <BottomSheet visible={showPhotoSheet} onClose={() => setShowPhotoSheet(false)}>
        <View style={{ gap: spacing.sm }}>
          <Button label={t('editProfile.camera')} variant="secondary" onPress={() => pickImage('camera')} />
          <Button label={t('editProfile.gallery')} variant="secondary" onPress={() => pickImage('gallery')} />
          {photoURL ? <Button label={t('editProfile.remove')} variant="text" onPress={() => { setPhotoURL(null); setShowPhotoSheet(false); }} /> : null}
        </View>
      </BottomSheet>
    </View>
  );
}
