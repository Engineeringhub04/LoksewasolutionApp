// Shared curved blue gradient header used across sub-pages (Course Setup style).
// Bigger than the flat TopAppBar, with an optional back button, title, and a
// right-side actions slot (theme toggle, icons, etc).
import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Text } from '@/src/components/misc/Text';

export interface SubpageHeaderProps {
  title: string;
  showBack?: boolean;
  onBackPress?: () => void;
  rightSlot?: React.ReactNode;
  gradientColors?: readonly [string, string, ...string[]];
}

export function SubpageHeader({
  title,
  showBack = true,
  onBackPress,
  rightSlot,
  gradientColors = ['#1D4ED8', '#2563EB', '#3B82F6'],
}: SubpageHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient colors={gradientColors} style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <Animated.View entering={FadeIn.duration(300)} style={styles.row}>
        {showBack ? (
          <Pressable onPress={onBackPress ?? (() => router.back())} style={styles.iconBox} accessibilityLabel="Back">
            <Ionicons name="arrow-back" size={20} color="#FFF" />
          </Pressable>
        ) : (
          <View style={styles.iconBox} />
        )}
        <Text variant="h2" weight="bold" style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.rightSlot}>{rightSlot ?? <View style={styles.iconBox} />}</View>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: { paddingBottom: 20, borderBottomLeftRadius: 26, borderBottomRightRadius: 26 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  iconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#FFF', fontSize: 18, flex: 1, textAlign: 'center' },
  rightSlot: { alignItems: 'flex-end' },
});
