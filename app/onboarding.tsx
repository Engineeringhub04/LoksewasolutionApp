// §12 Onboarding — Firestore-driven welcome slides (app_onboarding-settings).
// Shows EVERY TIME when user is NOT logged in. If collection is empty, shows
// "SEED DEMO DATA" button. Once seeded, displays animated slides with dynamic
// background color transitions, smooth dot indicators, and hybrid image loading.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Dimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolateColor,
  FadeIn,
  FadeInUp,
  SlideInRight,
} from 'react-native-reanimated';
import { isFirebaseConfigured } from '@/src/core/firebase/env';
import {
  fetchOnboardingSlides,
  seedOnboardingSlides,
  isOnboardingCollectionEmpty,
  getRemoteImageUrls,
  type OnboardingSlide,
} from '@/src/core/firebase/services/onboarding';
import { showToast } from '@/src/core/store/toastStore';
import { Text } from '@/src/components/misc/Text';
import { OnboardingSlideView } from '@/src/components/onboarding/OnboardingSlide';
import { DotIndicator } from '@/src/components/onboarding/DotIndicator';
import { SeedDataButton } from '@/src/components/onboarding/SeedDataButton';

const FALLBACK_BACKGROUND = '#0B1746';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // --- State ---
  const [slides, setSlides] = useState<OnboardingSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [collectionEmpty, setCollectionEmpty] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [slideWidth, setSlideWidth] = useState(SCREEN_WIDTH);

  // --- Reanimated ---
  const scrollX = useSharedValue(0);
  const scrollRef = useRef<any>(null);

  // --- Data Loading ---
  const loadSlides = useCallback(async () => {
    if (!isFirebaseConfigured) {
      setSlides([]);
      setCollectionEmpty(true);
      setLoading(false);
      return;
    }
    try {
      // Check if collection is empty first
      const isEmpty = await isOnboardingCollectionEmpty();
      setCollectionEmpty(isEmpty);

      if (!isEmpty) {
        const data = await fetchOnboardingSlides();
        setSlides(data);
        // Pre-cache network images for offline-first experience
        const remoteUrls = data.filter((s) => !s.isLocal).map((s) => s.imageLink);
        if (remoteUrls.length) Image.prefetch(remoteUrls);
      }
    } catch (err) {
      console.warn('[Onboarding] Failed to load slides:', err);
      setSlides([]);
      setCollectionEmpty(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSlides();
  }, [loadSlides]);

  // --- Handlers ---
  const handleSeed = async () => {
    if (!isFirebaseConfigured) {
      showToast('Firebase not configured. Check your .env file.', 'warning');
      return;
    }
    setSeeding(true);
    try {
      await seedOnboardingSlides();
      showToast('Demo data seeded successfully! 🎉', 'success');
      // Reload slides after seeding
      setCollectionEmpty(false);
      const data = await fetchOnboardingSlides();
      setSlides(data);
      // Pre-cache remote images
      const remoteUrls = data.filter((s) => !s.isLocal).map((s) => s.imageLink);
      if (remoteUrls.length) Image.prefetch(remoteUrls);
    } catch (err) {
      console.warn('[Onboarding] Seed failed:', err);
      showToast('Failed to seed data. Please try again.', 'error');
    } finally {
      setSeeding(false);
    }
  };

  const navigateToLogin = () => {
    router.replace('/(auth)/login');
  };

  const goNext = () => {
    if (currentIndex < slides.length - 1) {
      const nextIndex = currentIndex + 1;
      scrollRef.current?.scrollTo({ x: nextIndex * slideWidth, animated: true });
      setCurrentIndex(nextIndex);
    } else {
      // Last slide → go to login
      navigateToLogin();
    }
  };

  const goSkip = () => {
    navigateToLogin();
  };

  // --- Scroll handlers ---
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!slideWidth) return;
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / slideWidth);
    setCurrentIndex(newIndex);
  };

  // --- Animated background color based on scroll position ---
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

  // ============ LOADING STATE ============
  if (loading) {
    return (
      <View style={[styles.fullCenter, { backgroundColor: FALLBACK_BACKGROUND }]}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text variant="body" style={styles.loadingText}>
          Loading onboarding...
        </Text>
      </View>
    );
  }

  // ============ EMPTY STATE — SEED DATA BUTTON ============
  if (collectionEmpty && slides.length === 0) {
    return (
      <View style={[styles.fullCenter, { backgroundColor: FALLBACK_BACKGROUND, paddingTop: insets.top }]}>
        <StatusBar style="light" />

        <Animated.View entering={FadeInUp.delay(200).duration(600)} style={styles.emptyHeader}>
          <View style={styles.logoCircle}>
            <Ionicons name="school" size={48} color="#3F51B5" />
          </View>
          <Text variant="h1" weight="bold" style={styles.appTitle}>
            Loksewa's Solution
          </Text>
          <Text variant="body" style={styles.appSubtitle}>
            Your complete Loksewa preparation companion
          </Text>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(500).duration(500)} style={{ width: '100%' }}>
          <SeedDataButton onSeed={handleSeed} loading={seeding} />
        </Animated.View>

        <View style={styles.skipContainer}>
          <Pressable onPress={navigateToLogin} style={styles.skipButton}>
            <Text variant="body" weight="semiBold" style={styles.skipText}>
              Skip to Login
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Text variant="bodySmall" style={styles.footerText}>
            Made for Nepali Students 🇳🇵 | by{' '}
            <Text variant="bodySmall" weight="bold" style={{ color: '#00D4FF' }}>
              Kishan Raut
            </Text>
          </Text>
        </View>
      </View>
    );
  }

  // ============ SLIDES VIEW ============
  return (
    <Animated.View
      style={[styles.flex1, backgroundStyle]}
      onLayout={(e) => setSlideWidth(e.nativeEvent.layout.width)}
    >
      <StatusBar style="light" />

      {slideWidth > 0 && (
        <>
          {/* Slides ScrollView */}
          <Animated.ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            onMomentumScrollEnd={onMomentumScrollEnd}
            scrollEventThrottle={16}
            bounces={false}
            style={styles.flex1}
          >
            {slides.map((slide, idx) => (
              <OnboardingSlideView
                key={slide.id}
                slide={slide}
                slideWidth={slideWidth}
                isActive={idx === currentIndex}
              />
            ))}
          </Animated.ScrollView>

          {/* Dot Indicators */}
          <DotIndicator
            count={slides.length}
            scrollX={scrollX}
            slideWidth={slideWidth}
          />

          {/* Bottom Controls: Skip + Next/Get Started */}
          <Animated.View
            entering={SlideInRight.delay(300).duration(400)}
            style={[styles.controls, { paddingBottom: insets.bottom + 8 }]}
          >
            {/* Skip Button */}
            <Pressable
              onPress={goSkip}
              style={({ pressed }) => [styles.controlBtn, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Text variant="body" weight="semiBold" style={styles.controlText}>
                Skip
              </Text>
            </Pressable>

            {/* Next / Get Started Button */}
            <Pressable
              onPress={goNext}
              style={({ pressed }) => [
                styles.nextButton,
                { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] },
              ]}
            >
              <Text variant="body" weight="bold" style={styles.nextButtonText}>
                {currentIndex === slides.length - 1 ? 'Get Started' : 'Next'}
              </Text>
              <Ionicons
                name={currentIndex === slides.length - 1 ? 'checkmark-circle' : 'arrow-forward-circle'}
                size={22}
                color="#FFFFFF"
              />
            </Pressable>
          </Animated.View>

          {/* Footer */}
          <View style={[styles.footerSlider, { paddingBottom: insets.bottom + 4 }]}>
            <Text variant="bodySmall" style={styles.footerText}>
              Made for Nepali Students 🇳🇵 | by{' '}
              <Text variant="bodySmall" weight="bold" style={{ color: '#00D4FF' }}>
                Kishan Raut
              </Text>
            </Text>
          </View>
        </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  fullCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: 20,
  },
  loadingText: {
    color: '#FFFFFF',
    opacity: 0.7,
    marginTop: 12,
  },
  // --- Empty state (seed) ---
  emptyHeader: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 32,
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#3F51B5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  appTitle: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 28,
  },
  appSubtitle: {
    color: '#FFFFFF',
    opacity: 0.8,
    textAlign: 'center',
  },
  skipContainer: {
    marginTop: 16,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  skipText: {
    color: '#FFFFFF',
    opacity: 0.8,
  },
  // --- Slider controls ---
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  controlBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  controlText: {
    color: '#FFFFFF',
    opacity: 0.8,
    fontSize: 16,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  // --- Footer ---
  footer: {
    position: 'absolute',
    bottom: 0,
    alignItems: 'center',
    width: '100%',
  },
  footerSlider: {
    alignItems: 'center',
  },
  footerText: {
    color: '#FFFFFF',
    opacity: 0.7,
  },
});
