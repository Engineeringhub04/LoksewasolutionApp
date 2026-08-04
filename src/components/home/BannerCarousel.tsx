// Auto-sliding hero banner carousel for Home. Slides come from Firestore
// (image+color, or color+text only). Autoplay every 3.5s, pauses for 3s when
// the user touches a slide, then resumes. Manual swipe also works normally.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Pressable, Dimensions, StyleSheet, Linking, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { Image } from 'expo-image';
import Animated, { useSharedValue, useAnimatedStyle, interpolate, Extrapolation, type SharedValue } from 'react-native-reanimated';
import { Text } from '@/src/components/misc/Text';
import type { HomeBanner } from '@/src/core/firebase/services/banners';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SLIDE_WIDTH = SCREEN_WIDTH; // full-width paging slot; the card itself has inner margin for the peek/gap look
const AUTOPLAY_MS = 3500;
const RESUME_AFTER_TOUCH_MS = 3000;

interface BannerCarouselProps {
  banners: HomeBanner[];
}

export function BannerCarousel({ banners }: BannerCarouselProps) {
  const scrollRef = useRef<any>(null);
  const [index, setIndex] = useState(0);
  const scrollX = useSharedValue(0);
  const autoplayTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const indexRef = useRef(0);

  const startAutoplay = useCallback(() => {
    if (autoplayTimer.current) clearInterval(autoplayTimer.current);
    if (banners.length <= 1) return;
    autoplayTimer.current = setInterval(() => {
      const next = (indexRef.current + 1) % banners.length;
      scrollRef.current?.scrollTo({ x: next * SLIDE_WIDTH, animated: true });
      indexRef.current = next;
      setIndex(next);
    }, AUTOPLAY_MS);
  }, [banners.length]);

  useEffect(() => {
    startAutoplay();
    return () => {
      if (autoplayTimer.current) clearInterval(autoplayTimer.current);
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    };
  }, [startAutoplay]);

  const pauseThenResume = () => {
    if (autoplayTimer.current) clearInterval(autoplayTimer.current);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(startAutoplay, RESUME_AFTER_TOUCH_MS);
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollX.value = e.nativeEvent.contentOffset.x;
  };

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / SLIDE_WIDTH);
    indexRef.current = newIndex;
    setIndex(newIndex);
  };

  const handleSlidePress = (banner: HomeBanner) => {
    if (banner.linkUrl) Linking.openURL(banner.linkUrl).catch(() => {});
  };

  if (banners.length === 0) return null;

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onTouchStart={pauseThenResume}
        scrollEventThrottle={16}
        decelerationRate="fast"
      >
        {banners.map((banner) => (
          <View key={banner.id} style={{ width: SLIDE_WIDTH }}>
            <Pressable onPress={() => handleSlidePress(banner)} style={[styles.slide, { backgroundColor: banner.backgroundColor }]}>
              {banner.imageLink ? (
                <Image source={{ uri: banner.imageLink }} style={styles.slideImage} contentFit="cover" cachePolicy="disk" transition={200} />
              ) : (
                <View style={styles.textOnlyContent}>
                  <Text variant="h1" weight="bold" style={styles.heading}>{banner.heading}</Text>
                  <Text variant="body" style={styles.subheading}>{banner.subheading}</Text>
                </View>
              )}
            </Pressable>
          </View>
        ))}
      </Animated.ScrollView>

      <View style={styles.dotsRow}>
        {banners.map((_, i) => (
          <Dot key={i} index={i} scrollX={scrollX} slideWidth={SLIDE_WIDTH} active={i === index} />
        ))}
      </View>
    </View>
  );
}

function Dot({ index, scrollX, slideWidth, active }: { index: number; scrollX: SharedValue<number>; slideWidth: number; active: boolean }) {
  const style = useAnimatedStyle(() => {
    const input = [(index - 1) * slideWidth, index * slideWidth, (index + 1) * slideWidth];
    return { width: interpolate(scrollX.value, input, [6, 18, 6], Extrapolation.CLAMP) };
  });
  return <Animated.View style={[styles.dot, style, { opacity: active ? 1 : 0.4 }]} />;
}

const styles = StyleSheet.create({
  container: { marginBottom: 8 },
  slide: {
    height: 150,
    borderRadius: 18,
    overflow: 'hidden',
    marginHorizontal: 16,
  },
  slideImage: { width: '100%', height: '100%' },
  textOnlyContent: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 6 },
  heading: { color: '#FFF', fontSize: 22 },
  subheading: { color: 'rgba(255,255,255,0.85)', fontSize: 14 },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 10 },
  dot: { height: 6, borderRadius: 3, backgroundColor: '#1D4ED8' },
});
