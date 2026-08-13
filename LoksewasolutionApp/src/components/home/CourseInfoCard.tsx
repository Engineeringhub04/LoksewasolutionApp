// Premium dark-gradient card shown inside the Home header, displaying the
// user's currently selected Course/Subcourse. Matches the same visual family
// as the About Developer card (dark gradient + glow accents) instead of a
// plain white card. Tapping opens Course Setup in "update" mode.
import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
      <LinearGradient colors={['#0F172A', '#1E293B', '#334155']} style={styles.card}>
        <View style={styles.glow} />

        <View style={styles.iconRing}>
          <Ionicons name="school" size={20} color="#38BDF8" />
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
          <Ionicons name="chevron-forward" size={16} color="#38BDF8" />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    padding: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  glow: { position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(56,189,248,0.18)' },
  iconRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(56,189,248,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1, gap: 2 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#22C55E' },
  label: { color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5, fontSize: 10 },
  value: { color: '#FFF' },
  subValue: { color: 'rgba(255,255,255,0.7)' },
  chevronBox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(56,189,248,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
