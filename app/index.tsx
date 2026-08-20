// §11 Splash — first screen on launch; initializes app and routes correctly.
// Logo shows immediately. Onboarding images pre-cache in the background without delaying navigation.
// Uses expo-image (not RN's Image) for the logo — it decodes bundled assets faster
// and keeps them in its own memory cache, avoiding the visible delay RN's Image
// component has on first mount even for local require()'d assets.
import React, { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, withTiming, useAnimatedStyle, Easing } from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
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
  const { gradients } = useTheme();
  const { isOnline, isChecked: networkChecked } = useNetworkStatus();
  const { user, initializing } = useAuthStore();
  const { hydrated, hydrate } = useSettingsStore();
  const routedRef = useRef(false);

  // Match the supplied HTML artwork fade-in without changing navigation timing.
  const scale = useSharedValue(1.008);
  const opacity = useSharedValue(0);
  useEffect(() => {
    scale.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
    opacity.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
  }, [opacity, scale]);

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


  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <LinearGradient colors={gradients.splash} style={styles.container}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.artworkLayer, animatedStyle]}>
        <ExpoImage
          source={AppConfig.identity.splashArtworkAsset}
          style={styles.artwork}
          contentFit="cover"
          cachePolicy="memory-disk"
          priority="high"
          transition={0}
        />
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden', backgroundColor: '#03145C' },
  artworkLayer: { alignItems: 'center', justifyContent: 'center' },
  artwork: { width: '100%', height: '100%' },
});
