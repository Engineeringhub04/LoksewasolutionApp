import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';
import { Avatar } from '@/src/components/misc/Avatar';

export interface CommentCardProps {
  authorName: string;
  authorPhoto?: string | null;
  body: string;
  timestamp: string;
  indent?: boolean;
}

export function CommentCard({ authorName, authorPhoto, body, timestamp, indent }: CommentCardProps) {
  const { spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm, marginLeft: indent ? spacing.xl : 0, paddingVertical: spacing.sm }}>
      <Avatar uri={authorPhoto} name={authorName} size={32} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', gap: spacing.xs, alignItems: 'baseline' }}>
          <Text variant="bodySmall" weight="semiBold">{authorName}</Text>
          <Text variant="caption" secondary>{timestamp}</Text>
        </View>
        <Text variant="body">{body}</Text>
      </View>
    </View>
  );
}
