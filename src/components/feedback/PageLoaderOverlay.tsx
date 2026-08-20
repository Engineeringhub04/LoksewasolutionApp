// Reusable centered loading overlay with a custom label (e.g. "Loading Daily
// Test...", "Loading Syllabus..."). Shown ON TOP of the page's scrollable
// content (which stays mounted underneath so pull-to-refresh keeps working)
// during BOTH the initial load and any pull-to-refresh — not just once.
import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';

export function PageLoaderOverlay({
  visible,
  label,
  opaque = false,
  topOffset = 0,
}: {
  visible: boolean;
  label: string;
  opaque?: boolean;
  /** Keep fixed-header refresh indicators visible above the loader. */
  topOffset?: number;
}) {
  const { colors } = useTheme();
  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(200)}
      style={[styles.overlay, { top: topOffset }, opaque && { backgroundColor: colors.background }]}
      pointerEvents="none"
    >
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text variant="bodySmall" weight="semiBold" style={{ color: colors.textPrimary, marginTop: 10 }}>
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
    zIndex: 50,
  },
  card: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 22,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
