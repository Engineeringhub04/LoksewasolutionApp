import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { categoryIcon } from '@/src/core/firebase/services/notifications';
import { Text } from '@/src/components/misc/Text';

export interface NotificationRowProps { category?: string; title: string; preview: string; timestamp: string; unread: boolean; updatedNotice?: boolean; imageUrl?: string | null; onPress: () => void; }
export function NotificationRow({ category, title, preview, timestamp, unread, updatedNotice, imageUrl, onPress }: NotificationRowProps) {
  const { colors, spacing, radius } = useTheme();
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.card, { marginHorizontal: spacing.screenPadding, marginBottom: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderColor: unread ? colors.primary + '55' : colors.divider, backgroundColor: pressed ? colors.surfaceAlt : unread ? colors.primary + '10' : colors.surface }]}>
    <View style={styles.row}><View style={[styles.iconWrap, { borderRadius: radius.pill, backgroundColor: colors.primary + '1A' }]}><Ionicons name={categoryIcon(category)} size={20} color={colors.primary} /></View>
      <View style={styles.content}><View style={styles.titleRow}><Text variant="body" weight={unread ? 'bold' : 'semiBold'} numberOfLines={2} style={styles.title}>{title}</Text>{unread ? <View style={[styles.dot, { backgroundColor: colors.primary }]} /> : null}</View>
        <Text variant="bodySmall" secondary numberOfLines={3} style={styles.preview}>{preview}</Text>
        <View style={styles.metaRow}>{category ? <Text variant="caption" weight="semiBold" style={{ color: colors.primary }}>{category}</Text> : null}{updatedNotice ? <Text variant="caption" weight="semiBold" style={{ color: colors.primary }}>Updated Notice</Text> : null}{timestamp ? <Text variant="caption" secondary style={styles.time}>{timestamp}</Text> : null}</View>
      </View></View>
    {imageUrl ? <Image source={{ uri: imageUrl }} style={[styles.image, { borderRadius: radius.md, backgroundColor: colors.surfaceAlt }]} contentFit="cover" transition={150} /> : null}
  </Pressable>;
}
const styles = StyleSheet.create({ card: { borderWidth: StyleSheet.hairlineWidth }, row: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 }, iconWrap: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }, content: { flex: 1, gap: 4 }, titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, title: { flex: 1 }, dot: { width: 8, height: 8, borderRadius: 4 }, preview: { lineHeight: 18 }, metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 9, marginTop: 3 }, time: { marginLeft: 'auto' }, image: { width: '100%', height: 150, marginTop: 12 } });
