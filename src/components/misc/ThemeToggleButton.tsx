// Animated theme toggle button. Shows the icon for the CURRENT theme mode
// (sun while in light mode, moon while in dark mode) — per explicit user
// feedback that the "destination theme" convention looked backwards here.
// Transitions with a slower, smoother rotate + fade + scale for a premium feel.
import React, { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence, Easing } from 'react-native-reanimated';

interface ThemeToggleButtonProps {
  isDark: boolean;
  onToggle: () => void;
  size?: number;
  iconColor?: string;
  backgroundColor?: string;
}

export function ThemeToggleButton({
  isDark,
  onToggle,
  size = 36,
  iconColor = '#FFFFFF',
  backgroundColor = 'rgba(255,255,255,0.2)',
}: ThemeToggleButtonProps) {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    // Slower, more deliberate transition for a premium feel.
    rotation.value = withTiming(rotation.value + 180, { duration: 650, easing: Easing.inOut(Easing.cubic) });
    opacity.value = withSequence(
      withTiming(0.35, { duration: 250, easing: Easing.out(Easing.ease) }),
      withTiming(1, { duration: 400, easing: Easing.in(Easing.ease) })
    );
    scale.value = withSequence(
      withTiming(0.7, { duration: 250, easing: Easing.out(Easing.ease) }),
      withTiming(1, { duration: 400, easing: Easing.out(Easing.back(1.3)) })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ rotate: `${rotation.value}deg` }, { scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onToggle}
      style={[styles.button, { width: size, height: size, borderRadius: size / 3.6, backgroundColor }]}
      accessibilityLabel={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      <Animated.View style={animatedStyle}>
        {/* Icon shows the CURRENT theme: sun while light, moon while dark */}
        <Ionicons name={isDark ? 'moon' : 'sunny'} size={size * 0.55} color={iconColor} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
