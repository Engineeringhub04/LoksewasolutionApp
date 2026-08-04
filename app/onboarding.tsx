// §12 Premium Onboarding — Fetches slides from Firestore + 4 hardcoded fallbacks.
// Shows EVERY TIME when user is NOT logged in. Premium UI with floating bubbles,
// dark backgrounds, slide animations, Back/Next nav, Get Started on last slide.
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
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
  interpolate,
  Extrapolation,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  FadeInUp,
  type SharedValue,
} from 'react-native-reanimated';
import { isFirebaseConfigured } from '@/src/core/firebase/env';
import { fetchOnboardingSlides, type OnboardingSlide } from '@/src/core/firebase/services/onboarding';
import { Text } from '@/src/components/misc/Text';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ====================================================================
// LOCAL SLIDE DATA (fallback when Firestore has no data)
// ====================================================================
interface SlideData {
  id: string;
  title: string;
  description: string;
  imageSource: any;
  backgroundColor: string;
  tag?: string;
}

const LOCAL_IMAGE_MAP: Record<string, any> = {
  'assets/images/ws-weeklytest.png': require('../assets/images/ws-weeklytest.png'),
  'assets/images/ws-leaderboard_analytics.png': require('../assets/images/ws-leaderboard_analytics.png'),
};

const HARDCODED_SLIDES: SlideData[] = [
  {
    id: 'slide-1',
    title: 'Weekly Mock Tests',
    description: 'Challenge yourself with timed mock tests every week and track your improvement over time.',
    imageSource: require('../assets/images/ws-weeklytest.png'),
    backgroundColor: '#1A237E',
    tag: 'Practice',
  },
  {
    id: 'slide-2',
    title: 'Leaderboard & Analytics',
    description: 'Track your progress, compete with thousands of students across Nepal, and rise to the top.',
    imageSource: require('../assets/images/ws-leaderboard_analytics.png'),
    backgroundColor: '#004D40',
    tag: 'Compete',
  },
  {
    id: 'slide-3',
    title: 'Daily Practice',
    description: 'Strengthen your preparation with fresh daily questions covering all Loksewa subjects.',
    imageSource: { uri: 'https://i.ibb.co/hN8gtSc/dailytest-wlc.png' },
    backgroundColor: '#BF360C',
    tag: 'Daily',
  },
  {
    id: 'slide-4',
    title: 'Discussion Forum',
    description: 'Connect with fellow aspirants, discuss tricky questions, and learn together as a community.',
    imageSource: { uri: 'https://i.ibb.co/9HYXh3nr/discussion-wlc.png' },
    backgroundColor: '#4A148C',
    tag: 'Community',
  },
];

function firestoreToSlide(doc: OnboardingSlide): SlideData {
  const imageSource = doc.isLocal && LOCAL_IMAGE_MAP[doc.imageLink]
    ? LOCAL_IMAGE_MAP[doc.imageLink]
    : { uri: doc.imageLink };
  return {
    id: doc.id,
    title: doc.title,
    description: doc.description,
    imageSource,
    backgroundColor: doc.backgroundColor,
  };
}

// ====================================================================
// FLOATING BUBBLE COMPONENT
// ====================================================================
function FloatingBubble({ size, left, delay, duration }: { size: number; left: number; delay: number; duration: number }) {
  const translateY = useSharedValue(SCREEN_HEIGHT + size);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-size, { duration }),
          withTiming(SCREEN_HEIGHT + size, { duration: 0 })
        ),
        -1,
        false
      )
    );
  }, [translateY, delay, duration, size]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: (left / 100) * SCREEN_WIDTH,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.08)',
        },
        style,
      ]}
    />
  );
}

const BUBBLES = [
  { size: 60, left: 5, delay: 0, duration: 8000 },
  { size: 40, left: 20, delay: 2000, duration: 7000 },
  { size: 80, left: 70, delay: 1000, duration: 9000 },
  { size: 30, left: 85, delay: 3000, duration: 6000 },
  { size: 50, left: 45, delay: 500, duration: 8500 },
  { size: 35, left: 60, delay: 4000, duration: 7500 },
  { size: 25, left: 10, delay: 1500, duration: 6500 },
  { size: 45, left: 35, delay: 2500, duration: 9500 },
];

