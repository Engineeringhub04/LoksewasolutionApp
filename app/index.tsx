// §11 Splash — first screen on launch; initializes app and routes correctly.
// Pre-caches onboarding network images in background for offline-first experience.
import React, { useEffect, useRef } from 'react';
import { View, Image, ActivityIndicator } from 'react-native';
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

const MAX_SPLASH_MS = 4000;

export default function SplashScreen() {
  const router = useRouter();
  const { gradients, spacing } = useTheme();
  const { isOnline } = useNetworkStatus();
  const { user, initializing } = useAuthStore();
  const { hydrated, hydrate } = useSettingsStore();
  const routedRef = useRef(false);

  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.85);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.ease) });
    scale.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.back(1.2)) });
  }, [opacity, scale]);

  // Pre-cache onboarding network images in background for seamless experience
  useEffect(() => {
    const remoteUrls = getRemoteImageUrls();
    if (remoteUrls.length > 0) {
      ExpoImage.prefetch(remoteUrls).catch(() => {
        // Silent fail — images will load on demand if pre-cache fails
      });
    }
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (routedRef.current) return;

    const decide = async () => {
      const config = await fetchRemoteConfig();

      if (routedRef.current) return;
      routedRef.current = true;

      if (config.maintenanceMode) {
        router.replace('/blocking/maintenance');
        return;
      }
      if (isVersionBelow(AppConfig.identity.version, config.minimumVersion)) {
        router.replace('/blocking/update-required');
        return;
      }
      if (!isOnline && !user) {
        router.replace('/blocking/no-internet');
        return;
      }
      if (user) {
        router.replace('/(tabs)');
        return;
      }
      // Always show onboarding when not logged in (not just first time)
      router.replace('/onboarding');
    };

    // Wait for auth + settings hydration, but never block longer than MAX_SPLASH_MS.
    const boundedTimeout = setTimeout(() => {
      if (!routedRef.current) decide();
    }, MAX_SPLASH_MS);

    if (!initializing && hydrated) {
      clearTimeout(boundedTimeout);
      decide();
    }

    return () => clearTimeout(boundedTimeout);
  }, [initializing, hydrated, isOnline, user, router]);

  const insets = useSafeAreaInsets();

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <LinearGradient
      colors={gradients.splash}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
    >
      <Animated.View style={[{ alignItems: 'center', gap: spacing.sm }, animatedStyle]}>
        <View
          style={{
            width: 140,
            height: 140,
            borderRadius: 32,
            backgroundColor: '#FFFFFF',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.25,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
            elevation: 8,
          }}
        >
          <Image source={AppConfig.identity.logoAsset} style={{ width: 104, height: 104 }} resizeMode="contain" />
        </View>
        <Text variant="h1" weight="bold" style={{ color: '#FFFFFF', marginTop: spacing.md }}>
          {AppConfig.identity.appName}
        </Text>
        <Text variant="body" style={{ color: '#FFFFFF', opacity: 0.8 }}>
          {AppConfig.identity.tagline}
        </Text>
        <ActivityIndicator size="large" color="#FFFFFF" style={{ marginTop: spacing.lg }} />
      </Animated.View>

      <View style={{ position: 'absolute', bottom: insets.bottom + spacing.lg, alignItems: 'center' }}>
        <Text variant="bodySmall" style={{ color: '#FFFFFF', opacity: 0.75 }}>
          Made for Nepali Student 🇳🇵 | by <Text variant="bodySmall" weight="semiBold" style={{ color: '#00C8FF' }}>Kishan Raut</Text>
        </Text>
      </View>
    </LinearGradient>
  );
}
