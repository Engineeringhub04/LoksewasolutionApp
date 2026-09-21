// The notification inbox.
//
// One page for everyone, with one difference: an admin's inbox also carries the
// derived report feed, and enough of it to bury everything else, so admins get a
// filter track under the header. The tracks are derived from the rows that are
// actually loaded (see core/notifications/tracks), never configured — which is
// why a normal user's page is byte-for-byte the page it has always been: they
// have no admin-only rows, so there is nothing to split and no track is drawn.
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { ALL_TRACK, buildNotificationTracks, filterByTrack, hasUsefulTracks, resolveTrack } from '@/src/core/notifications/tracks';
import { showToast } from '@/src/core/store/toastStore';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';
import { Text } from '@/src/components/misc/Text';
import { ThemeToggleButton } from '@/src/components/misc/ThemeToggleButton';
import { FilterTrack } from '@/src/components/premium';
import { NotificationRow } from '@/src/components/cards/NotificationRow';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { Preloading } from '@/src/components/Preloading';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';

export default function NotificationsScreen() {
  const { colors, spacing, effective, setMode } = useTheme();
  const { t, language } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const authInitializing = useAuthStore((s) => s.initializing);
  const profile = useProfileStore((s) => s.profile);
  const displayName = profile?.name || user?.displayName || undefined;
  // Admins additionally see every incoming report here (derived rows — see
  // fetchAdminReportNotifications). Normal users never pay for that query.
  const isAdmin = profile?.isAdmin === true;

  // The rows the page actually renders. A local copy rather than `data` straight
  // from the hook, because reading a notification has to look instant: the row
  // is marked read here and the write goes out behind it.
  const [items, setItems] = useState<AppNotification[]>([]);
  const { data, error, settled, refreshing, refetch, refresh } = useAsyncData(
    async () => (user ? fetchInbox(user.uid, displayName, undefined, { isAdmin }) : []),
    [user?.uid, displayName, isAdmin],
    // Nothing is fetched until Firebase has said who is signed in. Without this
    // the first render — where `user` is still null — resolved instantly with an
    // empty array, which marked the page settled with zero rows and printed "No
    // notifications yet" over a mailbox that was never actually read.
    { enabled: !authInitializing },
  );
  useRefreshOnFocus(refresh);

  // ── Why this copy happens DURING render and not in an effect ──────────────
  //
  // It used to be a useEffect. That put one painted frame between "the fetch
  // resolved" and "the rows exist": `data` became non-null, the loader came
  // down, `items` was still the initial empty array — and the page flashed "No
  // notifications yet" before the effect ran and filled it in. That flash is the
  // bug, and no amount of tuning the loader could hide it, because the gap is
  // structural.
  //
  // Assigning state during render of the same component is React's own answer to
  // this: it discards the in-progress render and re-runs it immediately, so the
  // intermediate state is never committed to the screen. The ref is what stops
  // it looping — only a genuinely new `data` object triggers a sync, and a local
  // edit to `items` (marking a row read) is left alone.
  const syncedRef = useRef<AppNotification[] | null>(null);
  if (data && data !== syncedRef.current) {
    syncedRef.current = data;
    setItems(data);
  }

  // The store, on the other hand, is external, so it must be written from an
  // effect — touching it mid-render would mutate something React is not tracking.
  useEffect(() => {
    if (data) useNotificationStore.getState().setFromList(data);
  }, [data]);

  const hasUnread = items.some((item) => !item.read);

  // ── Admin-only filter tracks ────────────────────────────────────────────
  // Normal users never build these: for them `items` contains nothing marked
  // adminOnly, so the track row would only ever hold All and User — which
  // `hasUsefulTracks` rejects — and the page renders exactly as it always has.
  const [track, setTrack] = useState<string>(ALL_TRACK);
  const tracks = useMemo(
    () => isAdmin
      ? buildNotificationTracks(items, {
        all: t('notifications.filterAll'),
        user: t('notifications.filterUser'),
        other: t('notifications.tabOther'),
      })
      : [],
    [isAdmin, items, t],
  );
  const activeTrack = resolveTrack(tracks, track);
  const showTracks = hasUsefulTracks(tracks);
  const visible = useMemo(
    () => (showTracks ? filterByTrack(items, activeTrack) : items),
    [showTracks, items, activeTrack],
  );

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
      {/* `settled` — not `loading`, and no longer `data` either.
          `loading` flips false the instant the request returns, which is a
          moment too early. `data` was the previous fix and was still wrong at
          the edges: a fetch that legitimately returns nothing produces a
          non-null empty array, and a re-fetch (profile arrives, admin flag
          flips) leaves the OLD data in place while the new request runs. The
          hook's own "has a first fetch finished?" flag is the only thing that
          answers the actual question the loader is asking. */}
      {!settled && !error ? (
        <Preloading tinted={false} label="Loading Notifications..." hint={t("loadHints.notifications")} />
      ) : error ? <DataNotFound onRetry={refetch} /> : (
        <>
          {/* Sits between the header and the list, and keeps its own horizontal
              padding, so the chips line up with the cards underneath. */}
          {showTracks ? (
            <View style={{ paddingTop: spacing.md }}>
              <FilterTrack items={tracks} value={activeTrack} onChange={setTrack} />
            </View>
          ) : null}
          {visible.length === 0 ? (
            // Two different silences: an inbox with nothing in it, and a filter
            // that happens to be empty while the inbox is not.
            <EmptyState title={items.length === 0 ? t('notifications.empty') : t('notifications.emptyFilter')} />
          ) : (
            <FlatList data={visible} keyExtractor={(item) => `${item.source ?? 'personal'}:${item.id}`}
              contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: spacing.xl }}
              refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={refresh} />}
              renderItem={({ item }) => <NotificationRow category={item.category} title={item.title} preview={item.preview}
                timestamp={formatTimeAgo(item.createdAt, language, t)} unread={!item.read} imageUrl={item.imageUrl}
                updatedNotice={item.updatedNotice} onPress={() => handlePress(item)} />} />
          )}
        </>
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
