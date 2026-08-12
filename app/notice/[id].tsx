// Individual notice detail page — opened from Home's Recent Notices or the
// full Notices list. Looks up the notice by id from the shared hardcoded list.
import React from 'react';
import { View, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { APP_NOTICES } from '@/src/core/data/notices';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';
import { Text } from '@/src/components/misc/Text';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { useManualRefresh } from '@/src/core/hooks/useManualRefresh';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';

export default function NoticeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radius } = useTheme();
  const { refreshing, onRefresh } = useManualRefresh();
  const notice = APP_NOTICES.find((n) => n.id === id);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SubpageHeader title="Notice" showThemeToggle />
      {!notice ? (
        <DataNotFound title="Notice Not Found" description="This notice may have been removed." />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.screenPadding, gap: spacing.md }}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={[{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: `${colors.primary}17`, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="megaphone" size={22} color={colors.primary} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surfaceAlt, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
                <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
                <Text variant="caption" secondary>{notice.date}</Text>
              </View>
            </View>

            <Text variant="h2" weight="bold">{notice.title}</Text>
            <Text variant="body" secondary style={{ lineHeight: 24 }}>{notice.description}</Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}
