// Dedicated Notices page — full list, Firestore-backed via the three-tier
// low-read cache in src/core/firebase/services/notices.ts. Home's "Recent
// Notices" reads the same service, so the two can never drift. Pull-to-refresh
// forces a real refetch. The intro block is a plain card (icon tile + title +
// one line), not the tall HeroBand the page used to open with.
import React from 'react';
import { View, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { useProfileStore } from '@/src/core/store/profileStore';
import { fetchNotices } from '@/src/core/firebase/services/notices';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';
import { PremiumNoticeCard } from '@/src/components/home/PremiumNoticeCard';
import { Text } from '@/src/components/misc/Text';
import { StatusPill } from '@/src/components/premium';
import { Preloading } from '@/src/components/Preloading';

function formatLatest(millis: number | null): string {
  if (!millis) return '';
  try {
    return new Date(millis).toLocaleDateString('ne-NP', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export default function NoticesScreen() {
  const { colors, spacing, radius, elevation } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  // The enrolled subcourse gates which targeted notices show. Guests see only
  // untargeted broadcast notices.
  const subcourseId = useProfileStore((s) => s.courseInfo?.subcourseId ?? null);

  const notices = useAsyncData(
    (isRefresh) => fetchNotices({ subcourseId, force: isRefresh }),
    [subcourseId],
  );

  const list = notices.data ?? [];
  const latest = list[0]?.publishedAt?.toMillis?.() ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SubpageHeader title={t('notices.title')} showThemeToggle />
      {!notices.settled ? (
        <Preloading tinted={false} label={t('common.loading')} hint={t('loadHints.common')} />
      ) : (
      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.screenPadding, gap: spacing.sm }}
        refreshControl={
          <AppRefreshControl refreshing={notices.refreshing} onRefresh={notices.refetch} />
        }
        ListHeaderComponent={
          <View
            style={[
              elevation[1],
              {
                marginBottom: spacing.sm,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: spacing.md,
                borderRadius: radius.lg,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.divider,
              },
            ]}
          >
            <View style={[styles.iconTile, { backgroundColor: `${colors.primary}17`, borderRadius: radius.md }]}>
              <Ionicons name="megaphone" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="h3" weight="bold">{t('notices.title')}</Text>
              <Text variant="caption" secondary numberOfLines={2}>{t('notices.intro')}</Text>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                <StatusPill label={t('notices.count', { count: list.length })} tone="info" icon="list-outline" size="sm" />
                {latest ? (
                  <StatusPill
                    label={t('notices.latest', { date: formatLatest(latest) })}
                    tone="success"
                    icon="time-outline"
                    size="sm"
                  />
                ) : null}
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          notices.loading ? null : (
            <StatusPill label={t('notices.empty')} tone="neutral" icon="megaphone-outline" size="sm" />
          )
        }
        renderItem={({ item }) => (
          <PremiumNoticeCard
            title={item.title}
            // Admin-typed Nepali date wins over the auto-formatted one.
            date={item.dateLabel?.trim() || formatLatest(item.publishedAt?.toMillis?.() ?? null)}
            kind={item.kind ?? undefined}
            description={item.excerpt}
            onPress={() => router.push(`/notice/${item.id}`)}
          />
        )}
      />
      )}
    </View>
  );
}

const styles = {
  iconTile: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
} as const;
