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

const MAX_SPLASH_MS = 6000;

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

  // Navigate once everything is ready
  useEffect(() => {
    if (routedRef.current || initializing || !hydrated) return;

    const decide = async () => {
      if (routedRef.current) return;
      // Force-update check intentionally removed for now (was causing a false-positive
      // block on some Android devices unrelated to any real version mismatch — see PR
      // history #17/#18 for the investigation). Maintenance mode is kept since it's a
      // simple, rarely-toggled admin switch. Force-update can be reintroduced later,
      // closer to an actual production release, with a more robust check.
      const config = await fetchRemoteConfig();
      if (routedRef.current) return;
      routedRef.current = true;

      if (config.maintenanceMode) { router.replace('/blocking/maintenance'); return; }
      // Only block for connectivity once NetInfo has actually reported a status
      // (networkChecked). Without that condition the store's optimistic default could
      // be misread and a signed-out user could get pushed to the No Internet screen on
      // a working connection.
      if (networkChecked && !isOnline && !user) { router.replace('/blocking/no-internet'); return; }
      if (user) { router.replace('/(tabs)'); return; }
      router.replace('/onboarding');
    };
    decide();
  }, [initializing, hydrated, isOnline, networkChecked, user, router]);

  // Safety timeout
  useEffect(() => {
    const t = setTimeout(() => {
      if (!routedRef.current) {
        routedRef.current = true;
        router.replace(user ? '/(tabs)' : '/onboarding');
      }
    }, MAX_SPLASH_MS);
    return () => clearTimeout(t);
  }, [user, router]);

  const insets = useSafeAreaInsets();
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <LinearGradient colors={gradients.splash} style={styles.container}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[styles.bubble, styles.bubbleTopRight]} />
        <View style={[styles.bubble, styles.bubbleMiddleLeft]} />
        <View style={[styles.bubble, styles.bubbleBottomRight]} />
        <View style={[styles.glow, styles.glowCenter]} />
      </View>

      <Animated.View style={[styles.content, animatedStyle]}>
        <View style={styles.logoFrame}>
          <ExpoImage
            source={AppConfig.identity.splashAsset}
            style={styles.logo}
            contentFit="contain"
            cachePolicy="memory-disk"
            priority="high"
            transition={0}
          />
        </View>
        <Text variant="h1" weight="bold" style={styles.appName}>{AppConfig.identity.appName}</Text>
        <Text variant="body" style={styles.tagline}>Learn Today, Lead Tomorrow</Text>
        <ActivityIndicator size="small" color="#D8E7FF" style={styles.spinner} />
      </Animated.View>

      <View style={[styles.footer, { bottom: insets.bottom + spacing.lg }]}>
        <Text variant="bodySmall" style={styles.developerLabel}>Developed with dedication for Loksewa aspirants</Text>
        <Text variant="bodySmall" weight="semiBold" style={styles.developerName}>Developed by Loksewa Solution Team</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  content: { alignItems: 'center' },
  logoFrame: {
    width: 156,
    height: 156,
    borderRadius: 78,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  logo: { width: 144, height: 144, transform: [{ scale: 1.04 }] },
  appName: { color: '#FFF', marginTop: 22, letterSpacing: 0.4 },
  tagline: { color: '#D8E7FF', opacity: 0.92, marginTop: 6 },
  spinner: { marginTop: 24 },
  footer: { position: 'absolute', alignItems: 'center', paddingHorizontal: 24 },
  developerLabel: { color: '#C9D9F5', opacity: 0.86, textAlign: 'center' },
  developerName: { color: '#8ED8FF', marginTop: 5 },
  bubble: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(123,177,255,0.10)' },
  bubbleTopRight: { width: 320, height: 320, top: -120, right: -100 },
  bubbleMiddleLeft: { width: 180, height: 180, top: '38%', left: -110 },
  bubbleBottomRight: { width: 240, height: 240, bottom: -100, right: -90 },
  glow: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(75,181,255,0.10)' },
  glowCenter: { width: 220, height: 220, top: '42%', left: '24%' },
});
