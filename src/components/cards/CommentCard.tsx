import React, { useRef } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { Text } from '@/src/components/misc/Text';
import { Avatar } from '@/src/components/misc/Avatar';

export interface CommentCardProps {
  authorName: string;
  authorPhoto?: string | null;
  body: string;
  timestamp: string;
  likeCount: number;
  liked: boolean;
  indent?: boolean;
  onToggleLike: () => void;
  onMenuPress?: (anchor: { top: number; right: number }) => void;
}

const URL_PATTERN = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

export function CommentCard({ authorName, authorPhoto, body, timestamp, likeCount, liked, indent, onToggleLike, onMenuPress }: CommentCardProps) {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const scale = useSharedValue(1);
  const menuRef = useRef<View>(null);
  const segments = body.split(URL_PATTERN);

  const openLink = (value: string) => {
    const url = value.startsWith('http') ? value : `https://${value}`;
    Alert.alert(t('discussion.openLinkTitle'), url, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('discussion.openLink'), onPress: () => Linking.openURL(url).catch(() => undefined) },
    ]);
  };

  const handleLike = () => {
    scale.value = withSequence(withTiming(1.24, { duration: 110 }), withTiming(1, { duration: 150 }));
    onToggleLike();
  };

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View style={[styles.container, { marginLeft: indent ? spacing.xl : 0, paddingVertical: spacing.sm }]}>
      <Avatar uri={authorPhoto} name={authorName} size={38} />
      <View style={{ flex: 1, gap: 5 }}>
        <View style={styles.authorRow}>
          <Text variant="bodySmall" weight="semiBold" style={{ flex: 1 }} numberOfLines={1}>{authorName}</Text>
          <Text variant="caption" secondary>{timestamp}</Text>
          {onMenuPress ? (
            <Pressable
              ref={menuRef}
              onPress={() => menuRef.current?.measureInWindow((_x, y, _width, height) => onMenuPress?.({ top: y + height + 4, right: 16 }))}
              accessibilityRole="button"
              accessibilityLabel={t('discussion.commentOptions')}
              hitSlop={8}
              style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>
        <View style={{ borderLeftWidth: 2, borderLeftColor: colors.border, paddingLeft: spacing.sm }}>
          <Text variant="body" style={{ lineHeight: 21 }}>
            {segments.map((segment, index) => {
              const isLink = /^(https?:\/\/|www\.)/i.test(segment);
              return isLink ? (
                <Text key={`${segment}-${index}`} variant="body" style={styles.link} onPress={() => openLink(segment)}>
                  {segment}
                </Text>
              ) : segment;
            })}
          </Text>
        </View>
        <View style={styles.actionRow}>
          <Pressable onPress={handleLike} style={({ pressed }) => [styles.likeButton, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={t('discussion.likeComment')}>
            <Animated.View style={animatedStyle}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={17} color={liked ? '#E11D48' : colors.textSecondary} />
            </Animated.View>
            <Text variant="caption" weight="semiBold" secondary>{likeCount}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', gap: 10 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  menuButton: { padding: 4, borderRadius: 18 },
  actionRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 2 },
  likeButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 2, paddingRight: 8 },
  link: { color: '#2563EB', textDecorationLine: 'underline' },
  pressed: { opacity: 0.65, transform: [{ scale: 0.97 }] },
});
