// §12 Onboarding — 4 hardcoded welcome slides always shown from code.
// Shows EVERY TIME when user is NOT logged in. First slide has a small
// "Seed Test" button to upload 1 document to Firestore for DB verification.
// UI inspired by reference: Image top, Title center, Dots, Continue button bottom.
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
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
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import { isFirebaseConfigured } from '@/src/core/firebase/env';
import { seedSingleTestSlide } from '@/src/core/firebase/services/onboarding';
import { showToast } from '@/src/core/store/toastStore';
import { Text } from '@/src/components/misc/Text';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ====================================================================
// 4 HARDCODED SLIDES — always show from code, no Firestore dependency
// ====================================================================
interface LocalSlide {
  id: string;
  title: string;
  description: string;
  imageSource: any; // require() for local, { uri: string } for network
  backgroundColor: string;
}

const SLIDES: LocalSlide[] = [
  {
    id: 'slide-1',
    title: 'Weekly Mock Tests',
    description: 'Challenge yourself with timed mock tests every week and track your improvement over time.',
    imageSource: require('../assets/images/ws-weeklytest.png'),
    backgroundColor: '#3F51B5',
  },
  {
    id: 'slide-2',
    title: 'Leaderboard & Analytics',
    description: 'Track your progress, compete with thousands of students across Nepal, and rise to the top.',
    imageSource: require('../assets/images/ws-leaderboard_analytics.png'),
    backgroundColor: '#009688',
  },
  {
    id: 'slide-3',
    title: 'Daily Practice',
    description: 'Strengthen your preparation with fresh daily questions covering all Loksewa subjects.',
    imageSource: { uri: 'https://i.ibb.co/hN8gtSc/dailytest-wlc.png' },
    backgroundColor: '#FF5722',
  },
  {
    id: 'slide-4',
    title: 'Discussion Forum',
    description: 'Connect with fellow aspirants, discuss tricky questions, and learn together as a community.',
    imageSource: { uri: 'https://i.ibb.co/9HYXh3nr/discussion-wlc.png' },
    backgroundColor: '#673AB7',
  },
];

