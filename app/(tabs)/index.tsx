// §16 Home — central hub after login. Header (profile, theme toggle,
// notifications, search box, course card), auto-sliding banner, Question of
// the Day, Subjects, Quick Links, Additional Features (3x3), Recent Notices,
// App Guide (3x3), About Developer.
import React, { useMemo } from 'react';
import { ScrollView, View, RefreshControl, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { useAuthStore } from '@/src/core/store/authStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchNotifications } from '@/src/core/firebase/services/notifications';
import { fetchUserCourseInfo } from '@/src/core/firebase/services/courses';
import { fetchHomeBanners } from '@/src/core/firebase/services/banners';
import { fetchDevelopers } from '@/src/core/firebase/services/developer';
import { hasAnsweredQotdToday } from '@/src/core/firebase/services/qotd';
import { APP_NOTICES } from '@/src/core/data/notices';
import { Text } from '@/src/components/misc/Text';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { Skeleton } from '@/src/components/feedback/Skeleton';
import { HomeHeader } from '@/src/components/home/HomeHeader';
import { BannerCarousel } from '@/src/components/home/BannerCarousel';
import { QuestionOfDayCard } from '@/src/components/home/QuestionOfDayCard';
import { SubjectCardColored } from '@/src/components/home/SubjectCardColored';
import { QuickLinkButton } from '@/src/components/home/QuickLinkButton';
import { GridButton } from '@/src/components/home/GridButton';
import { DeveloperCard } from '@/src/components/home/DeveloperCard';
import { PremiumNoticeCard } from '@/src/components/home/PremiumNoticeCard';
import { RefreshOverlay } from '@/src/components/home/RefreshOverlay';
import { demoSubjectsForCourse } from '@/src/components/home/demoSubjects';

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
  { key: 'constitution', icon: 'library', label: 'Nepal Constitution', route: '/under-construction?page=Nepal Constitution' },
  { key: 'practice', icon: 'create', label: 'Practice', route: '/subjects' },
  { key: 'gk', icon: 'bulb', label: 'GK', route: '/under-construction?page=General Knowledge' },
  { key: 'pm', icon: 'briefcase', label: 'PM', route: '/under-construction?page=Public Management' },
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
  { key: 'about', icon: 'information-circle-outline', label: 'About App', route: '/about' },
];

const FEATURE_ACCENT = '#7C3AED';
const GUIDE_ACCENT = '#059669';

export default function HomeScreen() {
  const { colors, spacing, effective, setMode } = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const courseInfo = useAsyncData(async () => {
    if (!user) return null;
    return fetchUserCourseInfo(user.uid);
  }, [user?.uid]);

  const banners = useAsyncData(() => fetchHomeBanners(), []);
  const developers = useAsyncData(() => fetchDevelopers(), []);
  const notifications = useAsyncData(async () => {
    if (!user) return [];
    return fetchNotifications(user.uid);
  }, [user?.uid]);
  const qotdAnswered = useAsyncData(async () => {
    if (!user) return false;
    return hasAnsweredQotdToday(user.uid, courseInfo.data?.courseId ?? null);
  }, [user?.uid, courseInfo.data?.courseId]);

  const refreshing = banners.refreshing || courseInfo.refreshing || developers.refreshing || notifications.refreshing;
  const onRefresh = () => {
    banners.refresh();
    courseInfo.refresh();
    developers.refresh();
    notifications.refresh();
    qotdAnswered.refresh();
  };

  const unreadCount = useMemo(() => (notifications.data ?? []).filter((n) => !n.read).length, [notifications.data]);
  const demoSubjects = useMemo(() => demoSubjectsForCourse(courseInfo.data?.courseId ?? null), [courseInfo.data?.courseId]);
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
    <Animated.ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: spacing.xxl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      onScroll={onScroll}
      scrollEventThrottle={16}
    >
      {/* Header */}
      <HomeHeader
        scrollY={scrollY}
        displayName={user?.displayName ?? null}
        photoURL={user?.photoURL}
        notificationCount={unreadCount}
        isDark={effective === 'dark'}
        onToggleTheme={toggleTheme}
        onNotificationsPress={() => router.push('/notifications')}
        onProfilePress={() => router.push('/profile')}
        courseName={courseInfo.data?.courseName ?? null}
        subcourseName={courseInfo.data?.subcourseName ?? null}
        onCoursePress={() => router.push('/course-setup?mode=update')}
      />

      {/* Banner Carousel */}
      <View style={{ marginTop: spacing.md }}>
        {banners.loading ? (
          <View style={{ marginHorizontal: spacing.screenPadding }}>
            <Skeleton height={150} radius={18} />
          </View>
        ) : banners.error ? null : banners.data && banners.data.length > 0 ? (
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
            <Text variant="bodySmall" weight="semiBold" style={{ color: colors.primary }}>View All</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.screenPadding, gap: spacing.sm }}>
          {demoSubjects.map((s) => (
            <SubjectCardColored
              key={s.id}
              name={s.name}
              icon={s.icon as never}
              backgroundColor={s.backgroundColor}
              onPress={() => router.push('/subjects')}
            />
          ))}
        </ScrollView>
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
        <View style={styles.grid3}>
          {additionalFeatures.map((item) => (
            <GridButton key={item.key} label={item.label} icon={item.icon} accentColor={FEATURE_ACCENT} onPress={() => router.push(item.route as never)} />
          ))}
        </View>
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
        <View style={styles.grid3}>
          {appGuide.map((item) => (
            <GridButton key={item.key} label={item.label} icon={item.icon} accentColor={GUIDE_ACCENT} onPress={() => router.push(item.route as never)} />
          ))}
        </View>
      </View>

      {/* About Developer */}
      <View style={{ paddingHorizontal: spacing.screenPadding }}>
        <Text variant="h3" weight="bold" style={{ marginBottom: spacing.md }}>About Developer</Text>
        {developers.loading ? (
          <Skeleton height={120} radius={22} />
        ) : developers.data && developers.data.length > 0 ? (
          <DeveloperCard developer={developers.data[0]} />
        ) : (
          <EmptyState icon="person-circle-outline" title="Developer info coming soon" />
        )}
      </View>
    </Animated.ScrollView>
    <RefreshOverlay visible={refreshing} />
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
  grid3: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
