// §11 Splash — first screen on launch; initializes app and routes correctly.
// Logo shows IMMEDIATELY. Waits for onboarding images to pre-cache before navigating.
// Uses expo-image (not RN's Image) for the logo — it decodes bundled assets faster
// and keeps them in its own memory cache, avoiding the visible delay RN's Image
// component has on first mount even for local require()'d assets.
import React, { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, withTiming, useAnimatedStyle, Easing } from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';
import { AppConfig } from '@/src/core/config/appConfig';
import { fetchRemoteConfig, isVersionBelow } from '@/src/core/config/remoteConfig';
import { useNetworkStatus } from '@/src/core/hooks/useNetworkStatus';
import { useAuthStore } from '@/src/core/store/authStore';
import { useSettingsStore } from '@/src/core/store/settingsStore';
import { getRemoteImageUrls } from '@/src/core/firebase/services/onboarding';

const MAX_SPLASH_MS = 6000;

export default function SplashScreen() {
  const router = useRouter();
  const { gradients, spacing } = useTheme();
  const { isOnline } = useNetworkStatus();
  const { user, initializing } = useAuthStore();
  const { hydrated, hydrate } = useSettingsStore();
  const routedRef = useRef(false);
  const [imagesCached, setImagesCached] = useState(false);

  // Logo visible immediately — only subtle scale bounce
  const scale = useSharedValue(0.9);
  useEffect(() => {
    scale.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.back(1.5)) });
  }, [scale]);

  // Pre-cache onboarding network images — splash stays until done
  useEffect(() => {
    const urls = getRemoteImageUrls();
    if (urls.length > 0) {
      Promise.all(urls.map((u) => ExpoImage.prefetch(u).catch(() => {})))
        .finally(() => setImagesCached(true));
    } else {
      setImagesCached(true);
    }
  }, []);

  useEffect(() => { hydrate(); }, [hydrate]);

  // Navigate once everything is ready
  useEffect(() => {
    if (routedRef.current || initializing || !hydrated || !imagesCached) return;

    const decide = async () => {
      if (routedRef.current) return;
      const config = await fetchRemoteConfig();
      if (routedRef.current) return;
      routedRef.current = true;

      if (config.maintenanceMode) { router.replace('/blocking/maintenance'); return; }
      if (isVersionBelow(AppConfig.identity.version, config.minimumVersion)) {
        if (__DEV__) {
          // Diagnostic: this check is 100% platform-agnostic (no Platform.OS branching
          // anywhere in the force-update path) — current app version and remote
          // minimumVersion are both single, unified values, not split per-platform.
          // If Android/iOS diverge on whether this screen shows, it means one device
          // is running a stale JS bundle, or the remote `meta/appConfig` Firestore doc
          // was different at the time each device checked it — it is NOT caused by any
          // per-platform code difference. Logged here to make that visible while
          // debugging on-device without a debugger attached.
          console.warn(
            `[ForceUpdate] Blocking app: current version "${AppConfig.identity.version}" ` +
              `is below remote minimumVersion "${config.minimumVersion}" (from meta/appConfig).`
          );
        }
        router.replace('/blocking/update-required');
        return;
      }
      if (!isOnline && !user) { router.replace('/blocking/no-internet'); return; }
      if (user) { router.replace('/(tabs)'); return; }
      router.replace('/onboarding');
    };
    decide();
  }, [initializing, hydrated, imagesCached, isOnline, user, router]);

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
        <View style={{ width: 150, height: 150, borderRadius: 34, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 }}>
          <ExpoImage
            source={AppConfig.identity.logoAsset}
            style={{ width: 122, height: 122 }}
            contentFit="contain"
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
