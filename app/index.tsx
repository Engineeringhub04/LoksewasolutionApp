// §11 Splash — first screen on launch; initializes app and routes correctly.
// Logo shows immediately. Onboarding images pre-cache in the background without delaying navigation.
// Uses expo-image (not RN's Image) for the logo — it decodes bundled assets faster
// and keeps them in its own memory cache, avoiding the visible delay RN's Image
// component has on first mount even for local require()'d assets.
import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
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
    <LinearGradient colors={gradients.splash} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ alignItems: 'center', gap: spacing.sm }, animatedStyle]}>
        <View style={{ width: 150, height: 150, borderRadius: 75, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
          <ExpoImage
            source={AppConfig.identity.logoAsset}
            style={{ width: 178, height: 178, borderRadius: 89, transform: [{ scale: 1.06 }] }}
            contentFit="cover"
            cachePolicy="memory-disk"
            priority="high"
            transition={0}
          />
        </View>
        <Text variant="h1" weight="bold" style={{ color: '#FFF', marginTop: spacing.md }}>{AppConfig.identity.appName}</Text>
        <Text variant="body" style={{ color: '#FFF', opacity: 0.8 }}>{AppConfig.identity.tagline}</Text>
        <ActivityIndicator size="large" color="#FFF" style={{ marginTop: spacing.lg }} />
      </Animated.View>
      <View style={{ position: 'absolute', bottom: insets.bottom + spacing.lg, alignItems: 'center' }}>
        <Text variant="bodySmall" style={{ color: '#FFF', opacity: 0.75 }}>
          Made for Nepali Students 🇳🇵 | by <Text variant="bodySmall" weight="semiBold" style={{ color: '#00C8FF' }}>Kishan Raut</Text>
        </Text>
      </View>
    </LinearGradient>
  );
}
