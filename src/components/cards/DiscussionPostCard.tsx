import React, { useEffect } from 'react';
import { View, Pressable, Image, Linking, StyleSheet } from 'react-native';
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
  const { colors, radius } = useTheme();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (liked) scale.value = withSequence(withTiming(1.22, { duration: 120 }), withTiming(1, { duration: 120 }));
  }, [liked, scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const contextLabel = [courseName, subcourseName].filter(Boolean).join(' · ');

  return (
    <Card onPress={onPress} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
      <View style={styles.topRow}>
        <Avatar uri={authorPhoto} name={authorName} size={44} />
        <View style={styles.authorBlock}>
          <View style={styles.authorLine}>
            <Text variant="body" weight="bold" numberOfLines={1} style={{ flexShrink: 1 }}>{authorName}</Text>
            {isAdmin ? <View style={styles.adminBadge}><Ionicons name="shield-checkmark" size={11} color="#1D4ED8" /><Text variant="caption" weight="bold" style={styles.adminText}>Admin</Text></View> : null}
          </View>
          <View style={styles.metaLine}>
            <Text variant="caption" secondary>{timestamp}</Text>
            {contextLabel ? <Text variant="caption" secondary numberOfLines={1}> · {contextLabel}</Text> : null}
          </View>
        </View>
        {category ? <Chip label={category} /> : null}
      </View>

      <View style={styles.titleRow}>
        <View style={[styles.titleAccent, { backgroundColor: colors.primary }]} />
        <Text variant="bodyLarge" weight="bold" numberOfLines={2} style={{ flex: 1 }}>{title}</Text>
      </View>
      <Text variant="body" secondary numberOfLines={4} style={styles.preview}>{preview}</Text>

      {imageUrl ? (
        <View style={[styles.mediaFrame, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, borderRadius: radius.md }]}>
          <Image source={{ uri: imageUrl }} style={styles.media} resizeMode="cover" />
          <View style={styles.mediaLabel}><Ionicons name="image-outline" size={13} color="#FFF" /><Text variant="caption" style={{ color: '#FFF' }}>Media</Text></View>
        </View>
      ) : null}
      {linkUrl ? (
        <Pressable
          onPress={() => Linking.openURL(linkUrl).catch(() => undefined)}
          style={({ pressed }) => [styles.linkPreview, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}30` }, pressed && styles.pressed]}
        >
          <View style={[styles.linkIcon, { backgroundColor: `${colors.primary}20` }]}><Ionicons name="link-outline" size={17} color={colors.primary} /></View>
          <View style={{ flex: 1 }}><Text variant="caption" secondary>Open link</Text><Text variant="bodySmall" weight="semiBold" style={{ color: colors.primary }} numberOfLines={1}>{linkUrl}</Text></View>
          <Ionicons name="chevron-forward" size={17} color={colors.primary} />
        </Pressable>
      ) : null}

      <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
        <Pressable onPress={onToggleLike} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
          <Animated.View style={animatedStyle}><Ionicons name={liked ? 'heart' : 'heart-outline'} size={19} color={liked ? colors.error : colors.textSecondary} /></Animated.View>
          <Text variant="bodySmall" weight="semiBold" secondary>{likeCount}</Text>
        </Pressable>
        <View style={styles.actionButton}><Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.textSecondary} /><Text variant="bodySmall" weight="semiBold" secondary>{commentCount}</Text></View>
        <View style={{ flex: 1 }} />
        {isSeed ? <View style={styles.seedLabel}><Ionicons name="sparkles-outline" size={13} color={colors.primary} /><Text variant="caption" style={{ color: colors.primary }}>Featured</Text></View> : null}
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 15, borderWidth: 1, gap: 12, shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  authorBlock: { flex: 1, gap: 2 },
  authorLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaLine: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  adminBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#DBEAFE', borderRadius: 7, paddingHorizontal: 6, paddingVertical: 3 },
  adminText: { color: '#1D4ED8', fontSize: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  titleAccent: { width: 4, minHeight: 25, borderRadius: 4 },
  preview: { lineHeight: 21 },
  mediaFrame: { overflow: 'hidden', borderWidth: 1, height: 178, position: 'relative' },
  media: { width: '100%', height: '100%' },
  mediaLabel: { position: 'absolute', left: 9, bottom: 9, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(15,23,42,0.62)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  linkPreview: { flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderRadius: 12, padding: 9 },
  linkIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 17, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 11 },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  seedLabel: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
});
