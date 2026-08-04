// Premium card shown inside the Home header, displaying the user's currently
// selected Course/Subcourse. Tapping opens Course Setup in "update" mode.
import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from '@/src/components/misc/Text';

export interface CourseInfoCardProps {
  courseName: string | null;
  subcourseName: string | null;
  onPress: () => void;
}

export function CourseInfoCard({ courseName, subcourseName, onPress }: CourseInfoCardProps) {
  const hasCourse = !!courseName;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, { opacity: pressed ? 0.9 : 1 }]}>
      <View style={styles.iconRing}>
        <View style={styles.iconBox}>
          <Ionicons name="school" size={20} color="#1D4ED8" />
        </View>
      </View>

      <View style={styles.textCol}>
        <View style={styles.labelRow}>
          <View style={styles.dot} />
          <Text variant="caption" weight="semiBold" style={styles.label}>ENROLLED COURSE</Text>
        </View>
        <Text variant="body" weight="bold" style={styles.value} numberOfLines={1}>
          {hasCourse ? courseName : 'Tap to select a course'}
        </Text>
        {hasCourse && subcourseName ? (
          <Text variant="bodySmall" style={styles.subValue} numberOfLines={1}>{subcourseName}</Text>
        ) : null}
      </View>

      <View style={styles.chevronBox}>
        <Ionicons name="chevron-forward" size={16} color="#1D4ED8" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 18,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  iconRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(29,78,216,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(29,78,216,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1, gap: 2 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#22C55E' },
  label: { color: '#64748B', letterSpacing: 0.5, fontSize: 10 },
  value: { color: '#0F172A' },
  subValue: { color: '#475569' },
  chevronBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(29,78,216,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
