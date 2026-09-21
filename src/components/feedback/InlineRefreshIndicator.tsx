// The in-content refresh indicator for screens whose headers are FIXED
// overlays — Home and Profile.
//
// WHY THIS EXISTS
// A native RefreshControl spinner renders inside the ScrollView, and on these
// two screens that is directly BEHIND the fixed header: the user pulls, holds,
// and sees nothing happen. progressViewOffset only shifts the spinner down far
// enough to be invisible again on the other side. So these screens show a small
// inline row instead — the first thing under the header — exactly like the
// platforms' own "pull to refresh" affordance, and the native spinner is
// suppressed (these screens pass no refreshing state to their RefreshControl).
//
// The row is height-stable: it animates opacity only, so content never jumps
// when it appears or leaves.
import React from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';

/** Copy shown beside the spinner while a refresh is in flight. */
const REFRESH_LABELS = {
  en: 'Refreshing...',
  ne: 'रिफ्रेस हुँदैछ...',
} as const;

/**
 * iOS ONLY. Android gets the native RefreshControl spinner (it renders below
 * the fixed header correctly there), so on Android this renders nothing and the
 * screens keep `refreshing` wired into their AppRefreshControl.
 */
export function InlineRefreshIndicator({ visible, language = 'en' }: { visible: boolean; language?: 'en' | 'ne' }) {
  const { colors, spacing } = useTheme();

  if (Platform.OS !== 'ios' || !visible) return null;

  return (
    <Animated.View entering={FadeIn.duration(140)} exiting={FadeOut.duration(180)}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingVertical: spacing.sm,
          marginBottom: spacing.xs,
        }}
      >
        <ActivityIndicator size="small" color={colors.primary} />
        <Text variant="caption" secondary>{REFRESH_LABELS[language]}</Text>
      </View>
    </Animated.View>
  );
}
