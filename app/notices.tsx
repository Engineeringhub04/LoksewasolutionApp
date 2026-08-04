// Dedicated Notices page — full list. Content is hardcoded for now (see
// src/core/data/notices.ts); Home's "Recent Notices" shows the first 3 from
// the same source so both stay in sync.
import React, { useState } from 'react';
import { View, FlatList, RefreshControl } from 'react-native';
import { useTheme } from '@/src/core/theme';
import { APP_NOTICES } from '@/src/core/data/notices';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';
import { Text } from '@/src/components/misc/Text';
import { Card } from '@/src/components/cards/Card';

export default function NoticesScreen() {
  const { colors, spacing } = useTheme();
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <Card>
            <View style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="body" weight="bold" style={{ flex: 1 }}>{item.title}</Text>
                <Text variant="caption" secondary>{item.date}</Text>
              </View>
              <Text variant="bodySmall" secondary>{item.description}</Text>
            </View>
          </Card>
        )}
      />
    </View>
  );
}
