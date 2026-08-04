// Animated theme toggle button — icon rotates and cross-fades between
// sun/moon when switching, instead of an instant swap.
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

  useEffect(() => {
    rotation.value = withTiming(rotation.value + 180, { duration: 400, easing: Easing.out(Easing.ease) });
    scale.value = withSequence(
      withTiming(0.75, { duration: 150 }),
      withTiming(1, { duration: 200, easing: Easing.out(Easing.back(1.4)) })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }, { scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onToggle}
      style={[styles.button, { width: size, height: size, borderRadius: size / 3.6, backgroundColor }]}
      accessibilityLabel={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      <Animated.View style={animatedStyle}>
        <Ionicons name={isDark ? 'sunny' : 'moon'} size={size * 0.55} color={iconColor} />
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
