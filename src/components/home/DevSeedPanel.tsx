// Small dev-only seed panel on Home for quickly populating banner slides and
// the About Developer profile in Firestore while testing. Two compact chips —
// tap to seed, shows a spinner while running.
import React, { useState } from 'react';
import { View, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { isFirebaseConfigured } from '@/src/core/firebase/env';
import { seedHomeBanners } from '@/src/core/firebase/services/banners';
import { seedDeveloperData } from '@/src/core/firebase/services/developer';
import { showToast } from '@/src/core/store/toastStore';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';

export function DevSeedPanel({ onSeeded }: { onSeeded?: () => void }) {
  const { colors, radius } = useTheme();
  const [seedingBanners, setSeedingBanners] = useState(false);
  const [seedingDeveloper, setSeedingDeveloper] = useState(false);

  const handleSeedBanners = async () => {
    if (!isFirebaseConfigured) { showToast('Firebase is not configured', 'warning'); return; }
    setSeedingBanners(true);
    try {
      await seedHomeBanners();
      showToast('Home banners seeded', 'success');
      onSeeded?.();
    } catch {
      showToast('Failed to seed banners', 'error');
    } finally {
      setSeedingBanners(false);
    }
  };

  const handleSeedDeveloper = async () => {
    if (!isFirebaseConfigured) { showToast('Firebase is not configured', 'warning'); return; }
    setSeedingDeveloper(true);
    try {
      await seedDeveloperData();
      showToast('Developer profile seeded', 'success');
      onSeeded?.();
    } catch {
      showToast('Failed to seed developer profile', 'error');
    } finally {
      setSeedingDeveloper(false);
    }
  };

  return (
    <View style={styles.row}>
      <Pressable onPress={handleSeedBanners} disabled={seedingBanners} style={[styles.chip, { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill }]}>
        {seedingBanners ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="images-outline" size={14} color={colors.primary} />}
        <Text variant="caption" weight="semiBold" style={{ color: colors.primary }}>Seed Banners</Text>
      </Pressable>
      <Pressable onPress={handleSeedDeveloper} disabled={seedingDeveloper} style={[styles.chip, { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill }]}>
        {seedingDeveloper ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="person-circle-outline" size={14} color={colors.primary} />}
        <Text variant="caption" weight="semiBold" style={{ color: colors.primary }}>Seed Developer</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 10, marginBottom: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7 },
});
