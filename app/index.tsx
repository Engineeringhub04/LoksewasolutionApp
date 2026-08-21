// §11 Splash — first screen on launch; initializes app and routes correctly.
// Logo shows immediately. Onboarding images pre-cache in the background without delaying navigation.
// Uses the native bundled image renderer for the local logo so it has no remote-style transition.
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Image as NativeImage, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Line, Path, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';
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

type BackgroundIconKind = 'book' | 'bank' | 'target' | 'chart' | 'bookshelf' | 'graduation';

function BackgroundIcon({
  kind,
  size,
  style,
}: {
  kind: BackgroundIconKind;
  size: number;
  style: object;
}) {
  const stroke = DECORATION_COLOR;
  const common = { fill: 'none', stroke, strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" pointerEvents="none" style={[styles.backgroundIcon, style]}>
      {kind === 'book' && (
        <>
          <Path d="M8 20 C23 13 38 16 50 27 V81 C37 71 23 68 8 75 Z" {...common} />
          <Path d="M92 20 C77 13 62 16 50 27 V81 C63 71 77 68 92 75 Z" {...common} />
          <Path d="M50 27 V81" {...common} />
          <Path d="M17 31 C27 27 36 29 43 34 M17 42 C27 38 36 40 43 45 M57 34 C64 29 73 27 83 31 M57 45 C64 40 73 38 83 42" {...common} opacity={0.7} />
        </>
      )}
      {kind === 'bank' && (
        <>
          <Path d="M8 29 L50 10 L92 29 Z" {...common} />
          <Line x1="13" y1="34" x2="87" y2="34" {...common} />
          <Line x1="19" y1="36" x2="19" y2="72" {...common} />
          <Line x1="37" y1="36" x2="37" y2="72" {...common} />
          <Line x1="63" y1="36" x2="63" y2="72" {...common} />
          <Line x1="81" y1="36" x2="81" y2="72" {...common} />
          <Path d="M12 77 H88 M7 84 H93" {...common} />
        </>
      )}
      {kind === 'target' && (
        <>
          <Circle cx="46" cy="54" r="28" {...common} />
          <Circle cx="46" cy="54" r="17" {...common} />
          <Circle cx="46" cy="54" r="6" {...common} />
          <Path d="M20 79 L78 21 M64 21 H78 V35" {...common} />
        </>
      )}
      {kind === 'chart' && (
        <>
          <Path d="M12 83 H90 M16 83 V25" {...common} />
          <Rect x="26" y="59" width="10" height="24" {...common} />
          <Rect x="44" y="48" width="10" height="35" {...common} />
          <Rect x="62" y="35" width="10" height="48" {...common} />
          <Path d="M20 57 C37 58 42 45 54 48 C66 51 71 29 84 25 M75 25 H84 V34" {...common} />
        </>
      )}
      {kind === 'bookshelf' && (
        <>
          <Path d="M12 78 H88 M8 86 H92" {...common} />
          <Rect x="18" y="39" width="12" height="39" {...common} />
          <Rect x="34" y="30" width="12" height="48" {...common} transform="rotate(-8 40 54)" />
          <Rect x="51" y="35" width="12" height="43" {...common} transform="rotate(8 57 56)" />
          <Path d="M68 78 V28 H80 V78" {...common} />
        </>
      )}
      {kind === 'graduation' && (
        <>
          <Polygon points="50,13 91,34 50,55 9,34 50,13" {...common} />
          <Path d="M23 43 V65 C38 77 62 77 77 65 V43 M91 34 V61" {...common} />
          <Path d="M91 61 C86 61 84 65 86 68 C88 71 94 71 96 68 C98 65 96 61 91 61 Z" {...common} />
        </>
      )}
    </Svg>
  );
}

function SplashGlow() {
  return (
    <Svg pointerEvents="none" style={styles.radialGlow} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id="splashGlow" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor="#A7DCFF" stopOpacity="0.58" />
          <Stop offset="0.34" stopColor="#59AFFF" stopOpacity="0.28" />
          <Stop offset="0.72" stopColor="#2D83FF" stopOpacity="0.08" />
          <Stop offset="1" stopColor="#2D83FF" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx="50" cy="50" r="50" fill="url(#splashGlow)" />
    </Svg>
  );
}

function SplashDecorations() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <BackgroundIcon kind="book" size={112} style={styles.openBook} />
      <BackgroundIcon kind="bank" size={106} style={styles.governmentBuilding} />
      <BackgroundIcon kind="target" size={92} style={styles.target} />
      <BackgroundIcon kind="chart" size={94} style={styles.chart} />
      <BackgroundIcon kind="bookshelf" size={92} style={styles.bookshelf} />
      <BackgroundIcon kind="graduation" size={104} style={styles.graduationCap} />

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

  const logoWidth = Math.min(width * 0.48, 220);
  const logoHeight = logoWidth * 0.74;
  return (
    <LinearGradient colors={['#061A73', '#062C91', '#03145C']} style={styles.container}>
      <SplashDecorations />

      <SplashGlow />

      <View style={styles.brandContent}>
        <NativeImage
          source={AppConfig.identity.splashAsset}
          style={{ width: logoWidth, height: logoHeight }}
          resizeMode="contain"
          resizeMethod="resize"
          fadeDuration={0}
        />
        <Text variant="h1" weight="bold" style={styles.appName}>Loksewa Solution</Text>
        <Text variant="body" style={styles.tagline}>Prepare Today. Lead Tomorrow.</Text>
        <ActivityIndicator size="small" color="#D8E7FF" style={styles.spinner} />
      </View>

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
  backgroundIcon: { position: 'absolute', opacity: 0.24 },
  openBook: { top: '12%', left: -18 },
  governmentBuilding: { top: '13%', right: 18 },
  target: { top: '30%', left: '13%' },
  chart: { top: '43%', right: 18 },
  bookshelf: { bottom: '13%', left: 32 },
  graduationCap: { bottom: '14%', right: 27 },
  dottedPath: { position: 'absolute', width: '118%', height: 220, top: '13%', right: '-20%' },
  waveLines: { position: 'absolute', width: '125%', height: 300, bottom: -16, left: '-7%' },
  dots: { position: 'absolute', width: '100%', height: '100%', top: 0, left: 0 },
  radialGlow: { position: 'absolute', width: '126%', height: '56%', top: '18%', left: '-13%' },
  brandContent: { position: 'absolute', top: '30%', width: '100%', alignItems: 'center', paddingHorizontal: 18 },
  appName: { marginTop: 20, color: '#FFFFFF', letterSpacing: 0.2, textAlign: 'center' },
  tagline: { marginTop: 9, color: '#F0F6FF', fontWeight: '600', textAlign: 'center' },
  spinner: { marginTop: 22 },
  footer: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: 18 },
  developerLabel: { color: '#D7E3FF', opacity: 0.94, textAlign: 'center' },
  flag: { fontSize: 14 },
  developerName: { color: '#F0A04B' },
});
