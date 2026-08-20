// §16 Home — central hub after login. Header (profile, theme toggle,
// notifications, search box, course card), auto-sliding banner, Question of
// the Day, Subjects, Quick Links, Additional Features (3x3), Recent Notices,
// App Guide (3x3), About Developer.
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';
import { useAuthStore } from '@/src/core/store/authStore';
import { useProfileStore } from '@/src/core/store/profileStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { useTranslation } from '@/src/core/i18n';
import { DEFAULT_LEARNING_COURSE_ID, DEFAULT_LEARNING_SUBCOURSE_ID } from '@/src/core/firebase/services/learning';
import { APP_NOTICES } from '@/src/core/data/notices';
import { Text } from '@/src/components/misc/Text';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeHeader, getHomeHeaderExpandedHeight } from '@/src/components/home/HomeHeader';
import { BannerCarousel } from '@/src/components/home/BannerCarousel';
import { QuestionOfDayCard } from '@/src/components/home/QuestionOfDayCard';
import { SubjectCardColored } from '@/src/components/home/SubjectCardColored';
import { QuickLinkButton } from '@/src/components/home/QuickLinkButton';
import { GridButton } from '@/src/components/home/GridButton';
import { Grid3 } from '@/src/components/home/Grid3';
import { DeveloperCard } from '@/src/components/home/DeveloperCard';
import { PremiumNoticeCard } from '@/src/components/home/PremiumNoticeCard';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import {
  getCachedHomeData,
  getHomeSessionGeneration,
  prefetchHomeData,
} from '@/src/core/services/homePrefetch';

interface LinkItem {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: string;
  color?: string;
}

// Quick Links
const quickLinks: LinkItem[] = [
  { key: 'daily-test', icon: 'timer', label: 'Daily Test', route: '/question-of-the-day', color: '#1D4ED8' },
  { key: 'current-affairs', icon: 'newspaper', label: 'Current Affairs', route: '/current-affairs', color: '#059669' },
  { key: 'syllabus', icon: 'document-text', label: 'Syllabus', route: '/under-construction?page=Syllabus', color: '#EA580C' },
  { key: 'gorkhapatra', icon: 'reader', label: 'Gorkhapatra', route: '/gorkhapatra', color: '#7C3AED' },
];

// Additional Feature — 3x3 grid. Links to real pages where they exist,
// otherwise to the Under Construction placeholder (no dead links).
const additionalFeatures: LinkItem[] = [
  { key: 'historical-question', icon: 'time', label: 'Historical Questions', route: '/exam-history' },
  { key: 'constitution', icon: 'library', label: 'Nepal Constitution', route: '/constitution' },
  { key: 'practice', icon: 'create', label: 'Practice', route: '/subjects' },
  { key: 'gk', icon: 'bulb', label: 'GK', route: '/additional-features/gk' },
  { key: 'pm', icon: 'briefcase', label: 'PM', route: '/additional-features/pm' },
  { key: 'nepal-details', icon: 'flag', label: 'Nepal Details', route: '/under-construction?page=Nepal Details' },
  { key: 'notes', icon: 'document-text', label: 'Notes', route: '/notes' },
  { key: 'upcoming-exam', icon: 'calendar', label: 'Upcoming Exam', route: '/under-construction?page=Upcoming Exam' },
  { key: 'others', icon: 'apps', label: 'Others', route: '/under-construction?page=Others' },
];

// App Guide — also a 3x3 grid, same GridButton but a distinct accent color.
const appGuide: LinkItem[] = [
  { key: 'download', icon: 'download-outline', label: 'Downloads', route: '/downloads' },
  { key: 'report', icon: 'flag-outline', label: 'Report Problem', route: '/settings/report-problem' },
  { key: 'leaderboard', icon: 'trophy-outline', label: 'Leaderboard', route: '/leaderboard' },
  { key: 'bookmark', icon: 'bookmark-outline', label: 'Bookmarks', route: '/bookmarks' },
  { key: 'achievements', icon: 'ribbon-outline', label: 'Achievements', route: '/achievements' },
  { key: 'help', icon: 'help-buoy-outline', label: 'Help Center', route: '/settings/help-center' },
  { key: 'notifications', icon: 'notifications-outline', label: 'Notifications', route: '/notifications' },
  { key: 'settings', icon: 'settings-outline', label: 'Settings', route: '/settings' },
  // Same screen as Profile → More → App Info, so both entry points match.
  { key: 'about', icon: 'information-circle-outline', label: 'App Info', route: '/app-info' },
];

