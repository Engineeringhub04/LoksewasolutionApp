// Renders the active toast from toastStore (PRD §8.4). Mount once in root layout.
// Premium design: the ENTIRE card is filled with the variant color (green for
// success, red for error, amber for warning, blue for info) with a white icon —
// not just a colored icon on a neutral card.
import React, { useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, { useSharedValue, withTiming, useAnimatedStyle } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/core/theme';
import { useToastStore, type ToastVariant } from '@/src/core/store/toastStore';
import { Text } from '@/src/components/misc/Text';

const AUTO_DISMISS_MS = 3000;

const iconFor: Record<ToastVariant, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  error: 'close-circle',
  warning: 'warning',
  info: 'information-circle',
};

const bgFor: Record<ToastVariant, string> = {
  success: '#16A34A',
  error: '#DC2626',
  warning: '#D97706',
  info: '#2563EB',
};

export function ToastHost() {
  const queue = useToastStore((s) => s.queue);
  const dismiss = useToastStore((s) => s.dismiss);
  const current = queue[0];

  if (!current) return null;

  return <ToastBubble key={current.id} message={current.message} variant={current.variant} onDone={() => dismiss(current.id)} />;
}

function ToastBubble({ message, variant, onDone }: { message: string; variant: ToastVariant; onDone: () => void }) {
  const { spacing, radius, motion } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(20);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withTiming(0, { duration: motion.standard });
    opacity.value = withTiming(1, { duration: motion.standard });
    const timer = setTimeout(onDone, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: spacing.md,
          right: spacing.md,
          bottom: insets.bottom + spacing.lg,
          backgroundColor: bgFor[variant],
          borderRadius: radius.md,
          padding: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        },
        animatedStyle,
      ]}
    >
      <Ionicons name={iconFor[variant]} size={22} color="#FFFFFF" />
      <Text variant="body" weight="semiBold" style={{ flex: 1, color: '#FFFFFF' }}>
        {message}
      </Text>
      <Pressable onPress={onDone} accessibilityLabel="Dismiss">
        <Ionicons name="close" size={18} color="rgba(255,255,255,0.85)" />
      </Pressable>
    </Animated.View>
  );
}
