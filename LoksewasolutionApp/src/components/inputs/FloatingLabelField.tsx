// Premium text input with an animated floating label — label sits inside the
// field as placeholder-like text, then floats above the border on focus/value.
import React, { useState } from 'react';
import { View, TextInput, Pressable, type TextInputProps, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, interpolate, Extrapolation } from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';

export interface FloatingLabelFieldProps extends TextInputProps {
  label: string;
  errorText?: string;
  secureToggle?: boolean;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  containerStyle?: StyleProp<ViewStyle>;
}

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
  ...rest
}: FloatingLabelFieldProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secureTextEntry);
  const hasError = !!errorText;
  const hasValue = !!value && value.length > 0;

  const focusAnim = useSharedValue(hasValue ? 1 : 0);

  React.useEffect(() => {
    focusAnim.value = withTiming(focused || hasValue ? 1 : 0, { duration: 180 });
  }, [focused, hasValue, focusAnim]);

  const labelStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(focusAnim.value, [0, 1], [0, -22], Extrapolation.CLAMP) },
      { scale: interpolate(focusAnim.value, [0, 1], [1, 0.82], Extrapolation.CLAMP) },
    ],
  }));

  return (
    <View style={containerStyle}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1.5,
          borderColor: hasError ? colors.error : focused ? colors.primary : colors.border,
          borderRadius: radius.md,
          backgroundColor: colors.surface,
          paddingHorizontal: spacing.md,
          minHeight: 58,
        }}
      >
        {leftIcon ? (
          <Ionicons name={leftIcon} size={20} color={focused ? colors.primary : colors.textSecondary} style={{ marginRight: spacing.sm }} />
        ) : null}

        <View style={{ flex: 1, justifyContent: 'center' }}>
          {/* Floating label — anchored at the vertical center, animates up on focus/value */}
          <Animated.View
            pointerEvents="none"
            style={[
              { position: 'absolute', left: 0 },
              labelStyle,
            ]}
          >
            <Text
              variant="bodyLarge"
              style={{
                color: hasError ? colors.error : focused ? colors.primary : colors.textSecondary,
                backgroundColor: focused || hasValue ? colors.surface : 'transparent',
                paddingHorizontal: focused || hasValue ? 2 : 0,
              }}
            >
              {label}
            </Text>
          </Animated.View>

          <TextInput
            {...rest}
            value={value}
            secureTextEntry={secureToggle ? hidden : secureTextEntry}
            onFocus={(e) => { setFocused(true); onFocus?.(e); }}
            onBlur={(e) => { setFocused(false); onBlur?.(e); }}
            placeholder=""
            placeholderTextColor={colors.textDisabled}
            style={[
              {
                paddingTop: 14,
                paddingBottom: 2,
                fontSize: typography.bodyLarge.fontSize,
                color: colors.textPrimary,
              },
              style,
            ]}
          />
        </View>

        {secureToggle ? (
          <Pressable onPress={() => setHidden((h) => !h)} accessibilityLabel={hidden ? 'Show password' : 'Hide password'}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      {hasError ? (
        <Text variant="caption" style={{ color: colors.error, marginTop: spacing.xs }}>
          {errorText}
        </Text>
      ) : null}
    </View>
  );
}
