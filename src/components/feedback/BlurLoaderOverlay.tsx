// Full-screen "working…" overlay that DIMS AND BLURS whatever is behind it,
// instead of hiding the page under an opaque sheet. Used when submitting a Daily
// Test: the quiz stays faintly visible behind the blur while the result saves.
//
// expo-blur's Android implementation is still opt-in on SDK 54 (it needs
// `experimentalBlurMethod="dimezisBlurView"`), and it renders nothing at all on
// some devices — so a translucent scrim is layered underneath as well. That way
// the "lightly dimmed, faded background" reads correctly on every platform, with
// real blur on top wherever the OS can do it.
import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';

export function BlurLoaderOverlay({
  visible,
  label,
  intensity = 26,
}: {
  visible: boolean;
  label: string;
  /** 1–100. Kept low: the overlay is short-lived, so cheap is better. */
  intensity?: number;
}) {
  const { colors, effective } = useTheme();
  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(180)}
      style={styles.overlay}
      pointerEvents="auto"
    >
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: effective === 'dark' ? 'rgba(3,7,18,0.55)' : 'rgba(15,23,42,0.32)' },
        ]}
      />
      <BlurView
        intensity={intensity}
        tint={effective === 'dark' ? 'dark' : 'light'}
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text
          variant="bodySmall"
          weight="semiBold"
          style={{ color: colors.textPrimary, marginTop: 12, textAlign: 'center' }}
        >
          {label}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 80,
  },
  card: {
    minWidth: 190,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 24,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
});
