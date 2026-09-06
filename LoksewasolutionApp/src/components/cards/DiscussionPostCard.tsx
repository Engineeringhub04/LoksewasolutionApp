import React, { useEffect } from 'react';
import { View, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { useSharedValue, withSequence, withTiming, useAnimatedStyle } from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';
import { Avatar } from '@/src/components/misc/Avatar';
import { Chip } from '@/src/components/misc/Chip';
import { Card } from '@/src/components/cards/Card';

export interface DiscussionPostCardProps {
  authorName: string;
  authorPhoto?: string | null;
  timestamp: string;
  title: string;
  preview: string;
  category?: string;
  likeCount: number;
  commentCount: number;
  liked: boolean;
  onPress: () => void;
  onToggleLike: () => void;
}

export function DiscussionPostCard({
  authorName,
  authorPhoto,
  timestamp,
  title,
  preview,
  category,
  likeCount,
  commentCount,
  liked,
  onPress,
  onToggleLike,
}: DiscussionPostCardProps) {
  const { colors, spacing } = useTheme();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (liked) scale.value = withSequence(withTiming(1.3, { duration: 120 }), withTiming(1, { duration: 120 }));
  }, [liked, scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Card onPress={onPress} style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Avatar uri={authorPhoto} name={authorName} size={36} />
        <View style={{ flex: 1 }}>
          <Text variant="body" weight="semiBold" numberOfLines={1}>{authorName}</Text>
          <Text variant="caption" secondary>{timestamp}</Text>
        </View>
        {category ? <Chip label={category} /> : null}
      </View>
      <Text variant="bodyLarge" weight="semiBold" numberOfLines={2}>{title}</Text>
      <Text variant="body" secondary numberOfLines={2}>{preview}</Text>
      <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xs }}>
        <Pressable onPress={onToggleLike} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Animated.View style={animatedStyle}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={18} color={liked ? colors.error : colors.textSecondary} />
          </Animated.View>
          <Text variant="bodySmall" secondary>{likeCount}</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="chatbubble-outline" size={16} color={colors.textSecondary} />
          <Text variant="bodySmall" secondary>{commentCount}</Text>
        </View>
      </View>
    </Card>
  );
}