const FEATURE_ACCENT = '#7C3AED';
const GUIDE_ACCENT = '#059669';
let homeInitialTransitionSessionKey: string | null = null;

export default function HomeScreen() {
  const { colors, spacing, effective, setMode } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const insets = useSafeAreaInsets();
  const HOME_HEADER_MAX_HEIGHT = getHomeHeaderExpandedHeight(insets.top);

    // Shared profile cache — keeps the header avatar/name/course in sync with
  // whatever Edit Profile or Course Setup last saved, without a manual refresh.
  // Read-budget note: the profile store already warms `courseInfo` with a
  // single direct fetch at app start, so Home derives the enrolled scope from
  // the store instead of triggering a second `fetchUserCourseInfo` read here.
  const storeProfile = useProfileStore((s) => s.profile);
  const storeCourseInfo = useProfileStore((s) => s.courseInfo);
  const profileLoadedUid = useProfileStore((s) => s.loadedUid);

  const enrolledCourseId = storeCourseInfo?.courseId ?? storeProfile?.courseId ?? DEFAULT_LEARNING_COURSE_ID;
  const enrolledSubcourseId = storeCourseInfo?.subcourseId ?? storeProfile?.subcourseId ?? DEFAULT_LEARNING_SUBCOURSE_ID;
  const activePro = Boolean(
    storeProfile?.isPremium
      && (!storeProfile.premiumExpiryDate || new Date(storeProfile.premiumExpiryDate).getTime() > Date.now()),
  );
  const homeDataKey = {
    uid: user?.uid ?? null,
    courseId: enrolledCourseId,
    subcourseId: enrolledSubcourseId,
  };
  const homeDataDeps = [user?.uid, enrolledCourseId, enrolledSubcourseId];
  const homeSessionKey = user?.uid
    ? `${user.uid}:${getHomeSessionGeneration()}`
    : null;
  // On a direct login, Home can mount before the background profile warm-up
  // finishes. Wait for that session's final course scope before starting any
  // Home request; otherwise the default scope and final scope fetch twice.
  const homeDataEnabled = !user?.uid || profileLoadedUid === user.uid;

  // Splash populates one shared snapshot. Each field hook reads its slice from
  // that snapshot, so the first Home render does not repeat the Firebase reads.
  // On manual refresh, the first forced request is shared by every slice and the
  // refresh state remains true until that real request finishes.
  const banners = useAsyncData(
    (isRefresh) => prefetchHomeData(homeDataKey, isRefresh === true).then((snapshot) => snapshot.banners),
    homeDataDeps,
    { enabled: homeDataEnabled },
  );
  const developers = useAsyncData(
    (isRefresh) => prefetchHomeData(homeDataKey, isRefresh === true).then((snapshot) => snapshot.developers),
    homeDataDeps,
    { enabled: homeDataEnabled },
  );
  const notifications = useAsyncData(
    (isRefresh) => prefetchHomeData(homeDataKey, isRefresh === true).then((snapshot) => snapshot.notifications),
    homeDataDeps,
    { enabled: homeDataEnabled },
  );
  const subjectDetails = useAsyncData(
    (isRefresh) => prefetchHomeData(homeDataKey, isRefresh === true).then((snapshot) => snapshot.subjectDetails),
    homeDataDeps,
    { enabled: homeDataEnabled },
  );
  const qotdAnswered = useAsyncData(
    (isRefresh) => prefetchHomeData(homeDataKey, isRefresh === true).then((snapshot) => snapshot.qotdAnswered),
    homeDataDeps,
    { enabled: homeDataEnabled },
  );

  // qotdAnswered is included so the overlay stays up until EVERY source has
  // settled — it was refreshed but not tracked, so the loader could disappear
  // while that request was still in flight.
  const refreshing =
    banners.refreshing ||
    developers.refreshing ||
    notifications.refreshing ||
    qotdAnswered.refreshing ||
    subjectDetails.refreshing;
  const [showRefreshLoader, setShowRefreshLoader] = useState(false);
  const [showInitialTransition, setShowInitialTransition] = useState(false);

  // The first Splash -> Home navigation gets one visual-only 1.5-second
  // transition. It is deliberately not tied to any Firebase request.
  useEffect(() => {
    if (!homeSessionKey || homeInitialTransitionSessionKey === homeSessionKey) return;
    homeInitialTransitionSessionKey = homeSessionKey;

    let active = true;
    setShowInitialTransition(true);
    const timer = setTimeout(() => {
      if (active) setShowInitialTransition(false);
    }, 1500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [homeSessionKey]);

  // Profile warm-up can update the course key once after the screen mounts. If
  // Splash already prefetched that final key, do not flash a second initial
  // loader while the field hooks settle on the shared snapshot.
  const hasCachedHomeSnapshot = Boolean(getCachedHomeData(homeDataKey));

  // Keep the native pull-to-refresh spinner visible briefly before placing the
  // same opaque centered loader used by other pages over the refreshed content.
  // It stays visible for exactly the real duration of the shared fetch.
  useEffect(() => {
    if (!refreshing) {
      setShowRefreshLoader(false);
      return;
    }
    const timer = setTimeout(() => setShowRefreshLoader(true), 280);
    return () => clearTimeout(timer);
  }, [refreshing]);
  const initialLoading = !hasCachedHomeSnapshot && (
    banners.loading ||
    developers.loading ||
    notifications.loading ||
    qotdAnswered.loading ||
    subjectDetails.loading
  );
  const onRefresh = () => {
    // Every field hook joins the same forced Home snapshot request. The overlay
    // therefore covers only the actual fetch duration, not a fixed timeout.
    void banners.refresh();
    void developers.refresh();
    void notifications.refresh();
    void qotdAnswered.refresh();
    void subjectDetails.refresh();
    // Keep the shared store fresh too, so Profile sees the same data.
    if (user?.uid) void useProfileStore.getState().load(user.uid, { refresh: true });
  };

  const unreadCount = useMemo(() => (notifications.data ?? []).filter((n) => !n.read).length, [notifications.data]);
  const homeSubjects = useMemo(() => (subjectDetails.data ?? []).slice(0, 6), [subjectDetails.data]);
  const recentNotices = useMemo(() => APP_NOTICES.slice(0, 3), []);

  const toggleTheme = () => setMode(effective === 'dark' ? 'light' : 'dark');

  // Drives the header's collapse animation entirely on the UI thread — this
  // scroll handler is a Reanimated worklet, so updating scrollY.value here
  // never crosses the JS bridge per-frame, which is what keeps the header
  // collapse perfectly smooth (no flicker/jutter) on both Android and iOS.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    {/* Header — a FIXED overlay, NOT a child of the ScrollView. It never
        scrolls away; only its own height/content morphs based on scrollY.
        The ScrollView below is pushed down by headerSpacerHeight so content
        starts right underneath it and scrolls normally from there. */}
    <HomeHeader
      scrollY={scrollY}
      // Sourced from the shared profile store first, so a photo/name change
      // saved in Edit Profile shows up here immediately — no refresh needed.
      displayName={storeProfile?.name || user?.displayName || null}
      photoURL={storeProfile?.photoURL ?? user?.photoURL}
      notificationCount={unreadCount}
      isDark={effective === 'dark'}
      onToggleTheme={toggleTheme}
      onNotificationsPress={() => router.push('/notifications')}
      onProfilePress={() => router.push('/profile')}
      courseName={storeCourseInfo?.courseName ?? null}
      subcourseName={storeCourseInfo?.subcourseName ?? null}
      onCoursePress={() => router.push('/course-setup?mode=update')}
    />

    <Animated.ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: HOME_HEADER_MAX_HEIGHT, paddingBottom: spacing.xxl }}
      refreshControl={
        // progressViewOffset is essential here: the header is a FIXED overlay, so
        // without it the spinner renders behind the header and is invisible.
        <AppRefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          progressViewOffset={HOME_HEADER_MAX_HEIGHT}
        />
      }
      onScroll={onScroll}
      scrollEventThrottle={16}
    >
      {/* Banner Carousel */}
      <View style={{ marginTop: spacing.md }}>
        {banners.error ? null : banners.data && banners.data.length > 0 ? (
          <BannerCarousel banners={banners.data} />
        ) : null}
      </View>

      {/* Question of the Day */}
      <View style={{ marginTop: spacing.sm }}>
        <QuestionOfDayCard answered={qotdAnswered.data === true} onPress={() => router.push('/question-of-the-day')} />
      </View>

      {/* Subjects */}
      <View style={{ marginBottom: spacing.lg }}>
        <View style={styles.sectionHeaderRow}>
          <Text variant="h3" weight="bold">Subjects</Text>
          <Pressable onPress={() => router.push('/subjects')} style={[styles.viewAllPill, { backgroundColor: colors.surfaceAlt }]}>
            <Text variant="bodySmall" weight="semiBold" style={{ color: colors.primary }}>{t('subjects.seeAll')}</Text>
          </Pressable>
        </View>
        {homeSubjects.length === 0 ? (
          <View style={{ paddingHorizontal: spacing.screenPadding }}>
            <EmptyState title={t('learning.noSubjects')} />
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.screenPadding, gap: spacing.sm }}>
            {homeSubjects.map((subject, index) => (
              <SubjectCardColored
                key={subject.id}
                name={subject.name}
                icon={['globe-outline', 'briefcase-outline', 'construct-outline'][index % 3] as never}
                backgroundColor={['#2563EB', '#7C3AED', '#059669', '#EA580C'][index % 4]}
                premium={subject.pro}
                purchased={subject.pro && activePro}
                premiumLabel={t('subjects.premium')}
                purchasedLabel={t('subjects.purchasedActive')}
                onPress={() => {
                  const subjectKey = `${subject.id} ${subject.name}`.toLowerCase();
                  const hasUnits = subjectKey.includes('technical') || subjectKey.includes('प्राविधिक');
                  if (subject.pro && !hasUnits) {
                    router.push('/subjects');
                    return;
                  }
                  router.push({
                    pathname: hasUnits ? '/subjects/units/[subjectId]' : '/subjects/chapters/[subjectId]',
                    params: {
                      subjectId: subject.id,
                      course: enrolledCourseId,
                      subcourse: enrolledSubcourseId,
                      subjectName: subject.name,
                    },
                  });
                }}
              />
            ))}
          </ScrollView>
        )}
      </View>

      {/* Quick Links */}
      <View style={{ paddingHorizontal: spacing.screenPadding, marginBottom: spacing.lg }}>
        <Text variant="h3" weight="bold" style={{ marginBottom: spacing.md }}>Quick Links</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {quickLinks.map((item) => (
            <QuickLinkButton key={item.key} label={item.label} icon={item.icon} color={item.color ?? colors.primary} onPress={() => router.push(item.route as never)} />
          ))}
        </View>
      </View>

      {/* Additional Feature — 3x3 */}
      <View style={{ paddingHorizontal: spacing.screenPadding, marginBottom: spacing.lg }}>
        <Text variant="h3" weight="bold" style={{ marginBottom: spacing.md }}>Additional Feature</Text>
        <Grid3
          items={additionalFeatures}
          keyExtractor={(item) => item.key}
          renderItem={(item, width) => (
            <GridButton
              label={item.label}
              icon={item.icon}
              accentColor={FEATURE_ACCENT}
              width={width}
              onPress={() => router.push(item.route as never)}
            />
          )}
        />
      </View>

      {/* Recent Notices */}
      <View style={{ paddingHorizontal: spacing.screenPadding, marginBottom: spacing.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
          <Text variant="h3" weight="bold">Recent Notices</Text>
          <Pressable onPress={() => router.push('/notices')}>
            <Text variant="bodySmall" style={{ color: colors.primary }}>View All</Text>
          </Pressable>
        </View>
        {recentNotices.length === 0 ? (
          <EmptyState title="No notices yet" />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {recentNotices.map((n) => (
              <PremiumNoticeCard key={n.id} title={n.title} date={n.date} onPress={() => router.push(`/notice/${n.id}`)} />
            ))}
          </View>
        )}
      </View>

      {/* App Guide — 3x3 */}
      <View style={{ paddingHorizontal: spacing.screenPadding, marginBottom: spacing.lg }}>
        <Text variant="h3" weight="bold" style={{ marginBottom: spacing.md }}>App Guide</Text>
        <Grid3
          items={appGuide}
          keyExtractor={(item) => item.key}
          renderItem={(item, width) => (
            <GridButton
              label={item.label}
              icon={item.icon}
              accentColor={GUIDE_ACCENT}
              width={width}
              onPress={() => router.push(item.route as never)}
            />
          )}
        />
      </View>

      {/* About Developer */}
      <View style={{ paddingHorizontal: spacing.screenPadding }}>
        <Text variant="h3" weight="bold" style={{ marginBottom: spacing.md }}>About Developer</Text>
        {developers.data && developers.data.length > 0 ? (
          <DeveloperCard developer={developers.data[0]} />
        ) : (
          <EmptyState icon="person-circle-outline" title="Developer info coming soon" />
        )}
      </View>
    </Animated.ScrollView>
    {/* Same centered spinner + labelled overlay every other page uses, on BOTH
        the first load and pull-to-refresh (Home previously had a separate
        RefreshOverlay with no page label and no initial-load coverage). */}
    <PageLoaderOverlay visible={initialLoading || showInitialTransition || showRefreshLoader} opaque label="Loading Home..." />
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  viewAllPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
});