// ====================================================================
// MAIN COMPONENT
// ====================================================================
export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [seeding, setSeeding] = useState(false);
  const slideWidth = SCREEN_WIDTH;

  const scrollX = useSharedValue(0);
  const scrollRef = useRef<any>(null);

  // Pre-cache network images on mount
  useEffect(() => {
    const networkUrls = SLIDES
      .filter((s) => s.imageSource?.uri)
      .map((s) => s.imageSource.uri);
    if (networkUrls.length > 0) {
      Image.prefetch(networkUrls).catch(() => {});
    }
  }, []);

  // --- Navigation ---
  const navigateToLogin = () => {
    router.replace('/(auth)/login');
  };

  const goNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      const nextIndex = currentIndex + 1;
      scrollRef.current?.scrollTo({ x: nextIndex * slideWidth, animated: true });
      setCurrentIndex(nextIndex);
    } else {
      navigateToLogin();
    }
  };

  // --- Seed 1 document for testing Firebase connection ---
  const handleSeedTest = async () => {
    if (!isFirebaseConfigured) {
      showToast('Firebase not configured. Check .env file.', 'warning');
      return;
    }
    setSeeding(true);
    try {
      await seedSingleTestSlide();
      showToast('✅ 1 document seeded! Check Firestore.', 'success');
    } catch (err: any) {
      console.warn('[Onboarding] Seed failed:', err);
      showToast(`Seed failed: ${err?.message ?? 'Unknown error'}`, 'error');
    } finally {
      setSeeding(false);
    }
  };

  // --- Scroll handlers ---
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / slideWidth);
    setCurrentIndex(newIndex);
  };

  // --- Animated background color ---
  const backgroundStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: interpolateColor(
        scrollX.value,
        SLIDES.map((_, i) => i * slideWidth),
        SLIDES.map((s) => s.backgroundColor)
      ),
    };
  });

  return (
    <Animated.View style={[styles.container, backgroundStyle]}>
      <StatusBar style="light" />

      {/* ===== SLIDES ===== */}
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
        contentContainerStyle={{ alignItems: 'center' }}
      >
        {SLIDES.map((slide, idx) => (
          <View key={slide.id} style={[styles.slideContainer, { width: slideWidth }]}>
            {/* Image */}
            <View style={styles.imageSection}>
              <View style={styles.imageCircleBg}>
                <Image
                  source={slide.imageSource}
                  style={styles.slideImage}
                  contentFit="contain"
                  cachePolicy="disk"
                  transition={300}
                />
              </View>
            </View>

            {/* Title & Description */}
            <View style={styles.textSection}>
              <Text variant="h1" weight="bold" style={styles.slideTitle}>
                {slide.title}
              </Text>
              <Text variant="body" style={styles.slideDescription}>
                {slide.description}
              </Text>
            </View>

            {/* Seed Test Button — only on first slide */}
            {idx === 0 && (
              <View style={styles.seedContainer}>
                <Pressable
                  onPress={handleSeedTest}
                  disabled={seeding}
                  style={({ pressed }) => [
                    styles.seedButton,
                    { opacity: pressed || seeding ? 0.6 : 1 },
                  ]}
                >
                  {seeding ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={14} color="#FFFFFF" />
                      <Text variant="bodySmall" weight="semiBold" style={styles.seedText}>
                        Seed Test (1 doc)
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            )}
          </View>
        ))}
      </Animated.ScrollView>

      {/* ===== DOT INDICATORS ===== */}
      <View style={styles.dotsRow}>
        {SLIDES.map((_, i) => (
          <AnimatedDot key={i} index={i} scrollX={scrollX} slideWidth={slideWidth} />
        ))}
      </View>

      {/* ===== CONTINUE / GET STARTED BUTTON ===== */}
      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          onPress={goNext}
          style={({ pressed }) => [
            styles.continueButton,
            { transform: [{ scale: pressed ? 0.96 : 1 }] },
          ]}
        >
          <Text variant="body" weight="bold" style={styles.continueText}>
            {currentIndex === SLIDES.length - 1 ? 'Get Started' : 'Continue'}
          </Text>
        </Pressable>

        {/* Skip link */}
        {currentIndex < SLIDES.length - 1 && (
          <Pressable onPress={navigateToLogin} style={styles.skipBtn}>
            <Text variant="bodySmall" style={styles.skipText}>
              Skip
            </Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

// ====================================================================
// ANIMATED DOT COMPONENT
// ====================================================================
function AnimatedDot({
  index,
  scrollX,
  slideWidth,
}: {
  index: number;
  scrollX: SharedValue<number>;
  slideWidth: number;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * slideWidth,
      index * slideWidth,
      (index + 1) * slideWidth,
    ];
    return {
      width: interpolate(scrollX.value, inputRange, [8, 24, 8], Extrapolation.CLAMP),
      opacity: interpolate(scrollX.value, inputRange, [0.4, 1, 0.4], Extrapolation.CLAMP),
    };
  });

  return <Animated.View style={[styles.dot, animatedStyle]} />;
}

// ====================================================================
// STYLES
// ====================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex1: {
    flex: 1,
  },
  // --- Slide ---
  slideContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  imageSection: {
    flex: 5,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  imageCircleBg: {
    width: SCREEN_WIDTH * 0.65,
    height: SCREEN_WIDTH * 0.65,
    borderRadius: SCREEN_WIDTH * 0.325,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  slideImage: {
    width: '85%',
    height: '85%',
  },
  textSection: {
    flex: 3,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 20,
    gap: 12,
    paddingHorizontal: 16,
  },
  slideTitle: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 26,
    letterSpacing: 0.3,
  },
  slideDescription: {
    color: '#FFFFFF',
    textAlign: 'center',
    opacity: 0.85,
    fontSize: 15,
    lineHeight: 22,
  },
  // --- Seed button (small, first slide only) ---
  seedContainer: {
    position: 'absolute',
    top: 50,
    right: 16,
  },
  seedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  seedText: {
    color: '#FFFFFF',
    fontSize: 11,
  },
  // --- Dots ---
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 4,
  },
  // --- Bottom ---
  bottomSection: {
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  continueButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 200, 120, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  continueText: {
    color: '#1A1A2E',
    fontSize: 17,
    letterSpacing: 0.3,
  },
  skipBtn: {
    paddingVertical: 8,
  },
  skipText: {
    color: '#FFFFFF',
    opacity: 0.7,
    fontSize: 14,
  },
});
