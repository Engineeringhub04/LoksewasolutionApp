// Global Button component (PRD §8.1). Variants: primary, secondary, danger, text.
// States: default, pressed (opacity), disabled, loading (inline spinner replaces label).
import React from 'react';
import { Pressable, ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'text';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  fullWidth = true,
  style,
  testID,
}: ButtonProps) {
  const { colors, radius, spacing, typography } = useTheme();
  const isDisabled = disabled || loading;

  const backgroundFor = (pressed: boolean) => {
    if (variant === 'primary') return pressed ? colors.secondary : colors.primary;
    if (variant === 'danger') return pressed ? '#B91C1C' : colors.error;
    return 'transparent';
  };

  const borderFor = () => {
    if (variant === 'secondary') return colors.primary;
    return 'transparent';
  };

  const textColorFor = () => {
    if (variant === 'primary' || variant === 'danger') return colors.onPrimary;
    return colors.primary;
  };

  return (
    <Pressable
      testID={testID}
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: backgroundFor(pressed),
          borderColor: borderFor(),
          borderWidth: variant === 'secondary' ? 1.5 : 0,
          borderRadius: radius.md,
          paddingVertical: spacing.sm + 4,
          paddingHorizontal: spacing.lg,
          opacity: isDisabled ? 0.5 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColorFor()} />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text
            weight="semiBold"
            style={{ color: textColorFor(), fontSize: typography.bodyLarge.fontSize, marginLeft: icon ? spacing.sm : 0 }}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
