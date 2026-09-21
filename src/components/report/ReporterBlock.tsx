// Reporter identity block, shared by the user and admin report detail screens.
//
// Both pages had their own copy of this (`ProfileLine`) with the same avatar
// fallback and the same three stacked lines, and the email could overflow the
// row on long addresses. One component, one behaviour: the avatar falls back to
// a toned medallion, the email sits in its own pill that shrinks rather than
// pushing the layout, and course / sub-course become proper label ↔ value rows.
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { Text } from '@/src/components/misc/Text';
import { InfoRow, useTones } from '@/src/components/premium';

export interface ReporterBlockProps {
  name: string;
  email?: string | null;
  photo?: string | null;
  course?: string | null;
  subcourse?: string | null;
}

export function ReporterBlock({ name, email, photo, course, subcourse }: ReporterBlockProps) {
  const { spacing, radius } = useTheme();
  const { t } = useTranslation();
  const tones = useTones();

  return (
    <View style={{ gap: spacing.xs }}>
      <View style={styles.profileRow}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.center, { backgroundColor: tones.primary.bg, borderColor: tones.primary.border, borderWidth: StyleSheet.hairlineWidth }]}>
            <Ionicons name="person" size={22} color={tones.primary.fg} />
          </View>
        )}
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="bodyLarge" weight="bold" numberOfLines={1}>{name || '—'}</Text>
          <View style={[styles.emailRow, { borderRadius: radius.pill, backgroundColor: tones.info.bg }]}>
            <Ionicons name="mail-outline" size={12} color={tones.info.fg} />
            <Text variant="caption" weight="semiBold" numberOfLines={1} style={{ color: tones.info.fg, flexShrink: 1 }}>
              {email || '—'}
            </Text>
          </View>
        </View>
      </View>
      <View>
        <InfoRow icon="school-outline" label={t('courseDetails.course')} value={course || '—'} divider />
        <InfoRow icon="layers-outline" label={t('courseDetails.subcourse')} value={subcourse || '—'} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
});
