// In-screen Tab Bar (PRD §8.3) — distinct from the app-level Bottom Navigation.
import React from 'react';
import { ScrollView, Pressable, View } from 'react-native';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';

export interface TabBarItem<T extends string> {
  key: T;
  label: string;
}

export interface TabBarProps<T extends string> {
  items: TabBarItem<T>[];
  active: T;
  onChange: (key: T) => void;
}

export function TabBar<T extends string>({ items, active, onChange }: TabBarProps<T>) {
  const { colors, spacing } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ borderBottomWidth: 1, borderBottomColor: colors.divider }}>
      {items.map((item) => {
        const isActive = item.key === active;
        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            style={{ paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md }}
          >
            <Text variant="bodyLarge" weight={isActive ? 'semiBold' : 'regular'} style={{ color: isActive ? colors.primary : colors.textSecondary }}>
              {item.label}
            </Text>
            <View
              style={{
                height: 2,
                marginTop: spacing.xs,
                backgroundColor: isActive ? colors.primary : 'transparent',
                borderRadius: 1,
              }}
            />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
