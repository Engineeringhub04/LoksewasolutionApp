// §11 Splash — first screen on launch; initializes app and routes correctly.
// Logo shows immediately. Onboarding images pre-cache in the background without delaying navigation.
// Uses expo-image (not RN's Image) for the logo — it decodes bundled assets faster
// and keeps them in its own memory cache, avoiding the visible delay RN's Image
// component has on first mount even for local require()'d assets.
import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, withTiming, useAnimatedStyle, Easing } from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';
import { AppConfig } from '@/src/core/config/appConfig';
import { fetchRemoteConfig } from '@/src/core/config/remoteConfig';
import { useNetworkStatus } from '@/src/core/hooks/useNetworkStatus';
import { useAuthStore } from '@/src/core/store/authStore';
import { useSettingsStore } from '@/src/core/store/settingsStore';
import { getRemoteImageUrls } from '@/src/core/firebase/services/onboarding';
import { DEFAULT_LEARNING_COURSE_ID, DEFAULT_LEARNING_SUBCOURSE_ID } from '@/src/core/firebase/services/learning';
import { prefetchHomeData } from '@/src/core/services/homePrefetch';
import { useProfileStore } from '@/src/core/store/profileStore';

const MIN_SPLASH_MS = 3000;

export default function SplashScreen() {
  const router = useRouter();
  const { gradients, spacing } = useTheme();
  const { isOnline, isChecked: networkChecked } = useNetworkStatus();
  const { user, initializing } = useAuthStore();
  const { hydrated, hydrate } = useSettingsStore();
  const routedRef = useRef(false);

  // Logo visible immediately — only subtle scale bounce
  const scale = useSharedValue(0.9);
  useEffect(() => {
    scale.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.back(1.5)) });
  }, [scale]);

  // Pre-cache onboarding network images in the background. This must never delay
  // the Splash -> Welcome/authenticated app transition.
  useEffect(() => {
    const urls = getRemoteImageUrls();
    if (urls.length > 0) {
      void Promise.all(urls.map((u) => ExpoImage.prefetch(u).catch(() => {})));
    }
  }, []);

  useEffect(() => { hydrate(); }, [hydrate]);

  // Keep Splash visible for at least three seconds. For an authenticated user,
  // Home's complete first snapshot is prefetched here so Home can render it
  // without issuing the same requests again after navigation.
  useEffect(() => {
    if (routedRef.current || initializing || !hydrated) return;

    const startedAt = Date.now();
    const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

    const decide = async () => {
      if (routedRef.current) return;
      // Force-update check intentionally removed for now (was causing a false-positive
      // block on some Android devices unrelated to any real version mismatch.
      const configPromise = fetchRemoteConfig();
      let homeReady: Promise<unknown> = Promise.resolve();

      if (user) {
        // Root layout also warms Profile. profileStore shares any in-flight request,
        // so this does not create duplicate profile/course reads during launch.
        await useProfileStore.getState().load(user.uid);
        const profileState = useProfileStore.getState();
        const courseId = profileState.courseInfo?.courseId
          ?? profileState.profile?.courseId
          ?? DEFAULT_LEARNING_COURSE_ID;
        const subcourseId = profileState.courseInfo?.subcourseId
          ?? profileState.profile?.subcourseId
          ?? DEFAULT_LEARNING_SUBCOURSE_ID;

        homeReady = prefetchHomeData({
          uid: user.uid,
          courseId,
          subcourseId,
        }).catch(() => undefined);
      }

      const [config] = await Promise.all([configPromise, homeReady]);
      const remaining = MIN_SPLASH_MS - (Date.now() - startedAt);
      if (remaining > 0) await sleep(remaining);
      if (routedRef.current) return;
      routedRef.current = true;

      if (config.maintenanceMode) { router.replace('/blocking/maintenance'); return; }
      // Only block for connectivity once NetInfo has actually reported a status.
      if (networkChecked && !isOnline && !user) { router.replace('/blocking/no-internet'); return; }
      if (user) { router.replace('/(tabs)'); return; }
      router.replace('/onboarding');
    };
    void decide();
  }, [initializing, hydrated, isOnline, networkChecked, user, router]);


  const insets = useSafeAreaInsets();
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <LinearGradient colors={gradients.splash} style={styles.container}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[styles.bubble, styles.bubbleTopRight]} />
        <View style={[styles.bubble, styles.bubbleMiddleLeft]} />
        <View style={[styles.bubble, styles.bubbleBottomRight]} />
        <View style={[styles.bubble, styles.bubbleBottomLeft]} />
        <View style={[styles.glow, styles.glowTopLeft]} />
      </View>

      <Animated.View style={[styles.content, animatedStyle]}>
        <View style={styles.brandRow}>
          <ExpoImage
            source={AppConfig.identity.splashAsset}
            style={styles.logo}
            contentFit="contain"
            cachePolicy="memory-disk"
            priority="high"
            transition={0}
          />
          <Text variant="h1" weight="bold" style={styles.appName}>{AppConfig.identity.appName}</Text>
        </View>
        <Text variant="body" style={styles.tagline}>{AppConfig.identity.tagline}</Text>
        <ActivityIndicator size="small" color="#D8E7FF" style={styles.spinner} />
      </Animated.View>

      <View style={[styles.footer, { bottom: insets.bottom + spacing.lg }]}>
        <Text variant="bodySmall" style={styles.developerLabel}>
          Develop for Nepali student || by <Text variant="bodySmall" weight="semiBold" style={styles.developerName}>Kishan Raut</Text>.
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  content: { width: '100%', alignItems: 'center', paddingHorizontal: 24 },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  logo: { width: 104, height: 104, transform: [{ scale: 1.04 }] },
  appName: { color: '#FFF', letterSpacing: 0.4, flexShrink: 1 },
  tagline: { color: '#D8E7FF', opacity: 0.92, marginTop: 24, textAlign: 'center' },
  spinner: { marginTop: 24 },
  footer: { position: 'absolute', alignItems: 'center', paddingHorizontal: 24 },
  developerLabel: { color: '#C9D9F5', opacity: 0.9, textAlign: 'center' },
  developerName: { color: '#C96B22' },
  bubble: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(123,177,255,0.10)' },
  bubbleTopRight: { width: 280, height: 280, top: -120, right: -100 },
  bubbleMiddleLeft: { width: 160, height: 160, top: '31%', left: -105 },
  bubbleBottomRight: { width: 220, height: 220, bottom: -100, right: -85 },
  bubbleBottomLeft: { width: 130, height: 130, bottom: -60, left: -60 },
  glow: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(75,181,255,0.08)' },
  glowTopLeft: { width: 150, height: 150, top: -70, left: -55 },
});
