import React from 'react';
import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';
import { Card } from '@/src/components/cards/Card';
import { ProgressBar } from '@/src/components/misc/ProgressBar';

export interface SubjectCardProps {
  name: string;
  icon?: keyof typeof Ionicons.glyphMap;
  chapterCount: number;
  progress: number;
  onPress: () => void;
}

export function SubjectCard({ name, icon = 'book-outline', chapterCount, progress, onPress }: SubjectCardProps) {
  const { colors, spacing, radius } = useTheme();
  return (
    <Card onPress={onPress} style={{ width: 160, gap: spacing.sm }}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: radius.md,
          backgroundColor: colors.surfaceAlt,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={22} color={colors.primary} />
      </View>
      <Text variant="bodyLarge" weight="semiBold" numberOfLines={1}>
        {name}
      </Text>
      <Text variant="caption" secondary>
        {chapterCount} chapters
      </Text>
      <ProgressBar progress={progress} />
    </Card>
  );
}