// ====================================================================
// MAIN COMPONENT
// ====================================================================
export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [slides, setSlides] = useState<SlideData[]>(HARDCODED_SLIDES);
  const [currentIndex, setCurrentIndex] = useState(0);
  const slideWidth = SCREEN_WIDTH;

  const scrollX = useSharedValue(0);
  const scrollRef = useRef<any>(null);

  // Only override hardcoded slides if Firestore has 4+ slides (full data set)
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    (async () => {
      try {
        const firestoreSlides = await fetchOnboardingSlides();
        if (firestoreSlides.length >= 4) {
          setSlides(firestoreSlides.map(firestoreToSlide));
        }
      } catch {
        // Keep hardcoded on error
      }
    })();
  }, []);

  // Pre-cache network images
  useEffect(() => {
    const urls = slides.filter((s) => s.imageSource?.uri).map((s) => s.imageSource.uri);
    if (urls.length > 0) Image.prefetch(urls).catch(() => {});
  }, [slides]);

  // --- Navigation ---
  const navigateToLogin = () => router.replace('/(auth)/login');

  const goNext = () => {
    if (currentIndex < slides.length - 1) {
      const next = currentIndex + 1;
      scrollRef.current?.scrollTo({ x: next * slideWidth, animated: true });
      setCurrentIndex(next);
    } else {
      navigateToLogin();
    }
  };

  const goBack = () => {
    if (currentIndex > 0) {
      const prev = currentIndex - 1;
      scrollRef.current?.scrollTo({ x: prev * slideWidth, animated: true });
      setCurrentIndex(prev);
    }
  };

  const goToLastSlide = () => {
    const last = slides.length - 1;
    scrollRef.current?.scrollTo({ x: last * slideWidth, animated: true });
    setCurrentIndex(last);
  };

  // --- Scroll ---
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => { scrollX.value = event.contentOffset.x; },
  });

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setCurrentIndex(Math.round(e.nativeEvent.contentOffset.x / slideWidth));
  };

  // --- Animated background ---
  // Extract colors array outside worklet (React state can't be read in worklets)
  const bgColors = slides.map((s) => s.backgroundColor);
  const bgInputRange = slides.map((_, i) => i * slideWidth);

  const backgroundStyle = useAnimatedStyle(() => {
    if (bgColors.length < 2) return { backgroundColor: bgColors[0] ?? '#0B1330' };
    return {
      backgroundColor: interpolateColor(scrollX.value, bgInputRange, bgColors),
    };
  });

  const isLastSlide = currentIndex === slides.length - 1;
  const isFirstSlide = currentIndex === 0;

  return (
    <Animated.View style={[styles.container, backgroundStyle]}>
      <StatusBar style="light" />

      {/* Floating Bubbles */}
      {BUBBLES.map((b, i) => <FloatingBubble key={i} {...b} />)}

      {/* Top Bar: Skip */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={{ width: 80 }} />
        {!isLastSlide && (
          <Pressable onPress={goToLastSlide} style={({ pressed }) => [styles.topBtn, { opacity: pressed ? 0.6 : 1 }]}>
            <Text variant="bodySmall" weight="semiBold" style={styles.topBtnText}>Skip</Text>
            <Ionicons name="play-forward" size={14} color="rgba(255,255,255,0.8)" />
          </Pressable>
        )}
      </View>

      {/* Slides */}
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
          <SlideView key={slide.id} slide={slide} slideWidth={slideWidth} index={idx} scrollX={scrollX} />
        ))}
      </Animated.ScrollView>

      {/* Dots */}
      <View style={styles.dotsRow}>
        {slides.map((_, i) => <AnimatedDot key={i} index={i} scrollX={scrollX} slideWidth={slideWidth} />)}
      </View>

      {/* Bottom Navigation */}
      <Animated.View entering={FadeInUp.delay(300).duration(500)} style={[styles.bottomSection, { paddingBottom: insets.bottom + 16 }]}>
        {isLastSlide ? (
          <Pressable onPress={navigateToLogin} style={({ pressed }) => [styles.getStartedBtn, { transform: [{ scale: pressed ? 0.96 : 1 }] }]}>
            <Text variant="body" weight="bold" style={styles.getStartedText}>Get Started</Text>
            <Ionicons name="arrow-forward" size={20} color="#0B1330" />
          </Pressable>
        ) : (
          <View style={styles.navRow}>
            {!isFirstSlide ? (
              <Pressable onPress={goBack} style={({ pressed }) => [styles.navBtn, styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}>
                <Ionicons name="arrow-back" size={20} color="#FFF" />
                <Text variant="body" weight="semiBold" style={styles.backText}>Back</Text>
              </Pressable>
            ) : <View style={{ width: 100 }} />}
            <Pressable onPress={goNext} style={({ pressed }) => [styles.navBtn, styles.nextBtn, { transform: [{ scale: pressed ? 0.95 : 1 }] }]}>
              <Text variant="body" weight="bold" style={styles.nextText}>Next</Text>
              <Ionicons name="arrow-forward" size={20} color="#0B1330" />
            </Pressable>
          </View>
        )}
      </Animated.View>
    </Animated.View>
  );
}

