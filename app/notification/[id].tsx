import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { formatTimeAgo } from '@/src/core/notifications/timeAgo';
import type { FirestoreTimestamp } from '@/src/core/firebase/firestoreRest';
import { categoryIcon } from '@/src/core/firebase/services/notifications';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';
import { ImageViewer } from '@/src/components/media/ImageViewer';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';
function firstParam(value: string | string[] | undefined): string { return (Array.isArray(value) ? value[0] : value) ?? ''; }
export default function NotificationDetailScreen() {
  const { colors, spacing, radius } = useTheme(); const { t, language } = useTranslation(); const router = useRouter(); const params = useLocalSearchParams(); const [viewerOpen, setViewerOpen] = useState(false);
  const title = firstParam(params.title as string | string[] | undefined); const body = firstParam(params.body as string | string[] | undefined); const category = firstParam(params.category as string | string[] | undefined) || 'App Notice';
  const imageUrl = firstParam(params.imageUrl as string | string[] | undefined); const deepLink = firstParam(params.deepLink as string | string[] | undefined); const updatedNotice = firstParam(params.updatedNotice as string | string[] | undefined) === '1';
  const createdAtMs = Number(firstParam(params.createdAtMs as string | string[] | undefined)); const icon = categoryIcon(category);
  const timestamp = Number.isFinite(createdAtMs) && createdAtMs > 0 ? formatTimeAgo({ toDate: () => new Date(createdAtMs), toMillis: () => createdAtMs } as FirestoreTimestamp, language, t) : '';
  return <View style={{ flex: 1, backgroundColor: colors.background }}><SubpageHeader title={t('notifications.detailTitle')} />
    <ScrollView contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: spacing.xl }} showsVerticalScrollIndicator={false}>
      <View style={styles.tags}><View style={[styles.tag, { borderRadius: radius.pill, backgroundColor: colors.primary + '18' }]}><Ionicons name={icon} size={14} color={colors.primary} /><Text variant="caption" weight="semiBold" style={{ color: colors.primary }}>{category}</Text></View>
        {updatedNotice ? <View style={[styles.tag, { borderRadius: radius.pill, backgroundColor: colors.primary + '18' }]}><Ionicons name="refresh-outline" size={14} color={colors.primary} /><Text variant="caption" weight="semiBold" style={{ color: colors.primary }}>Updated Notice</Text></View> : null}</View>
      <View style={styles.headRow}><View style={[styles.iconWrap, { borderRadius: radius.pill, backgroundColor: colors.primary + '1F' }]}><Ionicons name={icon} size={26} color={colors.primary} /></View><View style={styles.headText}><Text selectable variant="h3" weight="bold">{title}</Text>{timestamp ? <Text variant="caption" secondary style={{ marginTop: 3 }}>{timestamp}</Text> : null}</View></View>
      {imageUrl ? <Pressable onPress={() => setViewerOpen(true)} accessibilityRole="imagebutton" accessibilityLabel="Open notification image"><Image source={{ uri: imageUrl }} style={[styles.image, { borderRadius: radius.lg, backgroundColor: colors.surfaceAlt }]} contentFit="cover" transition={180} /></Pressable> : null}
      {body ? <Text selectable variant="body" style={styles.body}>{body}</Text> : null}
      {deepLink ? <View style={{ marginTop: spacing.xl }}><Button label={t('notifications.openLink')} onPress={() => router.push(deepLink as never)} icon={<Ionicons name="open-outline" size={18} color={colors.onPrimary} />} /></View> : null}
    </ScrollView>{imageUrl ? <ImageViewer visible={viewerOpen} uri={imageUrl} onClose={() => setViewerOpen(false)} /> : null}</View>;
}
const styles = StyleSheet.create({ tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }, tag: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6 }, headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, iconWrap: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' }, headText: { flex: 1, paddingTop: 2 }, image: { width: '100%', height: 220, marginTop: 18 }, body: { marginTop: 18, lineHeight: 24 } });
