// §40 Edit Profile — first/last name, email (locked), date of birth, gender and
// a Cloudinary-hosted profile photo, all persisted to users/{uid}.
//
// Save is disabled until something actually changes, and backing out with
// unsaved changes asks for confirmation first (both the header back button and
// the Android hardware back button).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Pressable, ScrollView, StyleSheet, BackHandler } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { useNetworkStatus } from '@/src/core/hooks/useNetworkStatus';
import { useProfileStore } from '@/src/core/store/profileStore';
import { updateCurrentUserProfile } from '@/src/core/firebase/auth';
import { AvatarProgressRing, type UploadState } from '@/src/components/profile/AvatarProgressRing';
import {
  updateUserProfile,
  fullNameOf,
  isValidDob,
  maskDobInput,
  type Gender,
} from '@/src/core/firebase/services/profile';
import { uploadImageToCloudinary } from '@/src/core/media/cloudinary';
import { showToast } from '@/src/core/store/toastStore';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';
import { Avatar } from '@/src/components/misc/Avatar';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';
import { FloatingLabelField } from '@/src/components/inputs/FloatingLabelField';
import { BottomSheet } from '@/src/components/feedback/BottomSheet';
import { ConfirmDialog } from '@/src/components/feedback/ConfirmDialog';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';

const GENDERS: Gender[] = ['male', 'female', 'other'];

