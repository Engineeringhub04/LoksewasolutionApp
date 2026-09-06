import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';
import { Avatar } from '@/src/components/misc/Avatar';

export interface LeaderboardRowProps {
  rank: number;
  name: string;
  photoURL?: string | null;
  score: number;
  highlighted?: boolean;
}

const medalFor: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export function LeaderboardRow({ rank, name, photoURL, score, highlighted }: LeaderboardRowProps) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.sm + 2,
        borderRadius: radius.md,
        backgroundColor: highlighted ? colors.surfaceAlt : 'transparent',
      }}
    >
      <Text variant="bodyLarge" weight="bold" style={{ width: 32, textAlign: 'center' }}>
        {medalFor[rank] ?? rank}
      </Text>
      <Avatar uri={photoURL} name={name} size={36} />
      <Text variant="body" weight="medium" style={{ flex: 1 }} numberOfLines={1}>
        {name}
      </Text>
      <Text variant="bodyLarge" weight="semiBold">
        {score}
      </Text>
    </View>
  );
}
