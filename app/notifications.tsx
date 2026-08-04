// §37 Notifications
import React, { useMemo } from 'react';
import { View, SectionList, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchNotifications, markAllNotificationsRead, markNotificationRead, type AppNotification } from '@/src/core/firebase/services/notifications';
import { showToast } from '@/src/core/store/toastStore';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';
import { Text } from '@/src/components/misc/Text';
import { NotificationRow } from '@/src/components/cards/NotificationRow';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { Skeleton } from '@/src/components/feedback/Skeleton';

function groupByDate(items: AppNotification[]) {
  const today: AppNotification[] = [];
  const yesterday: AppNotification[] = [];
  const earlier: AppNotification[] = [];
  const now = new Date();

  for (const item of items) {
    const date = item.createdAt?.toDate();
    if (!date) {
      earlier.push(item);
      continue;
    }
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) today.push(item);
    else if (diffDays === 1) yesterday.push(item);
    else earlier.push(item);
  }

  return [
    { title: 'today', data: today },
    { title: 'yesterday', data: yesterday },
    { title: 'earlier', data: earlier },
  ].filter((s) => s.data.length > 0);
}

export default function NotificationsScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const { data, loading, error, refreshing, refetch, refresh } = useAsyncData(async () => {
    if (!user) return [];
    return fetchNotifications(user.uid);
  }, [user?.uid]);

  const sections = useMemo(() => groupByDate(data ?? []), [data]);

  const handleMarkAllRead = async () => {
    if (!user) return;
    await markAllNotificationsRead(user.uid);
    showToast(t('notifications.markedAllRead'), 'success');
    refetch();
  };

  const handlePress = async (item: AppNotification) => {
    if (!user) return;
    if (!item.read) await markNotificationRead(user.uid, item.id);
    if (item.deepLink) router.push(item.deepLink as never);
    refetch();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SubpageHeader
        title={t('notifications.title')}
        rightSlot={
          <Text variant="bodySmall" style={{ color: '#FFF' }} onPress={handleMarkAllRead}>
            {t('notifications.markAllRead')}
          </Text>
        }
      />
      {loading ? (
        <View style={{ padding: spacing.screenPadding, gap: spacing.sm }}>
          <Skeleton height={56} /><Skeleton height={56} />
        </View>
      ) : error ? (
        <DataNotFound onRetry={refetch} />
      ) : sections.length === 0 ? (
        <EmptyState title={t('notifications.empty')} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
          renderSectionHeader={({ section }) => (
            <View style={{ paddingHorizontal: spacing.screenPadding, paddingVertical: spacing.xs, backgroundColor: colors.background }}>
              <Text variant="bodySmall" weight="semiBold" secondary>{t(`notifications.${section.title}`)}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <NotificationRow
              icon={item.icon as never}
              title={item.title}
              preview={item.preview}
              timestamp={item.createdAt?.toDate().toLocaleTimeString() ?? ''}
              unread={!item.read}
              onPress={() => handlePress(item)}
            />
          )}
        />
      )}
    </View>
  );
}
