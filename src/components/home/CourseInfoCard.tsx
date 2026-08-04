// Professional card shown inside the Home header, displaying the user's
// currently selected Course/Subcourse. Tapping opens Course Setup in "update"
// mode so the user can change their selection.
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
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.iconBox}>
        <Ionicons name="school" size={20} color="#FFF" />
      </View>
      <View style={styles.textCol}>
        <Text variant="caption" style={styles.label}>Your Course</Text>
        <Text variant="body" weight="bold" style={styles.value} numberOfLines={1}>
          {hasCourse ? `${courseName}${subcourseName ? ` \u2022 ${subcourseName}` : ''}` : 'Tap to select a course'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.8)" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  iconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  textCol: { flex: 1, gap: 2 },
  label: { color: 'rgba(255,255,255,0.75)' },
  value: { color: '#FFF' },
});
