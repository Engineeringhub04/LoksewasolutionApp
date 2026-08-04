// Colored subject card matching the reference design: solid background color,
// icon in a translucent rounded box, name at the bottom. Used on Home's
// "Subjects" section (demo data for now, real Firestore data later).
import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from '@/src/components/misc/Text';

export interface SubjectCardColoredProps {
  name: string;
  icon?: keyof typeof Ionicons.glyphMap;
  backgroundColor: string;
  onPress: () => void;
}

export function SubjectCardColored({ name, icon = 'bookmark', backgroundColor, onPress }: SubjectCardColoredProps) {
  return (
    <Pressable onPress={onPress} style={[styles.card, { backgroundColor }]}>
      <View style={styles.iconBox}>
        <Ionicons name={icon} size={26} color="#FFF" />
      </View>
      <Text variant="bodyLarge" weight="bold" style={styles.name} numberOfLines={2}>
        {name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 160,
    height: 190,
    borderRadius: 20,
    padding: 16,
    justifyContent: 'space-between',
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { color: '#FFF' },
});
