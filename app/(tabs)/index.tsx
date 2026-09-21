// §16 Home — central hub after login. Header (profile, theme toggle,
// notifications, search box, course card), auto-sliding banner, Question of
// the Day, Subjects, Quick Links, Additional Features (3x3), Recent Notices,
// App Guide (3x3), About Developer.
import React, { useEffect, useMemo, useState } from 'react';
import { AppState, Platform, ScrollView, View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';
import { useAuthStore } from '@/src/core/store/authStore';
import { useProfileStore } from '@/src/core/store/profileStore';
import { useNotificationStore } from '@/src/core/store/notificationStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { useTranslation } from '@/src/core/i18n';
import { DEFAULT_LEARNING_COURSE_ID, DEFAULT_LEARNING_SUBCOURSE_ID } from '@/src/core/firebase/services/learning';
import { Text } from '@/src/components/misc/Text';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeHeader, getHomeHeaderExpandedHeight } from '@/src/components/home/HomeHeader';
import { BannerCarousel } from '@/src/components/home/BannerCarousel';
import { useQotdStore } from '@/src/core/store/qotdStore';
import { getKathmanduDateKey, getKathmanduMidnightDelay } from '@/src/core/firebase/services/qotd';
import { QuestionOfDayCard } from '@/src/components/home/QuestionOfDayCard';
import { SubjectCardColored } from '@/src/components/home/SubjectCardColored';
import { QuickLinkButton } from '@/src/components/home/QuickLinkButton';
import { GridButton } from '@/src/components/home/GridButton';
import { Grid3 } from '@/src/components/home/Grid3';
import { DeveloperCard } from '@/src/components/home/DeveloperCard';
import { PremiumNoticeCard } from '@/src/components/home/PremiumNoticeCard';
import { Preloading } from '@/src/components/Preloading';
import { InlineRefreshIndicator } from '@/src/components/feedback/InlineRefreshIndicator';
import { getGlassTabBarContentPadding } from '@/src/components/nav/GlassTabBar';
import { prefetchHomeData } from '@/src/core/services/homePrefetch';

interface LinkItem {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: string;
  color?: string;
}

