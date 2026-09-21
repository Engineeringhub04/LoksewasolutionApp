// §39 Profile — collapsing header + Account / App Settings / Support sections.
//
// Everything shown here is backed by the users/{uid} Firestore document (via
// services/profile.ts), not just the cached auth session, so the values survive
// reinstalls and match across devices.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Share, Linking, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { logout } from '@/src/core/firebase/auth';
import { useProfileStore } from '@/src/core/store/profileStore';
import { formatDob, hasActivePremium } from '@/src/core/firebase/services/profile';
import { AppConfig } from '@/src/core/config/appConfig';
import { showToast } from '@/src/core/store/toastStore';
import { ProfileHeader, getProfileHeaderExpandedHeight } from '@/src/components/profile/ProfileHeader';
import { SectionHeading, SectionCard, InfoRow, MenuRow } from '@/src/components/profile/ProfileRows';
import { ProfileStatsCard } from '@/src/components/profile/ProfileStatsCard';
import { Button } from '@/src/components/buttons/Button';
import { ConfirmDialog } from '@/src/components/feedback/ConfirmDialog';
import { Preloading } from '@/src/components/Preloading';
import { getGlassTabBarContentPadding } from '@/src/components/nav/GlassTabBar';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';
import { InlineRefreshIndicator } from '@/src/components/feedback/InlineRefreshIndicator';

/**
 * Minimum time the Logout button shows its spinner, so the press is visibly
 * acknowledged even when the sign-out is instant.
 */
const LOGOUT_SPINNER_FLOOR_MS = 550;

/**
 * Maximum time the dialog waits on the sign-out before leaving anyway. The
 * remaining steps are cleanup, and they complete perfectly well behind the login
 * screen — what they must not do is hold a spinner hostage on a bad connection.
 */
