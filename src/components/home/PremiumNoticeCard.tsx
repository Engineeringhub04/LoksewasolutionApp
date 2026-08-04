// Premium notice card — colored side accent bar, icon chip, title, a visible
// date pill, and a chevron. Used on both Home's "Recent Notices" and the full
// Notices list, tapping opens that notice's own detail page.
import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';

export interface PremiumNoticeCardProps {
  title: string;
  date: string;
  onPress: () => void;
}

export function PremiumNoticeCard({ title, date, onPress }: PremiumNoticeCardProps) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderRadius: radius.lg, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <View style={[styles.accentBar, { backgroundColor: colors.primary }]} />
      <View style={[styles.iconChip, { backgroundColor: `${colors.primary}17` }]}>
        <Ionicons name="megaphone" size={18} color={colors.primary} />
      </View>
      <View style={styles.textCol}>
        <Text variant="bodySmall" weight="bold" numberOfLines={2} style={{ color: colors.textPrimary }}>{title}</Text>
        <View style={[styles.datePill, { backgroundColor: colors.surfaceAlt }]}>
          <Ionicons name="time-outline" size={11} color={colors.textSecondary} />
          <Text variant="caption" secondary>{date}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    paddingLeft: 0,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  accentBar: { width: 4, height: '100%', borderRadius: 2, position: 'absolute', left: 0, top: 0, bottom: 0 },
  iconChip: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  textCol: { flex: 1, gap: 6 },
  datePill: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
});
