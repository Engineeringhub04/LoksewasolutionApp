// §12 Premium Onboarding — Clean, professional welcome screens with smooth animations.
// No floating bubbles, no separate image cards. Glass-design buttons, stable sizing,
// and elegant slide transitions.
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
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolateColor,
  interpolate,
  Extrapolation,
  FadeInUp,
  FadeInDown,
  withSpring,
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
  accentColor: string;
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
    backgroundColor: '#0F172A',
    accentColor: '#3B82F6',
    tag: 'Practice',
  },
  {
    id: 'slide-2',
    title: 'Leaderboard & Analytics',
    description: 'Track your progress, compete with thousands of students across Nepal, and rise to the top.',
    imageSource: require('../assets/images/ws-leaderboard_analytics.png'),
    backgroundColor: '#0B1F28',
    accentColor: '#10B981',
    tag: 'Compete',
  },
  {
    id: 'slide-3',
    title: 'Daily Practice',
    description: 'Strengthen your preparation with fresh daily questions covering all Loksewa subjects.',
    imageSource: { uri: 'https://i.ibb.co/hN8gtSc/dailytest-wlc.png' },
    backgroundColor: '#1E1510',
    accentColor: '#F97316',
    tag: 'Daily',
  },
  {
    id: 'slide-4',
    title: 'Discussion Forum',
    description: 'Connect with fellow aspirants, discuss tricky questions, and learn together as a community.',
    imageSource: { uri: 'https://i.ibb.co/9HYXh3nr/discussion-wlc.png' },
    backgroundColor: '#1B1B3D',
    accentColor: '#8B5CF6',
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
    accentColor: '#3B82F6',
  };
}

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

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    (async () => {
      try {
        const firestoreSlides = await fetchOnboardingSlides();
        if (firestoreSlides.length >= 4) {
          setSlides(firestoreSlides.map(firestoreToSlide));
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const urls = slides.filter((s) => s.imageSource?.uri).map((s) => s.imageSource.uri);
    if (urls.length > 0) Image.prefetch(urls).catch(() => {});
  }, [slides]);

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

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => { scrollX.value = event.contentOffset.x; },
  });

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setCurrentIndex(Math.round(e.nativeEvent.contentOffset.x / slideWidth));
  };

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

      {/* Top Bar: Skip */}
      <Animated.View entering={FadeInDown.delay(200).duration(400)} style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <View style={{ width: 80 }} />
        {!isLastSlide && (
          <Pressable onPress={goToLastSlide} style={({ pressed }) => [styles.skipBtn, { opacity: pressed ? 0.6 : 1 }]}>
            <Text variant="bodySmall" weight="semiBold" style={styles.skipBtnText}>Skip</Text>
            <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.7)" />
          </Pressable>
        )}
      </Animated.View>

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
      <Animated.View entering={FadeInUp.delay(300).duration(400)} style={styles.dotsRow}>
        {slides.map((_, i) => <AnimatedDot key={i} index={i} scrollX={scrollX} slideWidth={slideWidth} />)}
      </Animated.View>

      {/* Bottom Navigation */}
      <Animated.View entering={FadeInUp.delay(400).duration(400)} style={[styles.bottomSection, { paddingBottom: insets.bottom + 20 }]}>
        {isLastSlide ? (
          <Pressable onPress={navigateToLogin} style={({ pressed }) => [styles.getStartedBtn, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
            <LinearGradient colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.1)']} style={styles.glassBg}>
              <Text variant="body" weight="bold" style={styles.getStartedText}>Get Started</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFF" />
            </LinearGradient>
          </Pressable>
        ) : (
          <View style={styles.navRow}>
            {!isFirstSlide ? (
              <Pressable onPress={goBack} style={({ pressed }) => [styles.navBtn, styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}>
                <LinearGradient colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.05)']} style={styles.glassBg}>
                  <Ionicons name="arrow-back" size={18} color="#FFF" />
                  <Text variant="bodySmall" weight="semiBold" style={styles.backText}>Back</Text>
                </LinearGradient>
              </Pressable>
            ) : <View style={styles.backBtnPlaceholder} />}
            <Pressable onPress={goNext} style={({ pressed }) => [styles.navBtn, styles.nextBtn, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
              <LinearGradient colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.85)']} style={styles.glassBg}>
                <Text variant="bodySmall" weight="bold" style={styles.nextText}>Next</Text>
                <Ionicons name="arrow-forward" size={16} color="#1E293B" />
              </LinearGradient>
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
      opacity: interpolate(scrollX.value, input, [0.4, 1, 0.4], Extrapolation.CLAMP),
      transform: [
        { scale: interpolate(scrollX.value, input, [0.85, 1, 0.85], Extrapolation.CLAMP) },
        { translateY: interpolate(scrollX.value, input, [20, 0, 20], Extrapolation.CLAMP) },
      ],
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
      {/* Image - no separate card, clean presentation */}
      <Animated.View style={[styles.imageSection, imageStyle]}>
        <Image source={slide.imageSource} style={styles.slideImage} contentFit="contain" cachePolicy="disk" transition={200} priority="high" />
        {slide.tag && (
          <View style={[styles.tagBadge, { backgroundColor: slide.accentColor }]}>
            <Text variant="caption" weight="bold" style={styles.tagText}>{slide.tag}</Text>
          </View>
        )}
      </Animated.View>

      {/* Text */}
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
      width: interpolate(scrollX.value, input, [8, 24, 8], Extrapolation.CLAMP),
      opacity: interpolate(scrollX.value, input, [0.35, 1, 0.35], Extrapolation.CLAMP),
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
  skipBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(255,255,255,0.12)', paddingVertical: 7, paddingHorizontal: 12, borderRadius: 16 },
  skipBtnText: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  slideContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  imageSection: { alignItems: 'center', justifyContent: 'center', marginBottom: 32 },
  slideImage: { width: SCREEN_WIDTH * 0.55, height: SCREEN_WIDTH * 0.55 },
  tagBadge: { marginTop: 16, paddingVertical: 5, paddingHorizontal: 14, borderRadius: 16 },
  tagText: { color: '#FFF', fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase' },
  textSection: { alignItems: 'center', gap: 10, paddingHorizontal: 8 },
  slideTitle: { color: '#FFF', textAlign: 'center', fontSize: 26, letterSpacing: 0.3 },
  slideDesc: { color: 'rgba(255,255,255,0.82)', textAlign: 'center', fontSize: 15, lineHeight: 22 },
  dotsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  dot: { height: 7, borderRadius: 3.5, backgroundColor: '#FFF', marginHorizontal: 3 },
  bottomSection: { paddingHorizontal: 24 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: { borderRadius: 24, overflow: 'hidden' },
  backBtn: { flex: 1, maxWidth: 120 },
  backBtnPlaceholder: { flex: 1, maxWidth: 120 },
  nextBtn: { flex: 1.3, maxWidth: 160 },
  glassBg: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, paddingHorizontal: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  backText: { color: '#FFF', fontSize: 14 },
  nextText: { color: '#1E293B', fontSize: 14 },
  getStartedBtn: { borderRadius: 28, overflow: 'hidden', width: '100%' },
  getStartedText: { color: '#FFF', fontSize: 16, letterSpacing: 0.3 },
});