export default function EditProfileScreen() {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { isOffline } = useNetworkStatus();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [photoURL, setPhotoURL] = useState<string | null>(null);

  const [initial, setInitial] = useState({ firstName: '', lastName: '', dob: '', gender: null as Gender | null, photoURL: null as string | null });
  const [hydrated, setHydrated] = useState(false);

  const [saving, setSaving] = useState(false);
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [dobError, setDobError] = useState<string | null>(null);

  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadState, setUploadState] = useState<UploadState>('idle');

  // Reads the shared store, which the root layout warms in the background — so
  // this screen normally has real data on first paint. `load` still runs to
  // cover a cold open straight into this route.
  const { profile: storeProfile, loading: profileLoading, refreshing, load } = useProfileStore();

  useEffect(() => {
    if (user?.uid) void load(user.uid);
  }, [user?.uid, load]);

  const profile = { data: storeProfile, loading: profileLoading, refreshing, refresh: () => { if (user?.uid) void load(user.uid, { refresh: true }); } };

  // Seed the form once from whichever source has data (Firestore doc first,
  // then the auth session for brand-new Google sign-ins).
  useEffect(() => {
    if (hydrated || profile.loading) return;
    const data = profile.data;
    const sessionName = user?.displayName ?? '';
    const sessionParts = sessionName.trim().split(/\s+/).filter(Boolean);

    const seeded = {
      firstName: data?.firstName || sessionParts[0] || '',
      lastName: data?.lastName || sessionParts.slice(1).join(' ') || '',
      dob: data?.dob ?? '',
      gender: data?.gender ?? null,
      photoURL: data?.photoURL ?? user?.photoURL ?? null,
    };
    setFirstName(seeded.firstName);
    setLastName(seeded.lastName);
    setDob(seeded.dob);
    setGender(seeded.gender);
    setPhotoURL(seeded.photoURL);
    setInitial(seeded);
    setHydrated(true);
  }, [profile.loading, profile.data, user?.displayName, user?.photoURL, hydrated]);

  const isDirty = useMemo(
    () =>
      firstName !== initial.firstName ||
      lastName !== initial.lastName ||
      dob !== initial.dob ||
      gender !== initial.gender ||
      photoURL !== initial.photoURL,
    [firstName, lastName, dob, gender, photoURL, initial]
  );

  const attemptLeave = useCallback(() => {
    if (isDirty) {
      setShowDiscardConfirm(true);
      return true;
    }
    router.back();
    return true;
  }, [isDirty, router]);

  // Android hardware back needs the same guard as the header button, otherwise
  // edits are silently lost.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!isDirty) return false;
      setShowDiscardConfirm(true);
      return true;
    });
    return () => sub.remove();
  }, [isDirty]);

  const pickImage = async (source: 'camera' | 'gallery') => {
    setShowPhotoSheet(false);
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast(t('editProfile.permissionDenied'), 'warning');
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });

    if (!result.canceled && result.assets[0]) setPhotoURL(result.assets[0].uri);
  };

  const handleDobChange = (raw: string) => {
    const masked = maskDobInput(raw);
    setDob(masked);
    if (masked.length === 10 && !isValidDob(masked)) setDobError(t('editProfile.dobInvalid'));
    else setDobError(null);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!firstName.trim()) {
      showToast(t('editProfile.firstNameRequired'), 'warning');
      return;
    }
    if (dob && !isValidDob(dob)) {
      setDobError(t('editProfile.dobInvalid'));
      return;
    }

    setSaving(true);
    try {
      // Only a freshly picked local file needs uploading; an existing https URL
      // (Cloudinary or a Google avatar) is already hosted.
      let resolvedPhotoURL = photoURL;
      if (photoURL && !/^https?:\/\//i.test(photoURL)) {
        setUploadState('uploading');
        setUploadProgress(0);
        resolvedPhotoURL = await uploadImageToCloudinary(photoURL, setUploadProgress);
        setUploadState('done');
        showToast(t('editProfile.photoUploaded'), 'success');
      }

      await updateUserProfile(user.uid, {
        firstName,
        lastName,
        dob: dob ? dob : null,
        gender,
        photoURL: resolvedPhotoURL,
      });

      // Keep the cached auth session in sync so the Home/Profile headers update
      // immediately without needing a re-login.
      await updateCurrentUserProfile({
        displayName: fullNameOf(firstName, lastName),
        photoURL: resolvedPhotoURL,
      }).catch(() => {});

      setInitial({ firstName, lastName, dob, gender, photoURL: resolvedPhotoURL });
      setPhotoURL(resolvedPhotoURL);

      // Push the saved values into the shared store so Home and Profile update
      // immediately — no pull-to-refresh required anywhere.
      useProfileStore.getState().applyLocalPatch({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        name: fullNameOf(firstName, lastName),
        dob: dob ? dob : null,
        gender,
        photoURL: resolvedPhotoURL,
      });

      showToast(t('editProfile.updated'), 'success');
      router.back();
    } catch {
      setUploadState('idle');
      showToast(t('editProfile.saveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SubpageHeader title={t('editProfile.title')} onBackPress={attemptLeave} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: spacing.xxl, gap: spacing.md }}
        refreshControl={<AppRefreshControl refreshing={profile.refreshing} onRefresh={profile.refresh} />}
        keyboardShouldPersistTaps="handled"
      >
        {/* Photo */}
        <Animated.View entering={FadeInDown.duration(320)} style={styles.photoBlock}>
          <Pressable onPress={() => setShowPhotoSheet(true)} style={styles.photoPressable}>
            {/* Ring turns blue while uploading and green on completion. */}
            <AvatarProgressRing size={96} progress={uploadProgress} state={uploadState}>
              <Avatar uri={photoURL} name={fullNameOf(firstName, lastName)} size={96} />
            </AvatarProgressRing>
            <View style={[styles.cameraBadge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
              <Ionicons name="camera" size={16} color="#FFF" />
            </View>
          </Pressable>
          <Text variant="bodySmall" weight="semiBold" style={{ color: colors.primary, marginTop: spacing.sm }}>
            {t('editProfile.changePhoto')}
          </Text>
        </Animated.View>

        {/* Name */}
        <Animated.View entering={FadeInDown.duration(320).delay(60)} style={{ gap: spacing.md }}>
          <FloatingLabelField
            label={t('editProfile.firstName')}
            value={firstName}
            onChangeText={setFirstName}
            leftIcon="person-outline"
            autoCapitalize="words"
          />
          <FloatingLabelField
            label={t('editProfile.lastName')}
            value={lastName}
            onChangeText={setLastName}
            leftIcon="person-outline"
            autoCapitalize="words"
          />
        </Animated.View>

        {/* Email — displayed, never editable */}
        <Animated.View entering={FadeInDown.duration(320).delay(120)}>
          <View
            style={[
              styles.lockedField,
              { borderColor: colors.border, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingHorizontal: spacing.md },
            ]}
          >
            <Ionicons name="mail-outline" size={20} color={colors.textSecondary} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="caption" secondary>{t('editProfile.emailAddress')}</Text>
              <Text variant="bodyLarge" weight="semiBold" numberOfLines={1}>{user?.email ?? ''}</Text>
            </View>
            <View style={[styles.comingSoonTag, { backgroundColor: `${colors.warning}22`, borderRadius: radius.pill }]}>
              <Text variant="caption" weight="bold" style={{ color: colors.warning }}>
                {t('editProfile.editComingSoon')}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Date of birth */}
        <Animated.View entering={FadeInDown.duration(320).delay(180)}>
          <FloatingLabelField
            label={t('editProfile.dateOfBirth')}
            value={dob}
            onChangeText={handleDobChange}
            leftIcon="calendar-outline"
            keyboardType="number-pad"
            maxLength={10}
            errorText={dobError ?? undefined}
          />
          <Text variant="caption" secondary style={{ marginTop: spacing.xs, marginLeft: spacing.xs }}>
            {t('editProfile.dobHint')}
          </Text>
        </Animated.View>

        {/* Gender */}
        <Animated.View entering={FadeInDown.duration(320).delay(240)} style={{ gap: spacing.sm }}>
          <Text variant="bodySmall" weight="semiBold" secondary style={{ marginLeft: spacing.xs }}>
            {t('editProfile.gender')}
          </Text>
          <View style={styles.genderRow}>
            {GENDERS.map((option) => {
              const selected = gender === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => setGender(option)}
                  style={({ pressed }) => [
                    styles.genderPill,
                    {
                      borderRadius: radius.md,
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? `${colors.primary}17` : colors.surface,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Ionicons
                    name={option === 'male' ? 'male' : option === 'female' ? 'female' : 'transgender'}
                    size={16}
                    color={selected ? colors.primary : colors.textSecondary}
                  />
                  <Text
                    variant="bodySmall"
                    weight={selected ? 'bold' : 'regular'}
                    style={{ color: selected ? colors.primary : colors.textPrimary }}
                  >
                    {t(`profile.gender_${option}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        {isOffline ? (
          <Text variant="bodySmall" style={{ color: colors.warning }}>{t('editProfile.offlineBlocked')}</Text>
        ) : null}
      </ScrollView>

      {/* Save — pinned, and inert until something actually changed */}
      <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.divider, padding: spacing.screenPadding }]}>
        <Button
          label={t('editProfile.saveChanges')}
          onPress={handleSave}
          loading={saving}
          disabled={!isDirty || isOffline || saving}
        />
      </View>

      {/* Centred loader on first open, matching every other page. */}
      <PageLoaderOverlay
        visible={profile.loading && !hydrated}
        label={t('editProfile.loadingProfile')}
      />
      <PageLoaderOverlay
        visible={saving}
        label={uploadState === 'uploading' ? t('editProfile.uploadingPhoto') : t('editProfile.saving')}
      />

      <BottomSheet visible={showPhotoSheet} onClose={() => setShowPhotoSheet(false)}>
        <View style={{ gap: spacing.sm }}>
          <Button label={t('editProfile.camera')} variant="secondary" onPress={() => pickImage('camera')} />
          <Button label={t('editProfile.gallery')} variant="secondary" onPress={() => pickImage('gallery')} />
          {photoURL ? (
            <Button
              label={t('editProfile.remove')}
              variant="text"
              onPress={() => {
                setPhotoURL(null);
                setShowPhotoSheet(false);
              }}
            />
          ) : null}
        </View>
      </BottomSheet>

      <ConfirmDialog
        visible={showDiscardConfirm}
        title={t('editProfile.discardTitle')}
        message={t('editProfile.discardMessage')}
        confirmLabel={t('editProfile.discardConfirm')}
        cancelLabel={t('editProfile.keepEditing')}
        destructive
        onConfirm={() => {
          setShowDiscardConfirm(false);
          router.back();
        }}
        onCancel={() => setShowDiscardConfirm(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  photoBlock: { alignItems: 'center', marginBottom: 4 },
  photoPressable: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    minHeight: 58,
    paddingVertical: 8,
  },
  comingSoonTag: { paddingHorizontal: 8, paddingVertical: 4 },
  genderRow: { flexDirection: 'row', gap: 8 },
  genderPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  footer: { borderTopWidth: StyleSheet.hairlineWidth },
});
