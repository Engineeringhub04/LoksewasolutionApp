// §11 Splash — first screen on launch; initializes app and routes correctly.
// Logo shows immediately. Onboarding images pre-cache in the background without delaying navigation.
// Uses expo-image for the bundled transparent logo so it decodes quickly on first mount.
import React, { useEffect, useRef } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, withTiming, useAnimatedStyle, Easing } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle, Path } from 'react-native-svg';
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
const DECORATION_COLOR = '#76A9FF';

function BackgroundIcon({
  name,
  size,
  style,
}: {
  name: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  size: number;
  style: object;
}) {
  return (
    <MaterialCommunityIcons
      name={name}
      size={size}
      color={DECORATION_COLOR}
      style={[styles.backgroundIcon, style]}
    />
  );
}

function SplashDecorations() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <BackgroundIcon name="book-open-page-variant" size={112} style={styles.openBook} />
      <BackgroundIcon name="bank" size={106} style={styles.governmentBuilding} />
      <BackgroundIcon name="bullseye-arrow" size={92} style={styles.target} />
      <BackgroundIcon name="chart-line" size={94} style={styles.chart} />
      <BackgroundIcon name="bookshelf" size={92} style={styles.bookshelf} />
      <BackgroundIcon name="school-outline" size={104} style={styles.graduationCap} />

      <Svg pointerEvents="none" style={styles.dottedPath} viewBox="0 0 460 220">
        <Path
          d="M55 10 C86 80 160 87 228 122 C302 160 373 187 470 180"
          fill="none"
          stroke={DECORATION_COLOR}
          strokeDasharray="3 10"
          strokeLinecap="round"
          strokeWidth={1.4}
          opacity={0.24}
        />
      </Svg>

      <Svg pointerEvents="none" style={styles.waveLines} viewBox="0 0 520 300">
        <Path d="M-35 24 C92 -3 220 54 322 144 C405 218 455 252 560 265" fill="none" stroke={DECORATION_COLOR} strokeWidth={1.2} opacity={0.19} />
        <Path d="M-30 38 C96 11 224 69 329 157 C412 226 464 264 560 278" fill="none" stroke={DECORATION_COLOR} strokeWidth={1.2} opacity={0.16} />
        <Path d="M-20 54 C103 27 234 84 340 171 C423 237 477 275 555 290" fill="none" stroke={DECORATION_COLOR} strokeWidth={1.1} opacity={0.13} />
        <Path d="M-8 70 C114 43 244 98 350 184 C432 249 483 284 550 300" fill="none" stroke={DECORATION_COLOR} strokeWidth={1} opacity={0.1} />
      </Svg>

      <Svg pointerEvents="none" style={styles.dots} viewBox="0 0 100 100">
        <Circle cx="10" cy="25" r="2.1" fill="none" stroke={DECORATION_COLOR} strokeWidth="0.9" opacity="0.35" />
        <Circle cx="62" cy="27" r="1.5" fill="none" stroke={DECORATION_COLOR} strokeWidth="0.8" opacity="0.3" />
        <Circle cx="89" cy="47" r="2.1" fill="none" stroke={DECORATION_COLOR} strokeWidth="0.9" opacity="0.28" />
        <Circle cx="76" cy="79" r="1.5" fill="none" stroke={DECORATION_COLOR} strokeWidth="0.8" opacity="0.25" />
      </Svg>
    </View>
  );
}

export default function SplashScreen() {
  const router = useRouter();
  const { isOnline, isChecked: networkChecked } = useNetworkStatus();
  const { user, initializing } = useAuthStore();
  const { hydrated, hydrate } = useSettingsStore();
  const routedRef = useRef(false);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // Native equivalent of the supplied HTML artwork fade-in. This is visual only;
  // it does not change Splash routing or the data-ready timing below.
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

  const logoWidth = Math.min(width * 0.84, 340);
  const logoHeight = logoWidth * 0.74;
  const glowSize = Math.min(width * 0.88, 380);
  const innerGlowSize = Math.min(width * 0.66, 285);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <LinearGradient colors={['#061A73', '#062C91', '#03145C']} style={styles.container}>
      <SplashDecorations />

      <View pointerEvents="none" style={[styles.glow, styles.outerGlow, { width: glowSize, height: glowSize, marginLeft: -glowSize / 2 }]} />
      <View pointerEvents="none" style={[styles.glow, styles.innerGlow, { width: innerGlowSize, height: innerGlowSize, marginLeft: -innerGlowSize / 2 }]} />

      <Animated.View style={[styles.brandContent, animatedStyle]}>
        <ExpoImage
          source={AppConfig.identity.splashAsset}
          style={{ width: logoWidth, height: logoHeight }}
          contentFit="contain"
          cachePolicy="memory-disk"
          priority="high"
          transition={0}
        />
        <Text variant="h1" weight="bold" style={styles.appName}>Loksewa Solution</Text>
        <Text variant="body" style={styles.tagline}>Prepare Today. Lead Tomorrow.</Text>
      </Animated.View>

      <View style={[styles.footer, { bottom: insets.bottom + 18 }]}>
        <Text variant="bodySmall" style={styles.developerLabel}>
          Develop for Nepali student <Text variant="bodySmall" style={styles.flag}>🇳🇵</Text> || by <Text variant="bodySmall" weight="semiBold" style={styles.developerName}>Kishan Raut</Text>.
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden', backgroundColor: '#03145C' },
  backgroundIcon: { position: 'absolute', opacity: 0.16 },
  openBook: { top: '12%', left: -18 },
  governmentBuilding: { top: '13%', right: 18 },
  target: { top: '30%', left: '13%' },
  chart: { top: '43%', right: 18 },
  bookshelf: { bottom: '13%', left: 32 },
  graduationCap: { bottom: '14%', right: 27 },
  dottedPath: { position: 'absolute', width: '118%', height: 220, top: '13%', right: '-20%' },
  waveLines: { position: 'absolute', width: '125%', height: 300, bottom: -16, left: '-7%' },
  dots: { position: 'absolute', width: '100%', height: '100%', top: 0, left: 0 },
  glow: { position: 'absolute', borderRadius: 999 },
  outerGlow: { top: '25%', left: '50%', backgroundColor: 'rgba(70, 155, 255, 0.09)', shadowColor: '#72B3FF', shadowOpacity: 0.28, shadowRadius: 42, elevation: 8 },
  innerGlow: { top: '29%', left: '50%', backgroundColor: 'rgba(104, 190, 255, 0.14)', shadowColor: '#D8EEFF', shadowOpacity: 0.38, shadowRadius: 28, elevation: 10 },
  brandContent: { position: 'absolute', top: '17%', width: '100%', alignItems: 'center', paddingHorizontal: 22 },
  appName: { marginTop: 18, color: '#FFFFFF', letterSpacing: 0.2, textAlign: 'center' },
  tagline: { marginTop: 8, color: '#F0F6FF', fontWeight: '600', textAlign: 'center' },
  footer: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: 18 },
  developerLabel: { color: '#D7E3FF', opacity: 0.94, textAlign: 'center' },
  flag: { fontSize: 14 },
  developerName: { color: '#F0A04B' },
});
