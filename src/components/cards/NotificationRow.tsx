import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';

export interface NotificationRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  preview: string;
  timestamp: string;
  unread: boolean;
  onPress: () => void;
  /** Optional banner image (hosted URL). Rendered full-width under the text. */
  imageUrl?: string | null;
}

export function NotificationRow({ icon, title, preview, timestamp, unread, onPress, imageUrl }: NotificationRowProps) {
  const { colors, spacing, radius } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        {
          paddingHorizontal: spacing.screenPadding,
          paddingVertical: spacing.sm,
          // Unread rows get a faint primary wash + a leading accent bar so the
          // eye lands on them first, without shouting.
          backgroundColor: pressed
            ? colors.surfaceAlt
            : unread
              ? colors.primary + '12'
              : 'transparent',
        },
      ]}
    >
      {/* Leading accent bar for unread — subtle, premium, not a loud dot alone. */}
      <View
        style={[
          styles.accent,
          { backgroundColor: unread ? colors.primary : 'transparent', borderRadius: radius.pill },
        ]}
      />

      <View
        style={[
          styles.iconWrap,
          {
            borderRadius: radius.pill,
            backgroundColor: unread ? colors.primary + '1F' : colors.surfaceAlt,
          },
        ]}
      >
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text
            variant="body"
            weight={unread ? 'bold' : 'semiBold'}
            numberOfLines={1}
            style={styles.title}
          >
            {title}
          </Text>
          {unread ? (
            <View style={[styles.dot, { backgroundColor: colors.primary }]} />
          ) : null}
        </View>

        <Text variant="bodySmall" secondary numberOfLines={2} style={styles.preview}>
          {preview}
        </Text>

        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={[styles.image, { borderRadius: radius.md, backgroundColor: colors.surfaceAlt }]}
            contentFit="cover"
            transition={150}
          />
        ) : null}

        {timestamp ? (
          <Text variant="caption" secondary style={styles.timestamp}>
            {timestamp}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  accent: {
    width: 3,
    alignSelf: 'stretch',
    marginRight: 2,
  },
  iconWrap: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  body: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  preview: { lineHeight: 18 },
  image: {
    width: '100%',
    height: 150,
    marginTop: 6,
  },
  timestamp: { marginTop: 2 },
});