// ====================================================================
// SLIDE VIEW WITH ANIMATIONS
// ====================================================================
function SlideView({ slide, slideWidth, index, scrollX }: { slide: SlideData; slideWidth: number; index: number; scrollX: SharedValue<number> }) {
  const imageStyle = useAnimatedStyle(() => {
    const input = [(index - 1) * slideWidth, index * slideWidth, (index + 1) * slideWidth];
    return {
      opacity: interpolate(scrollX.value, input, [0.3, 1, 0.3], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(scrollX.value, input, [0.6, 1, 0.6], Extrapolation.CLAMP) }],
    };
  });

  const textStyle = useAnimatedStyle(() => {
    const input = [(index - 1) * slideWidth, index * slideWidth, (index + 1) * slideWidth];
    return {
      opacity: interpolate(scrollX.value, input, [0, 1, 0], Extrapolation.CLAMP),
      transform: [{ translateY: interpolate(scrollX.value, input, [30, 0, 30], Extrapolation.CLAMP) }],
    };
  });

  return (
    <View style={[styles.slideContainer, { width: slideWidth }]}>
      <Animated.View style={[styles.imageSection, imageStyle]}>
        <View style={styles.imageCircle}>
          <Image source={slide.imageSource} style={styles.slideImage} contentFit="contain" cachePolicy="disk" transition={200} priority="high" />
        </View>
        {slide.tag && (
          <View style={styles.tagBadge}>
            <Text variant="bodySmall" weight="bold" style={styles.tagText}>{slide.tag}</Text>
          </View>
        )}
      </Animated.View>
      <Animated.View style={[styles.textSection, textStyle]}>
        <Text variant="h1" weight="bold" style={styles.slideTitle}>{slide.title}</Text>
        <Text variant="body" style={styles.slideDesc}>{slide.description}</Text>
      </Animated.View>
    </View>
  );
}

// ====================================================================
// DOT INDICATOR
// ====================================================================
function AnimatedDot({ index, scrollX, slideWidth }: { index: number; scrollX: SharedValue<number>; slideWidth: number }) {
  const style = useAnimatedStyle(() => {
    const input = [(index - 1) * slideWidth, index * slideWidth, (index + 1) * slideWidth];
    return {
      width: interpolate(scrollX.value, input, [8, 28, 8], Extrapolation.CLAMP),
      opacity: interpolate(scrollX.value, input, [0.3, 1, 0.3], Extrapolation.CLAMP),
    };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

// ====================================================================
// STYLES
// ====================================================================
const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  flex1: { flex: 1 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, zIndex: 10 },
  topBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.1)', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  topBtnText: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  slideContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  imageSection: { flex: 5, alignItems: 'center', justifyContent: 'center', width: '100%' },
  imageCircle: { width: SCREEN_WIDTH * 0.62, height: SCREEN_WIDTH * 0.62, borderRadius: SCREEN_WIDTH * 0.31, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', shadowColor: 'rgba(255,255,255,0.3)', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 8 },
  slideImage: { width: '80%', height: '80%' },
  tagBadge: { position: 'absolute', bottom: 10, right: SCREEN_WIDTH * 0.12, backgroundColor: 'rgba(255,255,255,0.2)', paddingVertical: 4, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  tagText: { color: '#FFF', fontSize: 11, letterSpacing: 0.5 },
  textSection: { flex: 3, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 24, gap: 14, paddingHorizontal: 12 },
  slideTitle: { color: '#FFF', textAlign: 'center', fontSize: 28, letterSpacing: 0.3 },
  slideDesc: { color: 'rgba(255,255,255,0.8)', textAlign: 'center', fontSize: 15, lineHeight: 23 },
  dotsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  dot: { height: 8, borderRadius: 4, backgroundColor: '#FFF', marginHorizontal: 4 },
  bottomSection: { paddingHorizontal: 24 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 28 },
  backBtn: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  nextBtn: { backgroundColor: 'rgba(255,200,120,0.95)', shadowColor: '#FFC878', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  backText: { color: '#FFF', fontSize: 16 },
  nextText: { color: '#0B1330', fontSize: 16 },
  getStartedBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', paddingVertical: 18, borderRadius: 30, backgroundColor: '#FFF', shadowColor: '#FFF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 6 },
  getStartedText: { color: '#0B1330', fontSize: 18, letterSpacing: 0.3 },
});
