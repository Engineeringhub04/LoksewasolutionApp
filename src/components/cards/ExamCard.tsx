import React from 'react';
import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';
import { Card } from '@/src/components/cards/Card';
import { Chip } from '@/src/components/misc/Chip';

export interface ExamCardProps {
  title: string;
  questionCount: number;
  durationMinutes: number;
  status?: 'upcoming' | 'live' | 'completed';
  onPress: () => void;
}

export function ExamCard({ title, questionCount, durationMinutes, status, onPress }: ExamCardProps) {
  const { colors, spacing } = useTheme();
  return (
    <Card onPress={onPress} style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Text variant="bodyLarge" weight="semiBold" style={{ flex: 1 }} numberOfLines={2}>
          {title}
        </Text>
        {status ? <Chip label={status} /> : null}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="help-circle-outline" size={14} color={colors.textSecondary} />
          <Text variant="caption" secondary>{questionCount} questions</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
          <Text variant="caption" secondary>{durationMinutes} min</Text>
        </View>
      </View>
    </Card>
  );
}
