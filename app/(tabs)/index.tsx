// §16 Home — central hub after login.
import React, { useMemo } from 'react';
import { ScrollView, View, RefreshControl, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchNotices, fetchSubjects } from '@/src/core/firebase/services/content';
import { Text } from '@/src/components/misc/Text';
import { Avatar } from '@/src/components/misc/Avatar';
import { Badge } from '@/src/components/misc/Badge';
import { SubjectCard } from '@/src/components/cards/SubjectCard';
import { NoticeCard } from '@/src/components/cards/NoticeCard';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { ErrorState } from '@/src/components/feedback/ErrorState';
import { Skeleton, SkeletonCard } from '@/src/components/feedback/Skeleton';
import { Card } from '@/src/components/cards/Card';

interface QuickAction {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  labelKey: string;
  route: string;
}

const quickActions: QuickAction[] = [
  { key: 'mock', icon: 'timer-outline', labelKey: 'home.mockTest', route: '/exam' },
  { key: 'ca', icon: 'newspaper-outline', labelKey: 'home.currentAffairs', route: '/current-affairs' },
  { key: 'bookmarks', icon: 'bookmark-outline', labelKey: 'home.bookmarks', route: '/bookmarks' },
  { key: 'notes', icon: 'document-text-outline', labelKey: 'home.notes', route: '/notes' },
];

const moreFeatures: QuickAction[] = [
  { key: 'gorkhapatra', icon: 'newspaper', labelKey: 'gorkhapatra.title', route: '/gorkhapatra' },
  { key: 'qotd', icon: 'help-circle-outline', labelKey: 'home.questionOfTheDay', route: '/question-of-the-day' },
  { key: 'leaderboard', icon: 'trophy-outline', labelKey: 'home.leaderboard', route: '/leaderboard' },
  { key: 'downloads', icon: 'download-outline', labelKey: 'home.downloads', route: '/downloads' },
  { key: 'history', icon: 'time-outline', labelKey: 'history.title', route: '/exam-history' },
  { key: 'analytics', icon: 'analytics-outline', labelKey: 'analytics.title', route: '/analytics' },
  { key: 'achievements', icon: 'ribbon-outline', labelKey: 'achievements.title', route: '/achievements' },
  { key: 'report', icon: 'flag-outline', labelKey: 'home.reportProblem', route: '/settings/report-problem' },
  { key: 'settings', icon: 'settings-outline', labelKey: 'settings.title', route: '/settings' },
];

const appGuide: QuickAction[] = [
  { key: 'download', icon: 'download-outline', labelKey: 'common.download', route: '/downloads' },
  { key: 'report', icon: 'flag-outline', labelKey: 'home.reportProblem', route: '/settings/report-problem' },
  { key: 'leaderboard', icon: 'trophy-outline', labelKey: 'home.leaderboard', route: '/leaderboard' },
  { key: 'bookmark', icon: 'bookmark-outline', labelKey: 'home.bookmarks', route: '/bookmarks' },
  { key: 'notes', icon: 'document-text-outline', labelKey: 'home.keepNotes', route: '/notes' },
  { key: 'help', icon: 'help-buoy-outline', labelKey: 'help.title', route: '/settings/help-center' },
];

function greetingKey(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'home.goodMorning';
  if (hour < 17) return 'home.goodAfternoon';
  return 'home.goodEvening';
}

