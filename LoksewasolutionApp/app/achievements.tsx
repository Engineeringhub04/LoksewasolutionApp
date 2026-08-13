// §41 Achievements — badge grid, earned vs locked.
import React, { useState } from 'react';
import { View, FlatList } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { useRefreshOnFocus } from '@/src/core/hooks/useRefreshOnFocus';
import { fetchAchievements, type AchievementStatus } from '@/src/core/firebase/services/achievements';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';
import { Text } from '@/src/components/misc/Text';
import { Card } from '@/src/components/cards/Card';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { BottomSheet } from '@/src/components/feedback/BottomSheet';

export default function AchievementsScreen() {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [selected, setSelected] = useState<AchievementStatus | null>(null);

  const { data, loading, error, refreshing, refetch, refresh } = useAsyncData(async () => {
    if (!user) return [];
    return fetchAchievements(user.uid);
  }, [user?.uid]);

  // Returning to this screen must show current data without a manual pull.
  useRefreshOnFocus(refresh);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SubpageHeader title={t('achievements.title')} showThemeToggle />
      <PageLoaderOverlay visible={loading || refreshing} label="Loading Achievements..." />
      {loading ? null : error ? (
        <DataNotFound onRetry={refetch} />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          numColumns={3}
          columnWrapperStyle={{ gap: spacing.sm, paddingHorizontal: spacing.screenPadding }}
          contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={refresh} />}
          renderItem={({ item }) => (
            <Card onPress={() => setSelected(item)} style={{ flex: 1, alignItems: 'center', gap: spacing.xs, opacity: item.unlocked ? 1 : 0.5 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: radius.pill,
                  backgroundColor: item.unlocked ? colors.surfaceAlt : colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name={item.icon as never} size={24} color={item.unlocked ? colors.accent : colors.textDisabled} />
              </View>
              <Text variant="caption" style={{ textAlign: 'center' }} numberOfLines={2}>{item.title}</Text>
            </Card>
          )}
        />
      )}

      <BottomSheet visible={!!selected} onClose={() => setSelected(null)}>
        {selected ? (
          <View style={{ alignItems: 'center', gap: spacing.sm }}>
            <Ionicons name={selected.icon as never} size={48} color={selected.unlocked ? colors.accent : colors.textDisabled} />
            <Text variant="h3" weight="semiBold">{selected.title}</Text>
            <Text variant="body" secondary style={{ textAlign: 'center' }}>
              {selected.unlocked
                ? t('achievements.unlockedOn', { date: selected.unlockedAt ? new Date(selected.unlockedAt).toLocaleDateString() : '' })
                : selected.description}
            </Text>
            {!selected.unlocked ? (
              <Text variant="caption" secondary>{t('achievements.unlockCriteria')}</Text>
            ) : null}
          </View>
        ) : null}
      </BottomSheet>
    </View>
  );
}
