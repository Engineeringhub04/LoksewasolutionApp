// §37 Notifications
import React, { useEffect, useMemo, useState } from 'react';
import { View, SectionList, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';
import { useTranslation } from '@/src/core/i18n';
import { formatTimeAgo } from '@/src/core/notifications/timeAgo';
import { useAuthStore } from '@/src/core/store/authStore';
import { useProfileStore } from '@/src/core/store/profileStore';
import { useNotificationStore } from '@/src/core/store/notificationStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { useRefreshOnFocus } from '@/src/core/hooks/useRefreshOnFocus';
import {
  fetchInbox,
  addBroadcastReadId,
  addBroadcastReadIds,
  markAllNotificationsRead,
  markNotificationRead,
  resolveNotificationCategory,
  type AppNotification,
  type NotificationCategory,
} from '@/src/core/firebase/services/notifications';
import { showToast } from '@/src/core/store/toastStore';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';
import { Text } from '@/src/components/misc/Text';
import { Chip } from '@/src/components/misc/Chip';
import { NotificationRow } from '@/src/components/cards/NotificationRow';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';

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
  const { colors, spacing, radius } = useTheme();
  const { t, language } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const profile = useProfileStore((s) => s.profile);
  // Same name source the Home greeting uses, so a broadcast's "Hello, X" matches.
  const displayName = profile?.name || user?.displayName || undefined;
  const [activeTab, setActiveTab] = useState<NotificationCategory>('app');

  const { data, loading, error, refreshing, refetch, refresh } = useAsyncData(async () => {
    if (!user) return [];
    return fetchInbox(user.uid, displayName);
  }, [user?.uid, displayName]);

  // Returning to this screen must show current data without a manual pull.
  useRefreshOnFocus(refresh);

  // This screen always fetches fresh, so it is the authority on the unread
  // count. Push it to the shared store so the Home bell badge (which otherwise
  // reads a cached snapshot) reflects reality the moment the user returns.
  useEffect(() => {
    if (data) useNotificationStore.getState().setFromList(data);
  }, [data]);

  const tabs: { key: NotificationCategory; label: string }[] = [
    { key: 'app', label: t('notifications.tabApp') },
    { key: 'user', label: t('notifications.tabUser') },
    { key: 'other', label: t('notifications.tabOther') },
  ];

  const visibleItems = useMemo(
    () => (data ?? []).filter((n) => resolveNotificationCategory(n) === activeTab),
    [data, activeTab]
  );
  const sections = useMemo(() => groupByDate(visibleItems), [visibleItems]);

  const handleMarkAllRead = async () => {
    if (!user) return;
    // Broadcast rows are read from a shared doc, so "read" for them is local; mark
    // both the private inbox (Firestore) and the broadcast set (AsyncStorage).
    const broadcastIds = (data ?? []).filter((n) => n.isBroadcast).map((n) => n.id);
    await Promise.all([
      markAllNotificationsRead(user.uid),
      addBroadcastReadIds(user.uid, broadcastIds),
    ]);
    useNotificationStore.getState().setUnreadCount(0);
    showToast(t('notifications.markedAllRead'), 'success');
    refetch();
  };

  const handlePress = (item: AppNotification) => {
    if (!user) return;
    // Navigate FIRST so the detail page opens instantly — no waiting on a
    // mark-read round-trip and no list reload flashing behind the transition.
    // Open a dedicated detail page (NOT the deep link directly). The detail page
    // shows the full notification and, when the admin attached a path, offers a
    // "click here" button that navigates there. Passing the fields as params
    // avoids a second Firestore read for a document we already hold in memory.
    router.push({
      pathname: '/notification/[id]',
      params: {
        id: item.id,
        title: item.title,
        body: item.preview,
        icon: item.icon,
        imageUrl: item.imageUrl ?? '',
        deepLink: item.deepLink ?? '',
        category: item.category ?? 'app',
        createdAtMs: item.createdAt ? String(item.createdAt.toDate().getTime()) : '',
      },
    });
    // Mark read in the BACKGROUND (fire-and-forget). The store drops the count
    // optimistically, and the on-focus refresh reconciles the row on return, so
    // we never block navigation or reload the list under a loading overlay.
    if (!item.read) {
      useNotificationStore.getState().decrement(1);
      const markRead = item.isBroadcast
        ? addBroadcastReadId(user.uid, item.id)
        : markNotificationRead(user.uid, item.id);
      void markRead.catch(() => undefined);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* No rightSlot — so SubpageHeader renders its default working theme
          toggle, which this page was missing. */}
      <SubpageHeader title={t('notifications.title')} />

      {/* Tab selection + Mark all as read, both directly under the header.
          The tab strip scrolls horizontally so the row never overflows on
          narrow phones, and the button keeps its width (flexShrink: 0). */}
      <View style={[styles.controlsRow, { paddingHorizontal: spacing.screenPadding, paddingVertical: spacing.sm, borderBottomColor: colors.divider }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabStrip} contentContainerStyle={styles.tabStripContent}>
          {tabs.map((tab) => (
            <Chip key={tab.key} label={tab.label} selected={tab.key === activeTab} onPress={() => setActiveTab(tab.key)} />
          ))}
        </ScrollView>
        <Pressable
          onPress={handleMarkAllRead}
          style={({ pressed }) => [
            styles.markAllButton,
            { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, opacity: pressed ? 0.7 : 1 },
          ]}
          accessibilityLabel={t('notifications.markAllRead')}
        >
          <Ionicons name="checkmark-done-outline" size={16} color={colors.primary} />
          <Text variant="caption" weight="semiBold" style={{ color: colors.primary }} numberOfLines={1}>
            {t('notifications.markAllRead')}
          </Text>
        </Pressable>
      </View>

      <PageLoaderOverlay visible={loading || refreshing} label="Loading Notifications..." />
      {loading ? null : error ? (
        <DataNotFound onRetry={refetch} />
      ) : sections.length === 0 ? (
        <EmptyState title={t('notifications.empty')} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={refresh} />}
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
              timestamp={formatTimeAgo(item.createdAt, language, t)}
              unread={!item.read}
              imageUrl={item.imageUrl}
              onPress={() => handlePress(item)}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabStrip: { flex: 1 },
  tabStripContent: { alignItems: 'center' },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
});
