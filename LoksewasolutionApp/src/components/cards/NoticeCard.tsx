import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';
import { Card } from '@/src/components/cards/Card';

export interface NoticeCardProps {
  title: string;
  date: string;
  onPress: () => void;
}

export function NoticeCard({ title, date, onPress }: NoticeCardProps) {
  const { spacing } = useTheme();
  return (
    <Card onPress={onPress}>
      <View style={{ gap: spacing.xs }}>
        <Text variant="body" weight="medium" numberOfLines={2}>
          {title}
        </Text>
        <Text variant="caption" secondary>
          {date}
        </Text>
      </View>
    </Card>
  );
}
