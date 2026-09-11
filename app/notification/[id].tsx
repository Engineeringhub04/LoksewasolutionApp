// Notification detail — opened when a user taps a row in the inbox. Shows the
// full notification (icon, title, timestamp, banner image, complete body) and,
// when the admin attached a path/deep link, a "click here" button that takes the
// user straight there. All fields arrive as route params from the inbox list, so
// this screen never re-reads the document from Firestore.
import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { formatTimeAgo } from '@/src/core/notifications/timeAgo';
import type { FirestoreTimestamp } from '@/src/core/firebase/firestoreRest';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';

function firstParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

export default function NotificationDetailScreen() {
  const { colors, spacing, radius } = useTheme();
  const { t, language } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams();

  const title = firstParam(params.title as string | string[] | undefined);
  const body = firstParam(params.body as string | string[] | undefined);
  const icon = (firstParam(params.icon as string | string[] | undefined) || 'notifications') as keyof typeof Ionicons.glyphMap;
  const imageUrl = firstParam(params.imageUrl as string | string[] | undefined);
  const deepLink = firstParam(params.deepLink as string | string[] | undefined);
  const createdAtMs = Number(firstParam(params.createdAtMs as string | string[] | undefined));

  // Reuse the inbox's relative-time formatter by handing it a minimal Timestamp
  // shim (it only ever calls .toDate()), so the wording matches the list exactly.
  const timestamp = Number.isFinite(createdAtMs) && createdAtMs > 0
    ? formatTimeAgo(
        { toDate: () => new Date(createdAtMs), toMillis: () => createdAtMs } as FirestoreTimestamp,
        language,
        t,
      )
    : '';

  const handleOpenLink = () => {
    if (deepLink) router.push(deepLink as never);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SubpageHeader title={t('notifications.detailTitle')} />

      <ScrollView
        contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        {/* Icon + title + timestamp */}
        <View style={styles.headRow}>
          <View style={[styles.iconWrap, { borderRadius: radius.pill, backgroundColor: colors.primary + '1F' }]}>
            <Ionicons name={icon} size={26} color={colors.primary} />
          </View>
          <View style={styles.headText}>
            <Text variant="h3" weight="bold">{title}</Text>
            {timestamp ? (
              <Text variant="caption" secondary style={{ marginTop: 2 }}>{timestamp}</Text>
            ) : null}
          </View>
        </View>

        {/* Banner image, if the notification carried one */}
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={[styles.image, { borderRadius: radius.lg, backgroundColor: colors.surfaceAlt }]}
            contentFit="cover"
            transition={180}
          />
        ) : null}

        {/* Full body */}
        {body ? (
          <Text variant="body" style={styles.body}>
            {body}
          </Text>
        ) : null}

        {/* "Click here" — only when the admin attached a path/deep link. The raw
            route (e.g. "/exam") is intentionally NOT shown; the button alone
            takes the user there. */}
        {deepLink ? (
          <View style={{ marginTop: spacing.xl }}>
            <Button
              label={t('notifications.openLink')}
              onPress={handleOpenLink}
              icon={<Ionicons name="open-outline" size={18} color={colors.onPrimary} />}
            />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconWrap: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  headText: { flex: 1, paddingTop: 2 },
  image: { width: '100%', height: 200, marginTop: 18 },
  body: { marginTop: 18, lineHeight: 24 },
});
