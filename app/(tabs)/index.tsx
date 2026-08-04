// §16 Home — central hub after login. Fully redesigned:
// curved header (profile, theme toggle, notifications, course card),
// auto-sliding banner, Question of the Day, Subjects, Quick Links,
// Additional Features, Recent Notices, App Guide, About Developer.
import React, { useMemo } from 'react';
import { ScrollView, View, RefreshControl, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useAuthStore } from '@/src/core/store/authStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchNotices } from '@/src/core/firebase/services/content';
import { fetchNotifications } from '@/src/core/firebase/services/notifications';
import { fetchUserCourseInfo } from '@/src/core/firebase/services/courses';
import { fetchHomeBanners } from '@/src/core/firebase/services/banners';
import { fetchDevelopers } from '@/src/core/firebase/services/developer';
import { hasAnsweredQotdToday } from '@/src/core/firebase/services/qotd';
import { Text } from '@/src/components/misc/Text';
import { NoticeCard } from '@/src/components/cards/NoticeCard';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { ErrorState } from '@/src/components/feedback/ErrorState';
import { Skeleton } from '@/src/components/feedback/Skeleton';
import { HomeHeader } from '@/src/components/home/HomeHeader';
import { BannerCarousel } from '@/src/components/home/BannerCarousel';
import { QuestionOfDayCard } from '@/src/components/home/QuestionOfDayCard';
import { SubjectCardColored } from '@/src/components/home/SubjectCardColored';
import { QuickLinkButton } from '@/src/components/home/QuickLinkButton';
import { FeatureTile } from '@/src/components/home/FeatureTile';
import { DeveloperCard } from '@/src/components/home/DeveloperCard';
import { demoSubjectsForCourse } from '@/src/components/home/demoSubjects';
import { DEMO_NOTICES } from '@/src/components/home/demoNotices';

interface LinkItem {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: string;
  color?: string;
}

// §16.12 Quick Links
const quickLinks: LinkItem[] = [
  { key: 'daily-test', icon: 'timer', label: 'Daily Test', route: '/question-of-the-day', color: '#1D4ED8' },
  { key: 'current-affairs', icon: 'newspaper', label: 'Current Affairs', route: '/current-affairs', color: '#059669' },
  { key: 'syllabus', icon: 'document-text', label: 'Syllabus', route: '/under-construction?page=Syllabus', color: '#EA580C' },
  { key: 'gorkhapatra', icon: 'reader', label: 'Gorkhapatra', route: '/gorkhapatra', color: '#7C3AED' },
];

// §16.13 Additional Features — links to real pages where they exist, otherwise
// to the Under Construction placeholder (no dead links, no deleted files).
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

const appGuide: LinkItem[] = [
  { key: 'download', icon: 'download-outline', label: 'Downloads', route: '/downloads' },
  { key: 'report', icon: 'flag-outline', label: 'Report Problem', route: '/settings/report-problem' },
  { key: 'leaderboard', icon: 'trophy-outline', label: 'Leaderboard', route: '/leaderboard' },
  { key: 'bookmark', icon: 'bookmark-outline', label: 'Bookmarks', route: '/bookmarks' },
  { key: 'achievements', icon: 'ribbon-outline', label: 'Achievements', route: '/achievements' },
  { key: 'help', icon: 'help-buoy-outline', label: 'Help Center', route: '/settings/help-center' },
];

export default function HomeScreen() {
  const { colors, spacing, effective, setMode } = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const courseInfo = useAsyncData(async () => {
    if (!user) return null;
    return fetchUserCourseInfo(user.uid);
  }, [user?.uid]);

  const banners = useAsyncData(() => fetchHomeBanners(), []);
  const notices = useAsyncData(() => fetchNotices(3), []);
  const developers = useAsyncData(() => fetchDevelopers(), []);
  const notifications = useAsyncData(async () => {
    if (!user) return [];
    return fetchNotifications(user.uid);
  }, [user?.uid]);
  const qotdAnswered = useAsyncData(async () => {
    if (!user) return false;
    return hasAnsweredQotdToday(user.uid, courseInfo.data?.courseId ?? null);
  }, [user?.uid, courseInfo.data?.courseId]);

  const refreshing = banners.refreshing || notices.refreshing || courseInfo.refreshing || developers.refreshing || notifications.refreshing;
  const onRefresh = () => {
    banners.refresh();
    notices.refresh();
    courseInfo.refresh();
    developers.refresh();
    notifications.refresh();
    qotdAnswered.refresh();
  };

  const unreadCount = useMemo(() => (notifications.data ?? []).filter((n) => !n.read).length, [notifications.data]);
  const demoSubjects = useMemo(() => demoSubjectsForCourse(courseInfo.data?.courseId ?? null), [courseInfo.data?.courseId]);

  const toggleTheme = () => setMode(effective === 'dark' ? 'light' : 'dark');

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: spacing.xxl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Header */}
      <HomeHeader
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

      {/* Additional Features */}
      <View style={{ paddingHorizontal: spacing.screenPadding, marginBottom: spacing.lg }}>
        <Text variant="h3" weight="bold" style={{ marginBottom: spacing.md }}>Additional Feature</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          {additionalFeatures.map((item) => (
            <FeatureTile key={item.key} label={item.label} icon={item.icon} onPress={() => router.push(item.route as never)} />
          ))}
        </View>
      </View>

      {/* Recent Notices */}
      <View style={{ paddingHorizontal: spacing.screenPadding, marginBottom: spacing.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
          <Text variant="h3" weight="bold">Recent Notices</Text>
          <Pressable onPress={() => router.push('/notifications')}>
            <Text variant="bodySmall" style={{ color: colors.primary }}>View All</Text>
          </Pressable>
        </View>
        {notices.loading ? (
          <View style={{ gap: spacing.sm }}>
            <Skeleton height={56} /><Skeleton height={56} /><Skeleton height={56} />
          </View>
        ) : notices.error ? (
          <ErrorState onRetry={notices.refetch} />
        ) : notices.data && notices.data.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            {notices.data.map((n) => (
              <NoticeCard key={n.id} title={n.title} date={n.date?.toDate().toLocaleDateString() ?? ''} onPress={() => router.push('/notifications')} />
            ))}
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {DEMO_NOTICES.map((n) => (
              <NoticeCard key={n.id} title={n.title} date={n.date} onPress={() => router.push('/notifications')} />
            ))}
          </View>
        )}
      </View>

      {/* App Guide */}
      <View style={{ paddingHorizontal: spacing.screenPadding, marginBottom: spacing.lg }}>
        <Text variant="h3" weight="bold" style={{ marginBottom: spacing.md }}>App Guide</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {appGuide.map((item) => (
            <Pressable key={item.key} onPress={() => router.push(item.route as never)} style={[styles.guideBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name={item.icon} size={16} color={colors.accent} />
              <Text variant="bodySmall" weight="medium" style={{ color: colors.textPrimary }}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* About Developer */}
      <View style={{ paddingHorizontal: spacing.screenPadding }}>
        <Text variant="h3" weight="bold" style={{ marginBottom: spacing.md }}>About Developer</Text>
        {developers.loading ? (
          <Skeleton height={100} radius={16} />
        ) : developers.data && developers.data.length > 0 ? (
          <DeveloperCard developer={developers.data[0]} />
        ) : (
          <EmptyState icon="person-circle-outline" title="Developer info coming soon" />
        )}
      </View>
    </ScrollView>
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
  guideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
});
