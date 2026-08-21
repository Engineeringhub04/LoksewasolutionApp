// Premium text input with an animated floating label — label sits inside the
// field as placeholder-like text, then floats above the border on focus/value.
import React, { useState } from 'react';
import { View, TextInput, Pressable, type TextInputProps, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  interpolateColor,
  Extrapolation,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';

export interface FloatingLabelFieldProps extends TextInputProps {
  label: string;
  errorText?: string;
  secureToggle?: boolean;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  containerStyle?: StyleProp<ViewStyle>;
  /** Auth screens stay light even when the app theme is dark. */
  lightTheme?: boolean;
}

const EASING = Easing.bezier(0.25, 0.1, 0.25, 1);

export function FloatingLabelField({
  label,
  errorText,
  secureToggle,
  leftIcon,
  containerStyle,
  secureTextEntry,
  value,
  style,
  onFocus,
  onBlur,
  multiline,
  lightTheme = false,
  ...rest
}: FloatingLabelFieldProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const inputColors = lightTheme
    ? {
        surface: '#FFFFFF',
        border: '#E5E7EB',
        textPrimary: '#1F2937',
        textSecondary: '#6B7280',
        textDisabled: '#9CA3AF',
        primary: '#7C3AED',
      }
    : {
        surface: colors.surface,
        border: colors.border,
        textPrimary: colors.textPrimary,
        textSecondary: colors.textSecondary,
        textDisabled: colors.textDisabled,
        primary: colors.primary,
      };
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secureTextEntry);
  const hasError = !!errorText;
  const hasValue = !!value && value.length > 0;

  const focusAnim = useSharedValue(hasValue || multiline ? 1 : 0);
  // Separate, slightly slower value purely for the border/label colour wash —
  // keeping colour and position on the same clock made the border feel like
  // it "snapped" the instant a finger left the field. Driving it independently
  // gives the whole field a single continuous, premium-feeling transition
  // rather than two things happening on the same rigid beat.
  const colorAnim = useSharedValue(focused ? 1 : 0);

  React.useEffect(() => {
    focusAnim.value = withTiming(focused || hasValue || multiline ? 1 : 0, { duration: 200, easing: EASING });
    colorAnim.value = withTiming(focused ? 1 : 0, { duration: 240, easing: EASING });
  }, [focused, hasValue, multiline, focusAnim, colorAnim]);

  const labelStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(focusAnim.value, [0, 1], [0, -22], Extrapolation.CLAMP) },
      { scale: interpolate(focusAnim.value, [0, 1], [1, 0.82], Extrapolation.CLAMP) },
    ],
  }));

  const labelColorStyle = useAnimatedStyle(() => ({
    color: hasError ? colors.error : interpolateColor(colorAnim.value, [0, 1], [inputColors.textSecondary, inputColors.primary]),
  }));

  const borderColorStyle = useAnimatedStyle(() => ({
    borderColor: hasError ? colors.error : interpolateColor(colorAnim.value, [0, 1], [inputColors.border, inputColors.primary]),
  }));

  return (
    <View style={containerStyle}>
      <Animated.View
        style={[
          {
            flexDirection: 'row',
            alignItems: multiline ? 'flex-start' : 'center',
            borderWidth: 1.5,
            borderRadius: radius.md,
            backgroundColor: inputColors.surface,
            paddingHorizontal: spacing.md,
            minHeight: 58,
            // Multiline fields grow with content, so the label needs its own
            // fixed offset near the top border instead of the single-line
            // vertical-center trick below — otherwise the label floats to the
            // middle of a tall box and lands on top of typed text.
            paddingTop: multiline ? 22 : 0,
            paddingBottom: multiline ? 10 : 0,
          },
          borderColorStyle,
        ]}
      >
        {leftIcon ? (
          <Ionicons name={leftIcon} size={20} color={focused ? inputColors.primary : inputColors.textSecondary} style={{ marginRight: spacing.sm, marginTop: multiline ? 2 : 0 }} />
        ) : null}

        <View style={{ flex: 1, justifyContent: multiline ? 'flex-start' : 'center' }}>
          {/* Floating label — anchored at the vertical center for single-line
             fields, or pinned near the top for multiline ones, then animates
             up/shrinks/recolours smoothly on focus/value either way. */}
          <Animated.View
            pointerEvents="none"
            style={[
              { position: 'absolute', left: 0, top: multiline ? -14 : undefined },
              labelStyle,
            ]}
          >
            <Animated.Text
              style={[
                { fontSize: typography.bodyLarge.fontSize, fontWeight: typography.bodyLarge.fontWeight },
                labelColorStyle,
                {
                  backgroundColor: focused || hasValue ? inputColors.surface : 'transparent',
                  paddingHorizontal: focused || hasValue ? 2 : 0,
                },
              ]}
            >
              {label}
            </Animated.Text>
          </Animated.View>

          <TextInput
            {...rest}
            value={value}
            multiline={multiline}
            secureTextEntry={secureToggle ? hidden : secureTextEntry}
            onFocus={(e) => { setFocused(true); onFocus?.(e); }}
            onBlur={(e) => { setFocused(false); onBlur?.(e); }}
            placeholder=""
            placeholderTextColor={inputColors.textDisabled}
            style={[
              {
                paddingTop: multiline ? 0 : 14,
                paddingBottom: multiline ? 0 : 2,
                fontSize: typography.bodyLarge.fontSize,
                color: inputColors.textPrimary,
              },
              style,
            ]}
          />
        </View>

        {secureToggle ? (
          <Pressable onPress={() => setHidden((h) => !h)} accessibilityLabel={hidden ? 'Show password' : 'Hide password'}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={inputColors.textSecondary} />
          </Pressable>
        ) : null}
      </Animated.View>
      {hasError ? (
        <Text variant="caption" style={{ color: colors.error, marginTop: spacing.xs }}>
          {errorText}
        </Text>
      ) : null}
    </View>
  );
}
