import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { useProfileStore } from '@/src/core/store/profileStore';
import { useNotificationStore } from '@/src/core/store/notificationStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { useRefreshOnFocus } from '@/src/core/hooks/useRefreshOnFocus';
import { addGlobalReadId, addGlobalReadIds, fetchInbox, markAllNotificationsRead, markNotificationRead, type AppNotification } from '@/src/core/firebase/services/notifications';
import { formatTimeAgo } from '@/src/core/notifications/timeAgo';
import { showToast } from '@/src/core/store/toastStore';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';
import { Text } from '@/src/components/misc/Text';
import { ThemeToggleButton } from '@/src/components/misc/ThemeToggleButton';
import { NotificationRow } from '@/src/components/cards/NotificationRow';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';

export default function NotificationsScreen() {
  const { colors, spacing, effective, setMode } = useTheme();
  const { t, language } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const profile = useProfileStore((s) => s.profile);
  const displayName = profile?.name || user?.displayName || undefined;
  const [items, setItems] = useState<AppNotification[]>([]);
  const { data, loading, error, refreshing, refetch, refresh } = useAsyncData(async () => user ? fetchInbox(user.uid, displayName) : [], [user?.uid, displayName]);
  useRefreshOnFocus(refresh);
  useEffect(() => {
    if (!data) return;
    setItems(data);
    useNotificationStore.getState().setFromList(data);
  }, [data]);

  const hasUnread = items.some((item) => !item.read);

  const handleMarkAllRead = () => {
    if (!user || !hasUnread) return;
    const globalIds = items.filter((item) => item.source === 'global').map((item) => item.id);
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    useNotificationStore.getState().setUnreadCount(0);
    showToast(t('notifications.markedAllRead'), 'success');
    void Promise.all([markAllNotificationsRead(user.uid), addGlobalReadIds(user.uid, globalIds)]).catch(() => undefined);
  };

  const handlePress = (item: AppNotification) => {
    if (!user) return;
    if (!item.read) {
      setItems((current) => current.map((row) => row.id === item.id ? { ...row, read: true } : row));
      useNotificationStore.getState().decrement(1);
      const request = item.source === 'global' ? addGlobalReadId(user.uid, item.id) : markNotificationRead(user.uid, item.id);
      void request.catch(() => undefined);
    }
    router.push({ pathname: '/notification/[id]', params: {
      id: item.id, title: item.title, body: item.preview, imageUrl: item.imageUrl ?? '', deepLink: item.deepLink ?? '',
      category: item.category ?? 'App Notice', updatedNotice: item.updatedNotice ? '1' : '0',
      createdAtMs: item.createdAt ? String(item.createdAt.toDate().getTime()) : '',
    }});
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SubpageHeader title={t('notifications.title')} rightSlot={<>
        <ThemeToggleButton isDark={effective === 'dark'} onToggle={() => setMode(effective === 'dark' ? 'light' : 'dark')} size={36} />
        {/* Labelled action instead of a bare tick icon — the icon alone did not
            say what it would do. Fixed width so it never resizes between the
            enabled and dimmed (nothing unread) states. */}
        <Pressable
          onPress={handleMarkAllRead}
          disabled={!hasUnread}
          style={({ pressed }) => [styles.markAllButton, { opacity: !hasUnread ? 0.45 : pressed ? 0.75 : 1 }]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !hasUnread }}
          accessibilityLabel={t('notifications.markAllRead')}
          hitSlop={6}
        >
          <Ionicons name="checkmark-done" size={15} color="#FFFFFF" />
          <Text variant="caption" weight="bold" numberOfLines={1} style={styles.markAllText}>
            {t('notifications.markAllReadShort')}
          </Text>
        </Pressable>
      </>} />
      <PageLoaderOverlay visible={loading} label="Loading Notifications..." />
      {loading ? null : error ? <DataNotFound onRetry={refetch} /> : items.length === 0 ? <EmptyState title={t('notifications.empty')} /> : (
        <FlatList data={items} keyExtractor={(item) => `${item.source ?? 'personal'}:${item.id}`}
          contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: spacing.xl }}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={refresh} />}
          renderItem={({ item }) => <NotificationRow category={item.category} title={item.title} preview={item.preview}
            timestamp={formatTimeAgo(item.createdAt, language, t)} unread={!item.read} imageUrl={item.imageUrl}
            updatedNotice={item.updatedNotice} onPress={() => handlePress(item)} />} />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  // Capped so the longer Nepali label truncates instead of squeezing the
  // centred header title. Devanagari needs a touch more room than Latin.
  markAllText: { color: '#FFFFFF', fontSize: 11, letterSpacing: 0.1, maxWidth: 78 },
});
