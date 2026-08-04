// "About Developer" card — photo, name, short description, and a View button
// that opens the developer's link. Content comes entirely from Firestore.
import React from 'react';
import { View, Pressable, Linking, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';
import type { Developer } from '@/src/core/firebase/services/developer';

export function DeveloperCard({ developer }: { developer: Developer }) {
  const { colors, radius } = useTheme();

  const handleView = () => {
    if (developer.viewUrl) Linking.openURL(developer.viewUrl).catch(() => {});
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
      <Image source={{ uri: developer.photoUrl }} style={styles.photo} contentFit="cover" cachePolicy="disk" />
      <View style={styles.textCol}>
        <Text variant="bodyLarge" weight="bold" style={{ color: colors.textPrimary }}>{developer.name}</Text>
        <Text variant="bodySmall" secondary numberOfLines={3} style={{ marginTop: 2 }}>{developer.description}</Text>
        <Pressable onPress={handleView} style={[styles.viewBtn, { backgroundColor: colors.primary }]}>
          <Text variant="bodySmall" weight="bold" style={{ color: '#FFF' }}>View</Text>
          <Ionicons name="open-outline" size={14} color="#FFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: 14, padding: 14, borderWidth: 1 },
  photo: { width: 72, height: 72, borderRadius: 36 },
  textCol: { flex: 1, gap: 4 },
  viewBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, marginTop: 6 },
});
