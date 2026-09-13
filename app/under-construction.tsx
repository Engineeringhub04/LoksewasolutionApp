// Fallback destination for feature buttons that don't have a real page yet.
// Pass ?page=Feature Name to customize the title shown.
//
// Shared by every not-yet-built feature — Nepal Details, Upcoming Exam, Others,
// and (since that feature was removed on 2026-09-13) Current Affairs.
//
// Premium pass: brand-blue gradient disc with a slow breathing halo, an amber
// "in progress" badge, a gradient progress bar, and bilingual copy pulled from
// i18n. The copy used to be hardcoded English, so the Nepali toggle did nothing
// on this screen; the "Go Back" action also moved off a pinned bottom bar and
// into the card, since the header already carries a back arrow.
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';
import { Text } from '@/src/components/misc/Text';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';

const PROGRESS_PERCENT = 50;

export default function UnderConstructionScreen() {
  const { colors, spacing, radius, elevation, gradients, effective } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ page?: string }>();
  const pageName = params.page ?? 'This Feature';
  const isDark = effective === 'dark';

  const [refreshing, setRefreshing] = useState(false);
  const progress = useSharedValue(0);
  const halo = useSharedValue(0);

  const playProgressAnimation = useCallback(() => {
    progress.value = 0;
    progress.value = withTiming(PROGRESS_PERCENT, { duration: 1200, easing: Easing.out(Easing.cubic) });
  }, [progress]);

  // Animate on first mount...
  useEffect(() => {
    playProgressAnimation();
  }, [playProgressAnimation]);

  // Slow breathing halo behind the icon. Deliberately not a spinner — a spinner
  // here reads as "loading", and this page is never loading anything.
  useEffect(() => {
    halo.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [halo]);

  // ...and again whenever the user pulls to refresh.
  const onRefresh = () => {
    setRefreshing(true);
    playProgressAnimation();
    setTimeout(() => setRefreshing(false), 800);
  };

  const progressStyle = useAnimatedStyle(() => ({ width: `${progress.value}%` }));
  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + halo.value * 0.16 }],
    opacity: 0.3 - halo.value * 0.18,
  }));

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SubpageHeader title={pageName} showBack showThemeToggle />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { padding: spacing.lg }]}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={FadeInDown.duration(420)}
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, elevation[2]]}
        >
          <View style={styles.discWrap}>
            <Animated.View style={[styles.halo, { backgroundColor: colors.primary }, haloStyle]} />
            <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.disc}>
              <Ionicons name="construct" size={40} color="#FFFFFF" />
            </LinearGradient>
          </View>

          <View style={[styles.badge, { backgroundColor: isDark ? 'rgba(245,158,11,0.18)' : 'rgba(245,158,11,0.14)' }]}>
            <Ionicons name="hammer" size={12} color={colors.accent} />
            <Text variant="overline" weight="bold" style={{ color: colors.accent, letterSpacing: 0.8 }}>
              {t('underConstruction.badge').toUpperCase()}
            </Text>
          </View>

          <View style={styles.titleBlock}>
            <Text variant="h1" weight="bold" style={styles.center}>
              {pageName}
            </Text>
            <Text variant="bodyLarge" weight="semiBold" style={[styles.center, { color: colors.primary }]}>
              {t('underConstruction.heading')}
            </Text>
          </View>

          <Text variant="body" secondary style={[styles.center, styles.body]}>
            {t('underConstruction.body')}
          </Text>

          <View style={styles.progressBlock}>
            <View style={[styles.track, { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill }]}>
              <Animated.View style={[styles.fillWrap, progressStyle]}>
                {/* Brand blue into the amber accent, so the bar itself carries
                    the app's palette instead of a flat single colour. */}
                <LinearGradient
                  colors={[colors.primary, colors.accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.fill}
                />
              </Animated.View>
            </View>
            <Text variant="caption" secondary style={styles.progressLabel}>
              {t('underConstruction.progress', { percent: PROGRESS_PERCENT })}
            </Text>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          <Text variant="bodySmall" secondary style={styles.center}>
            {t('underConstruction.note')}
          </Text>

          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.backButton,
              { backgroundColor: colors.primary, borderRadius: radius.pill, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Ionicons name="arrow-back" size={16} color={colors.onPrimary} />
            <Text variant="bodySmall" weight="bold" style={{ color: colors.onPrimary }}>
              {t('underConstruction.goBack')}
            </Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 28,
    gap: 15,
  },
  discWrap: { alignItems: 'center', justifyContent: 'center' },
  // Sits behind the disc and breathes outward. Absolute so it never adds layout
  // height as it scales.
  halo: { position: 'absolute', width: 96, height: 96, borderRadius: 48 },
  disc: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999 },
  titleBlock: { alignItems: 'center', gap: 5 },
  center: { textAlign: 'center' },
  body: { lineHeight: 22 },
  progressBlock: { width: '100%', gap: 6, marginTop: 2 },
  track: { height: 10, overflow: 'hidden' },
  fillWrap: { height: '100%' },
  fill: { flex: 1 },
  progressLabel: { textAlign: 'right' },
  divider: { width: '100%', height: StyleSheet.hairlineWidth, marginTop: 2 },
  backButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 11, marginTop: 4 },
});