export default function HomeScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  const subjects = useAsyncData(() => fetchSubjects(), []);
  const notices = useAsyncData(() => fetchNotices(3), []);

  const refreshing = subjects.refreshing || notices.refreshing;
  const onRefresh = () => {
    subjects.refresh();
    notices.refresh();
  };

  const displayName = user?.displayName?.split(' ')[0] ?? '';

  const gridRows = useMemo(() => {
    const rows: QuickAction[][] = [];
    for (let i = 0; i < moreFeatures.length; i += 3) rows.push(moreFeatures.slice(i, i + 3));
    return rows;
  }, []);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: spacing.xxl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: insets.top + spacing.sm,
          paddingHorizontal: spacing.screenPadding,
          paddingBottom: spacing.md,
          gap: spacing.sm,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text variant="body" secondary>
            {t(greetingKey())}
            {displayName ? `, ${displayName}` : ''}
          </Text>
        </View>
        <Pressable onPress={() => router.push('/search')} accessibilityLabel={t('search.title')}>
          <Ionicons name="search-outline" size={24} color={colors.textPrimary} />
        </Pressable>
        <Pressable onPress={() => router.push('/notifications')} accessibilityLabel={t('notifications.title')} style={{ position: 'relative' }}>
          <Ionicons name="notifications-outline" size={24} color={colors.textPrimary} />
          <View style={{ position: 'absolute', top: -4, right: -4 }}>
            <Badge count={2} />
          </View>
        </Pressable>
        <Pressable onPress={() => router.push('/profile')} accessibilityLabel={t('profile.title')}>
          <Avatar uri={user?.photoURL} name={user?.displayName ?? undefined} size={36} />
        </Pressable>
      </View>

      {/* Question of the Day */}
      <View style={{ paddingHorizontal: spacing.screenPadding, marginBottom: spacing.md }}>
        <Card onPress={() => router.push('/question-of-the-day')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Ionicons name="bulb-outline" size={28} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyLarge" weight="semiBold">{t('home.questionOfTheDay')}</Text>
              <Text variant="bodySmall" secondary>{t('qotd.reveal')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </View>
        </Card>
      </View>

      {/* Subject Categories */}
      <View style={{ marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.screenPadding, marginBottom: spacing.sm }}>
          <Text variant="h3" weight="semiBold">{t('home.subjectCategories')}</Text>
          <Pressable onPress={() => router.push('/subjects')}>
            <Text variant="bodySmall" style={{ color: colors.primary }}>{t('common.seeAll')}</Text>
          </Pressable>
        </View>
        {subjects.loading ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.screenPadding, gap: spacing.sm }}>
            {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </ScrollView>
        ) : subjects.error ? (
          <ErrorState onRetry={subjects.refetch} />
        ) : !subjects.data || subjects.data.length === 0 ? (
          <EmptyState title={t('subjects.contentComingSoon')} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.screenPadding, gap: spacing.sm }}>
            {subjects.data.map((s) => (
              <SubjectCard
                key={s.id}
                name={s.name}
                icon={s.icon as never}
                chapterCount={s.chapterCount}
                progress={0}
                onPress={() => router.push(`/subjects/${s.id}`)}
              />
            ))}
          </ScrollView>
        )}
      </View>

      {/* Quick Actions */}
      <View style={{ paddingHorizontal: spacing.screenPadding, marginBottom: spacing.lg }}>
        <Text variant="h3" weight="semiBold" style={{ marginBottom: spacing.sm }}>{t('home.quickActions')}</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {quickActions.map((action) => (
            <Pressable key={action.key} onPress={() => router.push(action.route as never)} style={{ alignItems: 'center', gap: spacing.xs, width: 76 }}>
              <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={action.icon} size={24} color={colors.primary} />
              </View>
              <Text variant="caption" style={{ textAlign: 'center' }} numberOfLines={1}>{t(action.labelKey)}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Additional Features Grid (3x3) */}
      <View style={{ paddingHorizontal: spacing.screenPadding, marginBottom: spacing.lg }}>
        <Text variant="h3" weight="semiBold" style={{ marginBottom: spacing.sm }}>{t('home.moreFeatures')}</Text>
        {gridRows.map((row, rowIndex) => (
          <View key={rowIndex} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md }}>
            {row.map((item) => (
              <Pressable key={item.key} onPress={() => router.push(item.route as never)} style={{ alignItems: 'center', gap: spacing.xs, width: 90 }}>
                <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={item.icon} size={22} color={colors.secondary} />
                </View>
                <Text variant="caption" style={{ textAlign: 'center' }} numberOfLines={2}>{t(item.labelKey)}</Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>

      {/* Recent Notices */}
      <View style={{ paddingHorizontal: spacing.screenPadding, marginBottom: spacing.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
          <Text variant="h3" weight="semiBold">{t('home.recentNotices')}</Text>
          <Pressable onPress={() => router.push('/notifications')}>
            <Text variant="bodySmall" style={{ color: colors.primary }}>{t('common.seeAll')}</Text>
          </Pressable>
        </View>
        {notices.loading ? (
          <View style={{ gap: spacing.sm }}>
            <Skeleton height={56} /><Skeleton height={56} /><Skeleton height={56} />
          </View>
        ) : notices.error ? (
          <ErrorState onRetry={notices.refetch} />
        ) : !notices.data || notices.data.length === 0 ? (
          <EmptyState title={t('common.comingSoon')} />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {notices.data.map((n) => (
              <NoticeCard key={n.id} title={n.title} date={n.date?.toDate().toLocaleDateString() ?? ''} onPress={() => router.push('/notifications')} />
            ))}
          </View>
        )}
      </View>

      {/* LS App Guide */}
      <View style={{ paddingHorizontal: spacing.screenPadding }}>
        <Text variant="h3" weight="semiBold" style={{ marginBottom: spacing.sm }}>{t('home.appGuide')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          {appGuide.map((item) => (
            <Pressable key={item.key} onPress={() => router.push(item.route as never)} style={{ alignItems: 'center', gap: spacing.xs, width: 76 }}>
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={item.icon} size={22} color={colors.accent} />
              </View>
              <Text variant="caption" style={{ textAlign: 'center' }} numberOfLines={1}>{t(item.labelKey)}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
