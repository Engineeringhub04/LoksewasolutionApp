// Auto-sliding carousel for the Daily Test model cards.
//
// Behaviour (per the feature spec): the slides advance smoothly every 3s, the
// timer STOPS the moment the user touches the strip, and auto-slide resumes 3s
// after they let go — so a manual swipe is never fought by the timer.
//
// Implementation notes:
// - A plain ScrollView with `pagingEnabled` and snap offsets is used rather than
//   FlatList: there are only ever a handful of slides, so virtualisation costs
//   more than it saves and paging maths stays simple.
// - `onTouchStart` / `onScrollBeginDrag` pause; `onTouchEnd`, `onTouchCancel` and
//   `onMomentumScrollEnd` arm the 3s resume. Every arm clears the previous timer,
//   so holding a finger down never queues up a burst of slides.
// - The index is tracked in state only to drive the dots, and the auto-advance
//   reads it through a ref so the interval never needs re-creating.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { useTheme } from '@/src/core/theme';

const AUTO_SLIDE_MS = 3000;
const RESUME_DELAY_MS = 3000;

export interface DailyTestCarouselProps {
  /** One element per slide. Each is rendered at the width given to the child. */
  children: React.ReactNode;
  /** Horizontal padding of the containing screen, used to size each slide. */
  screenPadding?: number;
  /** Gap between slides. */
  gap?: number;
}

export function DailyTestCarousel({ children, screenPadding = 16, gap = 12 }: DailyTestCarouselProps) {
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();

  const slides = React.Children.toArray(children).filter(Boolean);
  const count = slides.length;

  const slideWidth = windowWidth - screenPadding * 2;
  const stride = slideWidth + gap;

  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const [paused, setPaused] = useState(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setIndexBoth = useCallback((next: number) => {
    indexRef.current = next;
    setIndex(next);
  }, []);

  // Auto-advance. Recreated only when the slide count or paused state changes.
  useEffect(() => {
    if (paused || count < 2) return;
    const interval = setInterval(() => {
      const next = (indexRef.current + 1) % count;
      indexRef.current = next;
      setIndex(next);
      scrollRef.current?.scrollTo({ x: next * stride, animated: true });
    }, AUTO_SLIDE_MS);
    return () => clearInterval(interval);
  }, [paused, count, stride]);

  // Clean up a pending resume when the screen goes away.
  useEffect(
    () => () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    },
    [],
  );

  const pause = useCallback(() => {
    if (resumeTimer.current) {
      clearTimeout(resumeTimer.current);
      resumeTimer.current = null;
    }
    setPaused(true);
  }, []);

  const scheduleResume = useCallback(() => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => {
      resumeTimer.current = null;
      setPaused(false);
    }, RESUME_DELAY_MS);
  }, []);

  const handleScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(event.nativeEvent.contentOffset.x / stride);
      setIndexBoth(Math.max(0, Math.min(count - 1, next)));
      scheduleResume();
    },
    [stride, count, setIndexBoth, scheduleResume],
  );

  if (count === 0) return null;

  return (
    <View>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={stride}
        snapToAlignment="start"
        disableIntervalMomentum
        contentContainerStyle={{ paddingHorizontal: screenPadding, gap }}
        onTouchStart={pause}
        onScrollBeginDrag={pause}
        onTouchEnd={scheduleResume}
        onTouchCancel={scheduleResume}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
      >
        {slides.map((slide, i) => (
          <View key={i} style={{ width: slideWidth }}>
            {slide}
          </View>
        ))}
      </ScrollView>

      {count > 1 ? (
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  width: i === index ? 20 : 7,
                  backgroundColor: i === index ? colors.primary : colors.border,
                },
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  dot: { height: 7, borderRadius: 4 },
});