const LOGOUT_WAIT_CEILING_MS = 1400;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export default function ProfileScreen() {
  const { colors, spacing, effective, setMode } = useTheme();
  const { t, language, setLanguage } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showRefreshLoader, setShowRefreshLoader] = useState(false);

  const HEADER_MAX_HEIGHT = getProfileHeaderExpandedHeight(insets.top);

  // Shared store — already warmed in the background by the root layout, so this
  // screen normally renders real data on first paint instead of a spinner. It's
  // also what makes an Edit Profile save show up here (and on Home) instantly.
  //
  // The stats card's aggregate rides along in the same store for the same
  // reason: it is one document read (mainLeaderboard/{uid}/{subcourseId}) of a
  // value that was already computed and published at app start, so fetching it
  // here on every visit only ever bought the user a skeleton.
  const { profile, courseInfo, loading, refreshing, load, score, scoreLoading } = useProfileStore();
  const profileError = useProfileStore((s) => s.error);

  useEffect(() => {
    if (user?.uid) void load(user.uid);
  }, [user?.uid, load]);

  const onRefresh = () => {
    if (user?.uid) void load(user.uid, { refresh: true });
  };

  // Keep the native pull-to-refresh spinner visible briefly before placing the
  // same opaque centered loader used by other pages over the refreshed content.
  useEffect(() => {
    if (!refreshing) {
      setShowRefreshLoader(false);
      return;
    }
    const timer = setTimeout(() => setShowRefreshLoader(true), 280);
    return () => clearTimeout(timer);
  }, [refreshing]);

  // Prefer the Firestore document, fall back to the auth session (which is
  // where a Google sign-in's Gmail name/photo lands first).
  const displayName = profile?.name || user?.displayName || '';
  const photoURL = profile?.photoURL || user?.photoURL || null;
  const email = profile?.email || user?.email || null;

  const genderLabel = useMemo(() => {
    const gender = profile?.gender;
    if (!gender) return null;
    return t(`profile.gender_${gender}`);
  }, [profile?.gender, t]);

  // Play Store on BOTH platforms for now — the app isn't on the App Store yet, so
  // sending iOS users to a placeholder listing would just open a dead page.
  // Switch to AppConfig.links.appStore once the iOS build is published.
  const storeUrl = AppConfig.links.playStore;

  const handleShareApp = async () => {
    const shareUrl = AppConfig.links.website;
    try {
      await Share.share({
        title: AppConfig.identity.appName,
        message: `${AppConfig.identity.appName} — ${AppConfig.identity.tagline}\n\n${shareUrl}`,
        // iOS renders a link preview from `url`; Android only reads `message`,
        // which is why the URL is included in both.
        url: shareUrl,
      });
    } catch {
      // User dismissed the share sheet — nothing to report.
    }
  };

  const handleRateUs = () => {
    Linking.openURL(storeUrl).catch(() => showToast(t('common.somethingWentWrong'), 'error'));
  };

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // The header stays; the body is replaced by the glow-ring until the profile
  // store has actually finished its FIRST load for this user. The store is
  // warmed by the root layout, so this normally never appears — but on a very
  // first launch the tab can open before the store settles, and what used to
  // flash behind the overlay was a page of "Add" rows. `error` counts as ready
  // so a failed load shows the page (with its retry affordances), not a spinner
  // forever. Pull-to-refresh keeps content on screen: only `loading` gates this.
  const ready = profile !== null || profileError;

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);

    // Two clocks, deliberately.
    //
    // logout() runs several sequential awaits (push-token delete → claim release
    // → Google sign-out → session clear). Waiting them all out used to freeze the
    // button for about a second with no sign of life, which is why an earlier fix
    // navigated first and cleaned up afterwards — correct, but it meant pressing
    // Logout produced no feedback at all.
    //
    // So: the spinner gets a FLOOR, so a fast sign-out is still visible as
    // progress rather than a flicker, and the sign-out gets a CEILING, so a slow
    // network can never bring the frozen button back. Whatever is still running
    // when the ceiling is reached is cleanup behind a screen the user has already
    // left, and it finishes on its own.
    await Promise.all([
      Promise.race([logout().catch(() => undefined), sleep(LOGOUT_WAIT_CEILING_MS)]),
      sleep(LOGOUT_SPINNER_FLOOR_MS),
    ]);

    setLoggingOut(false);
    // Dismiss and navigate together so the app's ordinary slide transition is
    // what carries the user to the login screen — the dialog fading out over a
    // moving stack is the transition, not a competing animation.
    setShowLogoutConfirm(false);
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
        subcourseName={courseInfo?.subcourseName ?? null}
        planLabel={
          profile?.isPremium
            ? profile.premiumPlanName ?? (profile.premiumBillingCycle === 'yearly' ? 'Premium Yearly' : 'Premium Monthly')
            : t('subscription.freePlan')
        }
        isPremiumPlan={!!profile?.isPremium}
        // Ring-only, and stricter than the pill above: `hasActivePremium` also
        // checks the expiry date, so a lapsed member loses the ring the moment
        // it runs out rather than whenever the next expiry sweep happens to run.
        pro={hasActivePremium(profile)}
        languageLabel={language === 'en' ? 'ENGLISH' : 'नेपाली'}
        languageShortLabel={language === 'en' ? 'EN' : 'ने'}
        onToggleLanguage={toggleLanguage}
        onEditPress={goToEdit}
        isDark={effective === 'dark'}
        onToggleTheme={() => setMode(effective === 'dark' ? 'light' : 'dark')}
      />

      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: HEADER_MAX_HEIGHT + spacing.md,
          paddingHorizontal: spacing.screenPadding,
          paddingBottom: getGlassTabBarContentPadding(insets.bottom),
          gap: spacing.lg,
        }}
        refreshControl={
          // iOS: the fixed header hides the native spinner, so `refreshing` is
          // suppressed there and the visible progress is the inline row below.
          // Android: the native spinner renders fine, so the DEFAULT behaviour
          // stays — the user asked for exactly that.
          <AppRefreshControl
            refreshing={Platform.OS === 'ios' ? false : refreshing}
            onRefresh={onRefresh}
            progressViewOffset={Platform.OS === 'android' ? HEADER_MAX_HEIGHT : undefined}
          />
        }
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {!ready ? (
          <Preloading tinted={false} label="Loading Profile..." hint={t("loadHints.profile")} />
        ) : (
          <>
        {/* Pull-to-refresh progress for a fixed-header screen — see
            InlineRefreshIndicator for why the native spinner can't do this job. */}
        <InlineRefreshIndicator visible={refreshing} language={language} />
        <ProfileStatsCard
          score={score}
          // Rank and streak live only on the mirrored map — see the card's
          // header comment for why they are not on the aggregate.
          stats={profile?.stats ?? null}
          loading={scoreLoading}
          subcourseName={courseInfo?.subcourseName ?? null}
          onPress={() => router.push('/analytics')}
        />

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
              value={formatDob(profile?.dob ?? null)}
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

        {/* ===== Admin ===== */}
        {/* Admin destinations live HERE and nowhere else. They used to be
            stitched into the screens they related to — a review link at the
            bottom of the customer-facing Subscription page, a purchase-control
            link inside the requests list — which meant an admin had to remember
            which user screen hid which tool, and every normal user scrolled
            past a row they could never open. One section, one place to look. */}
        {profile?.isAdmin ? (
          <View>
            <SectionHeading icon="shield-outline" title="Admin" />
            <SectionCard>
              <MenuRow
                icon="checkbox-outline"
                label="Answer Review"
                trailingText="Exams > Theory Desk"
                onPress={() => router.push('/(tabs)/exam')}
              />
              <MenuRow
                icon="diamond-outline"
                label={t('subscription.adminReviewTitle')}
                onPress={() => router.push('/admin/subscriptions')}
              />
              <MenuRow
                icon="receipt-outline"
                label={t('subscription.purchaseRequestControl')}
                onPress={() => router.push('/admin/purchase-details')}
              />
            </SectionCard>
          </View>
        ) : null}

        {/* ===== App Settings ===== */}
        <View>
          <SectionHeading icon="options-outline" title={t('profile.appSettings')} />
          <SectionCard>
            <MenuRow icon="school-outline" label={t('profile.courseDetails')} trailingText={courseInfo?.courseName ?? null} onPress={() => router.push('/course-details')} />
            <MenuRow icon="diamond-outline" label={t('profile.subscriptionDetails')} onPress={() => router.push('/subscription')} />
            <MenuRow icon="receipt-outline" label={t('subscription.purchaseDetails')} onPress={() => router.push('/purchase-details')} />
            <MenuRow icon="cloud-upload-outline" label="My Answer Submissions" onPress={() => router.push('/exam-answer/my-submissions')} />
            <MenuRow icon="help-circle-outline" label={t('profile.reportQuestion')} onPress={() => router.push('/report-question')} />
            <MenuRow icon="flag-outline" label={t('discussion.yourReportHistory')} onPress={() => router.push('/report-history')} />
            <MenuRow icon="bookmark-outline" label={t('profile.bookmarks')} onPress={() => router.push('/bookmarks')} />
            <MenuRow icon="analytics-outline" label={t('profile.analytics')} onPress={() => router.push('/analytics')} />
            <MenuRow icon="trash-outline" label={t('profile.deleteAccount')} destructive onPress={() => router.push('/delete-account')} />
          </SectionCard>
        </View>

        {/* ===== Support ===== */}
        <View>
          <SectionHeading icon="help-buoy-outline" title={t('profile.support')} />
          <SectionCard>
            <MenuRow icon="chatbubbles-outline" label={t('profile.contactUs')} onPress={() => router.push('/contact-us')} />
            {/* Added 2026-09-13: previously only reachable from the App Guide, so
                most users never found it. */}
            <MenuRow icon="warning-outline" label={t('help.reportTitle')} onPress={() => router.push('/settings/report-problem')} />
            {/* Moved out of App Settings 2026-09-18: the two legal documents
                belong side by side, and neither is a setting. */}
            <MenuRow icon="shield-checkmark-outline" label={t('profile.privacyPolicy')} onPress={() => router.push('/privacy-policy')} />
            <MenuRow icon="document-text-outline" label={t('profile.termsConditions')} onPress={() => router.push('/terms-conditions')} />
            <MenuRow icon="star-outline" label={t('profile.feedback')} onPress={() => router.push('/feedback')} />
          </SectionCard>
        </View>

        {/* ===== More ===== */}
        <View>
          <SectionHeading icon="ellipsis-horizontal-circle-outline" title={t('profile.more')} />
          <SectionCard>
            <MenuRow icon="share-social-outline" label={t('profile.shareApp')} onPress={handleShareApp} />
            <MenuRow icon="thumbs-up-outline" label={t('profile.rateUs')} onPress={handleRateUs} />
            {/* App Info moved here out of Support, as requested. */}
            <MenuRow icon="information-circle-outline" label={t('profile.appInfo')} onPress={() => router.push('/app-info')} />
          </SectionCard>
        </View>

        <Button label={t('profile.logout')} variant="danger" onPress={() => setShowLogoutConfirm(true)} />
          </>
        )}
      </Animated.ScrollView>

      <ConfirmDialog
        visible={showLogoutConfirm}
        title={t('profile.logout')}
        message={t('profile.logoutConfirm')}
        destructive
        confirmLoading={loggingOut}
        onConfirm={handleLogout}
        onCancel={() => { if (!loggingOut) setShowLogoutConfirm(false); }}
      />
    </View>
  );
}
