// §12 Onboarding — Firestore-driven welcome slides (app_onboarding-settings).
// First run with an empty collection shows a "Seed Demo Data" button; once
// seeded, slides swipe with the background smoothly tracking each slide's color.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolateColor,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useSettingsStore } from '@/src/core/store/settingsStore';
import { showToast } from '@/src/core/store/toastStore';
import { isFirebaseConfigured } from '@/src/core/firebase/env';
import { fetchOnboardingSlides, seedOnboardingSlides, type OnboardingSlide } from '@/src/core/firebase/services/onboarding';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';

// Metro statically resolves require() calls regardless of surrounding expression,
// so this map is safe even though the key comes from Firestore data at runtime.
const LOCAL_IMAGES: Record<string, ReturnType<typeof require>> = {
  'assets/images/ws-weeklytest.png': require('../assets/images/ws-weeklytest.png'),
  'assets/images/ws-leaderboard_analytics.png': require('../assets/images/ws-leaderboard_analytics.png'),
};

const FALLBACK_BACKGROUND = '#0B1746';

export default function OnboardingScreen() {
  const { spacing } = useTheme();
  const { t } = useTranslation();
  const { completeOnboarding } = useSettingsStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [slides, setSlides] = useState<OnboardingSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [index, setIndex] = useState(0);
  const [slideWidth, setSlideWidth] = useState(0);
  const scrollX = useSharedValue(0);
  const scrollRef = useRef<any>(null);

  const load = useCallback(async () => {
    if (!isFirebaseConfigured) {
      setSlides([]);
      setLoading(false);
      return;
    }
    try {
      const data = await fetchOnboardingSlides();
      setSlides(data);
    } catch {
      setSlides([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const remoteUrls = slides.filter((s) => !s.isLocal).map((s) => s.imageLink);
    if (remoteUrls.length) Image.prefetch(remoteUrls);
  }, [slides]);

  const handleSeed = async () => {
    if (!isFirebaseConfigured) {
      showToast(t('auth.seedNotConfigured'), 'warning');
      return;
    }
    setSeeding(true);
    try {
      await seedOnboardingSlides();
      await load();
      showToast(t('auth.seedSuccess'), 'success');
    } catch {
      showToast(t('auth.seedFailed'), 'error');
    } finally {
      setSeeding(false);
    }
  };

  const finish = () => {
    completeOnboarding();
    router.replace('/(auth)/login');
  };

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!slideWidth) return;
    setIndex(Math.round(e.nativeEvent.contentOffset.x / slideWidth));
  };

  const goNext = () => {
    if (index < slides.length - 1) {
      scrollRef.current?.scrollTo({ x: (index + 1) * slideWidth, animated: true });
      setIndex(index + 1);
    } else {
      finish();
    }
  };

  const backgroundStyle = useAnimatedStyle(() => {
    if (slides.length < 2 || !slideWidth) {
      return { backgroundColor: slides[0]?.backgroundColor ?? FALLBACK_BACKGROUND };
    }
    return {
      backgroundColor: interpolateColor(
        scrollX.value,
        slides.map((_, i) => i * slideWidth),
        slides.map((s) => s.backgroundColor)
      ),
    };
  });

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: FALLBACK_BACKGROUND, alignItems: 'center', justifyContent: 'center' }}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  if (slides.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: FALLBACK_BACKGROUND, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md }}>
        <StatusBar style="light" />
        <Text variant="h2" weight="bold" style={{ color: '#FFFFFF', textAlign: 'center' }}>
          {t('common.appName')}
        </Text>
        <Text variant="body" style={{ color: '#FFFFFF', opacity: 0.8, textAlign: 'center' }}>
          No onboarding content yet. Seed demo data to preview the welcome slides.
        </Text>
        <Button label="SEED DEMO DATA" onPress={handleSeed} loading={seeding} testID="seed-onboarding-data" />
        <Button label={t('common.skip')} variant="text" onPress={finish} />
      </View>
    );
  }

  return (
    <Animated.View style={[{ flex: 1 }, backgroundStyle]} onLayout={(e) => setSlideWidth(e.nativeEvent.layout.width)}>
      <StatusBar style="light" />
      {slideWidth > 0 ? (
        <>
          <Animated.ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            onMomentumScrollEnd={onMomentumScrollEnd}
            scrollEventThrottle={16}
          >
            {slides.map((slide) => (
              <View key={slide.id} style={{ width: slideWidth, flex: 1 }}>
                <View style={{ flex: 6, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl }}>
                  <Image
                    source={slide.isLocal ? LOCAL_IMAGES[slide.imageLink] : { uri: slide.imageLink }}
                    style={{ width: 240, height: 240, borderRadius: 24 }}
                    contentFit="contain"
                    cachePolicy="disk"
                  />
                </View>
                <View style={{ flex: 4, paddingHorizontal: spacing.xl, gap: spacing.sm }}>
                  <Text variant="h1" weight="bold" style={{ color: '#FFFFFF', textAlign: 'center' }}>
                    {slide.title}
                  </Text>
                  <Text variant="body" style={{ color: '#FFFFFF', opacity: 0.85, textAlign: 'center' }}>
                    {slide.text}
                  </Text>
                </View>
              </View>
            ))}
          </Animated.ScrollView>

          <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: spacing.lg }}>
            {slides.map((_, i) => (
              <Dot key={i} index={i} scrollX={scrollX} slideWidth={slideWidth} />
            ))}
          </View>

          <View style={{ flexDirection: 'row', paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md }}>
            <Button label={t('common.skip')} variant="text" onPress={finish} style={{ flex: 1 }} />
            <Button
              label={index === slides.length - 1 ? t('common.getStarted') : t('common.next')}
              onPress={goNext}
              style={{ flex: 1 }}
            />
          </View>
        </>
      ) : null}

      <View style={{ alignItems: 'center', paddingBottom: insets.bottom + spacing.sm }}>
        <Text variant="bodySmall" style={{ color: '#FFFFFF', opacity: 0.75 }}>
          Made for Nepali Student 🇳🇵 | by <Text variant="bodySmall" weight="bold" style={{ color: '#00D4FF' }}>Kishan Raut</Text>
        </Text>
      </View>
    </Animated.View>
  );
}

function Dot({ index, scrollX, slideWidth }: { index: number; scrollX: SharedValue<number>; slideWidth: number }) {
  const style = useAnimatedStyle(() => {
    const inputRange = [(index - 1) * slideWidth, index * slideWidth, (index + 1) * slideWidth];
    return {
      width: interpolate(scrollX.value, inputRange, [8, 20, 8], Extrapolation.CLAMP),
      opacity: interpolate(scrollX.value, inputRange, [0.4, 1, 0.4], Extrapolation.CLAMP),
    };
  });

  return <Animated.View style={[{ height: 8, borderRadius: 4, backgroundColor: '#FFFFFF', marginHorizontal: 4 }, style]} />;
}
