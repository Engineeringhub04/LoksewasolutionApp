// §39 Profile — collapsing header + Account / App Settings / Support sections.
//
// Everything shown here is backed by the users/{uid} Firestore document (via
// services/profile.ts), not just the cached auth session, so the values survive
// reinstalls and match across devices.
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { logout } from '@/src/core/firebase/auth';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchUserProfile, ensureUserStats, formatDob, EMPTY_STATS } from '@/src/core/firebase/services/profile';
import { fetchUserCourseInfo } from '@/src/core/firebase/services/courses';
import { showToast } from '@/src/core/store/toastStore';
import { ProfileHeader, getProfileHeaderExpandedHeight } from '@/src/components/profile/ProfileHeader';
import { SectionHeading, SectionCard, InfoRow, MenuRow, StatsStrip } from '@/src/components/profile/ProfileRows';
import { Button } from '@/src/components/buttons/Button';
import { ConfirmDialog } from '@/src/components/feedback/ConfirmDialog';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';

export default function ProfileScreen() {
  const { colors, spacing } = useTheme();
  const { t, language, setLanguage } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const HEADER_MAX_HEIGHT = getProfileHeaderExpandedHeight(insets.top);

  const profile = useAsyncData(async () => {
    if (!user) return null;
    // Backfills the stats map for accounts created before it existed, so the
    // strip below always has something real to read.
    await ensureUserStats(user.uid).catch(() => {});
    return fetchUserProfile(user.uid);
  }, [user?.uid]);

  const courseInfo = useAsyncData(async () => {
    if (!user) return null;
    return fetchUserCourseInfo(user.uid);
  }, [user?.uid]);

  const refreshing = profile.refreshing || courseInfo.refreshing;
  const loading = profile.loading || courseInfo.loading;
  const onRefresh = () => {
    profile.refresh();
    courseInfo.refresh();
  };

  // Prefer the Firestore document, fall back to the auth session (which is
  // where a Google sign-in's Gmail name/photo lands first).
  const displayName = profile.data?.name || user?.displayName || '';
  const photoURL = profile.data?.photoURL || user?.photoURL || null;
  const email = profile.data?.email || user?.email || null;
  const stats = profile.data?.stats ?? EMPTY_STATS;

  const genderLabel = useMemo(() => {
    const gender = profile.data?.gender;
    if (!gender) return null;
    return t(`profile.gender_${gender}`);
  }, [profile.data?.gender, t]);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    await logout();
    router.replace('/(auth)/login');
  };

  const toggleLanguage = () => {
    const next = language === 'en' ? 'ne' : 'en';
    setLanguage(next);
    showToast(t('settings.languageChanged', { language: next === 'en' ? 'English' : 'नेपाली' }), 'success');
  };

  const goToEdit = () => router.push('/edit-profile');

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ProfileHeader
        scrollY={scrollY}
        displayName={displayName}
        photoURL={photoURL}
        subcourseName={courseInfo.data?.subcourseName ?? null}
        languageLabel={language === 'en' ? 'ENGLISH' : 'नेपाली'}
        languageShortLabel={language === 'en' ? 'EN' : 'ने'}
        onToggleLanguage={toggleLanguage}
        onEditPress={goToEdit}
      />

      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: HEADER_MAX_HEIGHT + spacing.md,
          paddingHorizontal: spacing.screenPadding,
          paddingBottom: spacing.xxl,
          gap: spacing.lg,
        }}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <StatsStrip testsTaken={stats.testsTaken} streak={stats.streak} points={stats.points} />

        {/* ===== Account ===== */}
        <View>
          <SectionHeading icon="person-outline" title={t('profile.account')} />
          <SectionCard>
            <InfoRow
              icon="person"
              label={t('profile.fullName')}
              value={displayName || null}
              addLabel={t('profile.addFullName')}
              onAddPress={goToEdit}
            />
            <InfoRow
              icon="mail"
              label={t('profile.email')}
              value={email}
              addLabel={t('profile.email')}
              onAddPress={goToEdit}
            />
            <InfoRow
              icon="calendar"
              label={t('profile.dateOfBirth')}
              value={formatDob(profile.data?.dob ?? null)}
              addLabel={t('profile.addDob')}
              onAddPress={goToEdit}
            />
            <InfoRow
              icon="male-female"
              label={t('profile.gender')}
              value={genderLabel}
              addLabel={t('profile.addGender')}
              onAddPress={goToEdit}
            />
          </SectionCard>
        </View>

        {/* ===== App Settings ===== */}
        <View>
          <SectionHeading icon="options-outline" title={t('profile.appSettings')} />
          <SectionCard>
            <MenuRow
              icon="school-outline"
              label={t('profile.courseDetails')}
              trailingText={courseInfo.data?.courseName ?? null}
              onPress={() => router.push('/course-details')}
            />
            <MenuRow icon="help-circle-outline" label={t('profile.reportQuestion')} onPress={() => router.push('/report-question')} />
            <MenuRow icon="bookmark-outline" label={t('profile.bookmarks')} onPress={() => router.push('/bookmarks')} />
            <MenuRow icon="shield-checkmark-outline" label={t('profile.privacyPolicy')} onPress={() => router.push('/privacy-policy')} />
            <MenuRow icon="analytics-outline" label={t('profile.analytics')} onPress={() => router.push('/analytics')} />
            <MenuRow icon="trash-outline" label={t('profile.deleteAccount')} destructive onPress={() => router.push('/delete-account')} />
          </SectionCard>
        </View>

        {/* ===== Support ===== */}
        <View>
          <SectionHeading icon="help-buoy-outline" title={t('profile.support')} />
          <SectionCard>
            <MenuRow icon="chatbubbles-outline" label={t('profile.contactUs')} onPress={() => router.push('/contact-us')} />
            <MenuRow icon="document-text-outline" label={t('profile.termsConditions')} onPress={() => router.push('/terms-conditions')} />
            <MenuRow icon="information-circle-outline" label={t('profile.appInfo')} onPress={() => router.push('/app-info')} />
            <MenuRow icon="star-outline" label={t('profile.feedback')} onPress={() => router.push('/feedback')} />
          </SectionCard>
        </View>

        <Button label={t('profile.logout')} variant="danger" onPress={() => setShowLogoutConfirm(true)} />
      </Animated.ScrollView>

      <PageLoaderOverlay visible={loading || refreshing} label="Loading Profile..." />

      <ConfirmDialog
        visible={showLogoutConfirm}
        title={t('profile.logout')}
        message={t('profile.logoutConfirm')}
        destructive
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </View>
  );
}
