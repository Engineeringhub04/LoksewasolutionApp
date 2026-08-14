import React, { useEffect } from 'react';
import { View, Pressable, Image, Linking } from 'react-native';
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
  courseName?: string | null;
  subcourseName?: string | null;
  imageUrl?: string | null;
  linkUrl?: string | null;
  isAdmin?: boolean;
  isSeed?: boolean;
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
  courseName,
  subcourseName,
  imageUrl,
  linkUrl,
  isAdmin,
  isSeed,
  likeCount,
  commentCount,
  liked,
  onPress,
  onToggleLike,
}: DiscussionPostCardProps) {
  const { colors, spacing, radius } = useTheme();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (liked) scale.value = withSequence(withTiming(1.3, { duration: 120 }), withTiming(1, { duration: 120 }));
  }, [liked, scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Card onPress={onPress} style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Avatar uri={authorPhoto} name={authorName} size={38} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Text variant="body" weight="semiBold" numberOfLines={1} style={{ flexShrink: 1 }}>{authorName}</Text>
            {isAdmin ? <Chip label="Admin" /> : null}
          </View>
          <Text variant="caption" secondary>{timestamp}</Text>
          {courseName || subcourseName ? <Text variant="caption" secondary numberOfLines={1}>{[courseName, subcourseName].filter(Boolean).join(' · ')}</Text> : null}
        </View>
        {category ? <Chip label={category} /> : null}
      </View>
      <Text variant="bodyLarge" weight="semiBold" numberOfLines={2}>{title}</Text>
      <Text variant="body" secondary numberOfLines={3}>{preview}</Text>
      {imageUrl ? <Image source={{ uri: imageUrl }} style={{ width: '100%', height: 170, borderRadius: radius.md, backgroundColor: colors.surfaceAlt }} resizeMode="cover" /> : null}
      {linkUrl ? (
        <Pressable
          onPress={() => Linking.openURL(linkUrl).catch(() => undefined)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs }}
        >
          <Ionicons name="link-outline" size={17} color={colors.primary} />
          <Text variant="bodySmall" style={{ color: colors.primary, flex: 1 }} numberOfLines={1}>{linkUrl}</Text>
        </Pressable>
      ) : null}
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
        {isSeed ? <Text variant="caption" secondary style={{ marginLeft: 'auto' }}>Seed</Text> : null}
      </View>
    </Card>
  );
}
