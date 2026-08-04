// Renders the active toast from toastStore (PRD §8.4). Mount once in root layout.
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

export function ToastHost() {
  const queue = useToastStore((s) => s.queue);
  const dismiss = useToastStore((s) => s.dismiss);
  const current = queue[0];

  if (!current) return null;

  return <ToastBubble key={current.id} message={current.message} variant={current.variant} onDone={() => dismiss(current.id)} />;
}

function ToastBubble({ message, variant, onDone }: { message: string; variant: ToastVariant; onDone: () => void }) {
  const { colors, spacing, radius, motion } = useTheme();
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

  const colorFor: Record<ToastVariant, string> = {
    success: colors.success,
    error: colors.error,
    warning: colors.warning,
    info: colors.info,
  };

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
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          padding: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          shadowColor: '#000',
          shadowOpacity: 0.15,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        },
        animatedStyle,
      ]}
    >
      <Ionicons name={iconFor[variant]} size={20} color={colorFor[variant]} />
      <Text variant="body" style={{ flex: 1 }}>
        {message}
      </Text>
      <Pressable onPress={onDone} accessibilityLabel="Dismiss">
        <Ionicons name="close" size={16} color={colors.textSecondary} />
      </Pressable>
    </Animated.View>
  );
}
