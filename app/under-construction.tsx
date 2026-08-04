// Fallback destination for feature buttons that don't have a real page yet.
// Pass ?page=Feature Name to customize the title shown.
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { useSharedValue, withTiming, useAnimatedStyle, Easing, FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';

export default function UnderConstructionScreen() {
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ page?: string }>();
  const pageName = params.page ?? 'This Feature';

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(50, { duration: 1200, easing: Easing.out(Easing.cubic) });
  }, [progress]);

  const progressStyle = useAnimatedStyle(() => ({ width: `${progress.value}%` }));

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SubpageHeader title={pageName} />
      <View style={styles.body}>
        <Animated.View entering={FadeInDown.duration(400)} style={styles.content}>
          <View style={[styles.iconCircle, { backgroundColor: colors.surfaceAlt }]}>
            <Ionicons name="construct-outline" size={56} color={colors.accent} />
          </View>

          <Text variant="h2" weight="bold" style={{ color: colors.textPrimary, marginTop: spacing.lg, textAlign: 'center' }}>
            {pageName}
          </Text>

          <View style={{ width: '100%', marginTop: spacing.lg, gap: spacing.xs }}>
            <View style={{ height: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
              <Animated.View style={[{ height: '100%', backgroundColor: colors.accent, borderRadius: radius.pill }, progressStyle]} />
            </View>
            <Text variant="caption" secondary style={{ textAlign: 'right' }}>50% complete</Text>
          </View>

          <Text variant="body" secondary style={{ textAlign: 'center', marginTop: spacing.lg, lineHeight: 22 }}>
            We're working hard to bring this feature to you. It's currently under construction and will be available in an upcoming update. Thanks for your patience!
          </Text>

          <Button label="Go Back" onPress={() => router.back()} style={{ marginTop: spacing.xl }} fullWidth={false} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  content: { alignItems: 'center', width: '100%' },
  iconCircle: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center' },
});
