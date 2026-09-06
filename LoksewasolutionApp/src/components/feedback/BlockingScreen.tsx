// Shared layout for Blocking Screens (PRD §45): calm illustration + fade-in, no alarming styling.
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { useSharedValue, withTiming, useAnimatedStyle } from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';

export interface BlockingScreenProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionLoading?: boolean;
}

export function BlockingScreen({ icon, title, description, actionLabel, onAction, actionLoading }: BlockingScreenProps) {
  const { colors, spacing } = useTheme();
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 500 });
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
      <Animated.View style={[{ alignItems: 'center', gap: spacing.md, maxWidth: 320 }, animatedStyle]}>
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: 48,
            backgroundColor: colors.surfaceAlt,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={44} color={colors.primary} />
        </View>
        <Text variant="h2" weight="semiBold" style={{ textAlign: 'center' }}>
          {title}
        </Text>
        <Text variant="body" secondary style={{ textAlign: 'center' }}>
          {description}
        </Text>
        {actionLabel && onAction ? (
          <Button label={actionLabel} onPress={onAction} loading={actionLoading} style={{ marginTop: spacing.md }} />
        ) : null}
      </Animated.View>
    </View>
  );
}
