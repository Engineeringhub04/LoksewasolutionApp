// Individual onboarding slide — shows image (local/network), title, and description.
// Uses expo-image for optimized rendering and disk caching of remote images.
import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  FadeInUp,
  FadeInDown,
} from 'react-native-reanimated';
import { Text } from '@/src/components/misc/Text';
import type { OnboardingSlide as SlideData } from '@/src/core/firebase/services/onboarding';

// Metro statically resolves require() calls — map local paths to bundled assets.
const LOCAL_IMAGES: Record<string, ReturnType<typeof require>> = {
  'assets/images/ws-weeklytest.png': require('../../../assets/images/ws-weeklytest.png'),
  'assets/images/ws-leaderboard_analytics.png': require('../../../assets/images/ws-leaderboard_analytics.png'),
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface OnboardingSlideProps {
  slide: SlideData;
  slideWidth: number;
  isActive: boolean;
}

export function OnboardingSlideView({ slide, slideWidth, isActive }: OnboardingSlideProps) {
  const imageSource = slide.isLocal
    ? LOCAL_IMAGES[slide.imageLink]
    : { uri: slide.imageLink };

  return (
    <View style={[styles.container, { width: slideWidth }]}>
      {/* Image Section */}
      <View style={styles.imageContainer}>
        <View style={styles.imageWrapper}>
          <Image
            source={imageSource}
            style={styles.image}
            contentFit="contain"
            cachePolicy="disk"
            transition={300}
            placeholder={undefined}
          />
        </View>
      </View>

      {/* Text Section */}
      <View style={styles.textContainer}>
        <Animated.View entering={isActive ? FadeInUp.delay(200).duration(500) : undefined}>
          <Text
            variant="h1"
            weight="bold"
            style={styles.title}
          >
            {slide.title}
          </Text>
        </Animated.View>

        <Animated.View entering={isActive ? FadeInDown.delay(400).duration(500) : undefined}>
          <Text
            variant="body"
            style={styles.description}
          >
            {slide.description}
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    flex: 5,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingTop: 40,
  },
  imageWrapper: {
    width: SCREEN_WIDTH * 0.7,
    height: SCREEN_WIDTH * 0.7,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    // Subtle shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  image: {
    width: '90%',
    height: '90%',
  },
  textContainer: {
    flex: 3,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 24,
    gap: 12,
  },
  title: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 28,
    letterSpacing: 0.5,
  },
  description: {
    color: '#FFFFFF',
    textAlign: 'center',
    opacity: 0.85,
    fontSize: 16,
    lineHeight: 24,
    paddingHorizontal: 8,
  },
});
