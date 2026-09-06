import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';
import { Card } from '@/src/components/cards/Card';

export interface ResultCardProps {
  title: string;
  date: string;
  score: number;
  totalMarks: number;
  onPress: () => void;
}

export function ResultCard({ title, date, score, totalMarks, onPress }: ResultCardProps) {
  const { colors, spacing } = useTheme();
  const percent = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
  return (
    <Card onPress={onPress}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text variant="body" weight="medium" numberOfLines={1}>{title}</Text>
          <Text variant="caption" secondary>{date}</Text>
        </View>
        <Text variant="h3" weight="bold" style={{ color: percent >= 50 ? colors.success : colors.error }}>
          {score}/{totalMarks}
        </Text>
      </View>
    </Card>
  );
}
