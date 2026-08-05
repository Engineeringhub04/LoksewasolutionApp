// Dedicated Notices page — full list. Content is hardcoded for now (see
// src/core/data/notices.ts); Home's "Recent Notices" shows the first 3 from
// the same source so both stay in sync. Tapping a notice opens its own
// detail page.
import React, { useState } from 'react';
import { View, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/src/core/theme';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';
import { APP_NOTICES } from '@/src/core/data/notices';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';
import { PremiumNoticeCard } from '@/src/components/home/PremiumNoticeCard';

export default function NoticesScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SubpageHeader title="Notices" showThemeToggle />
      <FlatList
        data={APP_NOTICES}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.screenPadding, gap: spacing.sm }}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <PremiumNoticeCard title={item.title} date={item.date} onPress={() => router.push(`/notice/${item.id}`)} />
        )}
      />
    </View>
  );
}
