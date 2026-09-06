// "About Developer" card — premium gradient design with a bordered avatar,
// verified badge, name, short description, and a pill-shaped View button.
import React from 'react';
import { View, Pressable, Linking, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from '@/src/components/misc/Text';
import type { Developer } from '@/src/core/firebase/services/developer';

export function DeveloperCard({ developer }: { developer: Developer }) {
  const handleView = () => {
    if (developer.viewUrl) Linking.openURL(developer.viewUrl).catch(() => {});
  };

  return (
    <LinearGradient colors={['#0F172A', '#1E293B', '#334155']} style={styles.card}>
      {/* Decorative glow circles */}
      <View style={styles.glowTopRight} />
      <View style={styles.glowBottomLeft} />

      <View style={styles.avatarWrap}>
        <View style={styles.avatarBorder}>
          <Image source={{ uri: developer.photoUrl }} style={styles.photo} contentFit="cover" cachePolicy="disk" />
        </View>
        <View style={styles.verifiedBadge}>
          <Ionicons name="checkmark" size={12} color="#FFF" />
        </View>
      </View>

      <View style={styles.textCol}>
        <View style={styles.nameRow}>
          <Text variant="bodyLarge" weight="bold" style={styles.name}>{developer.name}</Text>
          <Ionicons name="code-slash" size={16} color="#38BDF8" />
        </View>
        <Text variant="bodySmall" style={styles.description} numberOfLines={3}>{developer.description}</Text>

        <Pressable onPress={handleView} style={({ pressed }) => [styles.viewBtn, { opacity: pressed ? 0.85 : 1 }]}>
          <Text variant="bodySmall" weight="bold" style={styles.viewBtnText}>Visit Portfolio</Text>
          <Ionicons name="arrow-forward" size={14} color="#0F172A" />
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 16,
    padding: 18,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  glowTopRight: { position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(56,189,248,0.15)' },
  glowBottomLeft: { position: 'absolute', bottom: -40, left: -20, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(139,92,246,0.12)' },
  avatarWrap: { alignItems: 'center', justifyContent: 'center' },
  avatarBorder: {
    width: 76,
    height: 76,
    borderRadius: 38,
    padding: 2.5,
    backgroundColor: 'rgba(56,189,248,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: { width: '100%', height: '100%', borderRadius: 34 },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0F172A',
  },
  textCol: { flex: 1, gap: 6 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: '#FFF' },
  description: { color: 'rgba(255,255,255,0.7)', lineHeight: 18 },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#38BDF8',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginTop: 4,
  },
  viewBtnText: { color: '#0F172A' },
});