/** Notice cards show a compact date label derived from the publish instant. */
function formatNoticeDate(millis: number | null): string {
  if (!millis) return '';
  try {
    return new Date(millis).toLocaleDateString('ne-NP', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

// Quick Links
const quickLinks: LinkItem[] = [
  { key: 'daily-test', icon: 'timer', label: 'Daily Test', route: '/daily-test', color: '#1D4ED8' },
  // Current Affairs pages were removed on 2026-09-13 pending a rebuild; the
  // tile now goes to the shared Under Construction placeholder like the other
  // not-yet-built features, so there is no dead link.
  { key: 'current-affairs', icon: 'newspaper', label: 'Current Affairs', route: '/under-construction?page=Current Affairs', color: '#059669' },
  { key: 'syllabus', icon: 'document-text', label: 'Syllabus', route: '/syllabus', color: '#EA580C' },
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
  // Points at the placeholder on purpose: app/achievements.tsx still exists, but
  // badges/levels aren't built yet, so the real screen would show an empty page.
  { key: 'achievements', icon: 'ribbon-outline', label: 'Achievements', route: '/under-construction?page=Achievements' },
  // Same screen as Profile → Analytics. It lived only in Profile, which is an odd
  // place to hide the one page that answers "how am I doing?".
  { key: 'analytics', icon: 'stats-chart-outline', label: 'Analytics', route: '/analytics' },
  { key: 'help', icon: 'help-buoy-outline', label: 'Help Center', route: '/settings/help-center' },
  // The Notifications tile was removed: the header already has a bell with an
  // unread badge, so this was a second door to the same room — and dropping it
  // keeps the grid at a clean 3x3.
  //
  // Replaced the old 'Settings' tile: that screen was a duplicate of what
  // Profile already offers (language/theme/logout/delete), so it was removed.
  // Same destination as Profile → Subscription Details.
  { key: 'subscription', icon: 'diamond-outline', label: 'Subscription Details', route: '/subscription' },
  // Same screen as Profile → More → App Info, so both entry points match.
  { key: 'about', icon: 'information-circle-outline', label: 'App Info', route: '/app-info' },
];

const FEATURE_ACCENT = '#7C3AED';
const GUIDE_ACCENT = '#059669';

export default function HomeScreen() {
  console.log('[TABS] Home render');
  const { colors, spacing, effective, setMode } = useTheme();
  const { t, language } = useTranslation();
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
    // Part of the key on purpose: an admin's inbox also carries incoming reports.
    isAdmin: storeProfile?.isAdmin === true,
  };
  const homeDataDeps = [user?.uid, enrolledCourseId, enrolledSubcourseId, storeProfile?.isAdmin === true];
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
  const notices = useAsyncData(
    (isRefresh) => prefetchHomeData(homeDataKey, isRefresh === true).then((snapshot) => snapshot.notices),
    homeDataDeps,
    { enabled: homeDataEnabled },
  );
  const storeQotdDay = useQotdStore((s) => s.day);
  const hydrateQotd = useQotdStore((s) => s.hydrate);
  const loadQotd = useQotdStore((s) => s.load);
  useEffect(() => {
    if (!user?.uid || !homeDataEnabled) return;
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => { clearTimeout(timer); timer = setTimeout(() => { void loadQotd(user.uid, enrolledCourseId, enrolledSubcourseId, true); arm(); }, getKathmanduMidnightDelay()); };
    arm();
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') { const state = useQotdStore.getState(); const shouldCheck = Date.now() - state.checkedAt >= 30000 && Boolean(!state.day?.question || state.day?.result); void loadQotd(user.uid, enrolledCourseId, enrolledSubcourseId, shouldCheck); } });
    return () => { clearTimeout(timer); sub.remove(); };
  }, [user?.uid, enrolledCourseId, enrolledSubcourseId, homeDataEnabled, loadQotd]);
  const qotdPrefetch = useAsyncData(
    (isRefresh) => prefetchHomeData(homeDataKey, isRefresh === true).then((snapshot) => snapshot.qotdDay),
    homeDataDeps,
    { enabled: homeDataEnabled },
  );

  useEffect(() => { if (qotdPrefetch.data) hydrateQotd(qotdPrefetch.data); }, [qotdPrefetch.data, hydrateQotd]);
  const qotdDay = storeQotdDay?.courseId === enrolledCourseId && storeQotdDay?.subcourseId === enrolledSubcourseId ? storeQotdDay : qotdPrefetch.data;
  // QOTD is included so the overlay stays up until EVERY source has
  // settled — it was refreshed but not tracked, so the loader could disappear
  // while that request was still in flight.
  const refreshing =
    banners.refreshing ||
    developers.refreshing ||
    notifications.refreshing ||
    qotdPrefetch.refreshing ||
    subjectDetails.refreshing ||
    notices.refreshing;
  // The first-load gate for the body: every Home field joins the SAME shared
  // snapshot request, so they settle together. `settled`, not `loading` — a
  // pull-to-refresh re-fires `loading` and the finished page must stay up.
  // Deliberately NOT gated on `homeDataEnabled` alone: an anonymous session
  // never enables the hooks, and Home's static pieces should still render.
  const initialLoading = Boolean(user?.uid) && (
    !homeDataEnabled ||
    !banners.settled ||
    !developers.settled ||
    !notifications.settled ||
    !qotdPrefetch.settled ||
    !subjectDetails.settled ||
    !notices.settled
  );
  // `ready` is what swaps the body in. Same as `initialLoading` inverted — but
  // expressed directly so the JSX reads as "is the page ready", and an error in
  // any hook still counts as settled (useAsyncData flips `settled` on error too),
  // so a failed fetch can never hang the page on the glow-ring.
  const ready = !initialLoading;
  const onRefresh = () => {
    // Every field hook joins the same forced Home snapshot request. The overlay
    // therefore covers only the actual fetch duration, not a fixed timeout.
    void banners.refresh();
    void developers.refresh();
    void notifications.refresh();
    void qotdPrefetch.refresh();
    void subjectDetails.refresh();
    void notices.refresh();
    // Keep the shared store fresh too, so Profile sees the same data.
    if (user?.uid) void useProfileStore.getState().load(user.uid, { refresh: true });
  };

  // Bell badge count. Home's inbox slice comes from a CACHED snapshot, so we
  // seed the shared notification store from it and then let the Notifications
  // page (fresh fetch + mark-read) keep that store live. The header subscribes
  // to the store, so a notification read elsewhere reflects here on return
  // without spending another Firestore read.
  const badgeCount = useNotificationStore((s) => s.unreadCount);
  useEffect(() => {
    if (notifications.data) useNotificationStore.getState().setFromList(notifications.data);
  }, [notifications.data]);
  const homeSubjects = useMemo(() => (subjectDetails.data ?? []).slice(0, 6), [subjectDetails.data]);
  // Firestore-backed Recent Notices — the same service the full Notices page
  // reads, already subcourse-filtered by the snapshot, cached on both sides.
  const recentNotices = useMemo(() => (notices.data ?? []).slice(0, 3), [notices.data]);

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
      pro={activePro}
      notificationCount={badgeCount}
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
      contentContainerStyle={{
        paddingTop: HOME_HEADER_MAX_HEIGHT,
        paddingBottom: getGlassTabBarContentPadding(insets.bottom),
      }}
      refreshControl={
        // iOS: the fixed header hides the native spinner, so `refreshing` is
        // suppressed there and the visible progress is the inline row below.
        // Android: the native spinner renders fine (it draws below the header
        // on this platform), so the DEFAULT behaviour stays — the user asked
        // for exactly that.
        <AppRefreshControl
          refreshing={Platform.OS === 'ios' ? false : refreshing}
          onRefresh={onRefresh}
          progressViewOffset={Platform.OS === 'android' ? HOME_HEADER_MAX_HEIGHT : undefined}
        />
      }
      onScroll={onScroll}
      scrollEventThrottle={16}
    >
      {!ready ? (
        // The fixed header stays; the body is replaced by the glow-ring until
        // the shared Home snapshot lands once. What used to flash behind the
        // old overlay was a page of half-rendered sections.
        <Preloading tinted={false} label="Loading Home..." hint={t("loadHints.home")} />
      ) : (
      <>
      {/* Pull-to-refresh progress for a fixed-header screen — see
          InlineRefreshIndicator for why the native spinner can't do this job. */}
      <InlineRefreshIndicator visible={refreshing} language={language} />
      {/* Banner Carousel */}
      <View style={{ marginTop: spacing.md }}>
        {banners.error ? null : banners.data && banners.data.length > 0 ? (
          <BannerCarousel banners={banners.data} />
        ) : null}
      </View>

      {/* Question of the Day */}
      <View style={{ marginTop: spacing.sm }}>
        <QuestionOfDayCard status={!qotdDay || qotdDay.courseId !== enrolledCourseId || qotdDay.subcourseId !== enrolledSubcourseId ? 'empty' : qotdDay.result ? 'completed' : qotdDay.question ? 'live' : 'empty'} onPress={() => router.push('/question-of-the-day')} />
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

      {/* Recent Notices — heading row reuses the same sectionHeaderRow +
          viewAllPill recipe as Subjects above, so the two "see all" links on
          Home stop looking like two different components. */}
      <View style={{ marginBottom: spacing.lg }}>
        <View style={styles.sectionHeaderRow}>
          <Text variant="h3" weight="bold">{t('home.recentNotices')}</Text>
          <Pressable onPress={() => router.push('/notices')} style={[styles.viewAllPill, { backgroundColor: colors.surfaceAlt }]}>
            <Text variant="bodySmall" weight="semiBold" style={{ color: colors.primary }}>{t('subjects.seeAll')}</Text>
          </Pressable>
        </View>
        {recentNotices.length === 0 ? (
          <View style={{ paddingHorizontal: spacing.screenPadding }}>
            <EmptyState title={t('notices.empty')} />
          </View>
        ) : (
          <View style={{ paddingHorizontal: spacing.screenPadding, gap: spacing.sm }}>
            {recentNotices.map((n) => (
              <PremiumNoticeCard
                key={n.id}
                title={n.title}
                date={n.dateLabel?.trim() || formatNoticeDate(n.publishedAt?.toMillis?.() ?? null)}
                kind={n.kind ?? undefined}
                description={n.excerpt}
                onPress={() => router.push(`/notice/${n.id}`)}
              />
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
      </>
      )}
    </Animated.ScrollView>
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
