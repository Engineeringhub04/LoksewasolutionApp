// Global Text Input (PRD §8.2): label, helper text, error text.
import React, { useState } from 'react';
import { View, TextInput, Pressable, type TextInputProps, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';

export interface TextFieldProps extends TextInputProps {
  label?: string;
  helperText?: string;
  errorText?: string;
  secureToggle?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

export function TextField({
  label,
  helperText,
  errorText,
  secureToggle,
  containerStyle,
  secureTextEntry,
  style,
  ...rest
}: TextFieldProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secureTextEntry);
  const hasError = !!errorText;

  return (
    <View style={containerStyle}>
      {label ? (
        <Text variant="bodySmall" weight="medium" secondary style={{ marginBottom: spacing.xs }}>
          {label}
        </Text>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1.5,
          borderColor: hasError ? colors.error : focused ? colors.primary : colors.border,
          borderRadius: radius.md,
          backgroundColor: colors.surface,
          paddingHorizontal: spacing.md,
        }}
      >
        <TextInput
          {...rest}
          secureTextEntry={secureToggle ? hidden : secureTextEntry}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          placeholderTextColor={colors.textDisabled}
          style={[
            {
              flex: 1,
              paddingVertical: spacing.sm + 4,
              fontSize: typography.bodyLarge.fontSize,
              color: colors.textPrimary,
            },
            style,
          ]}
        />
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
      ) : helperText ? (
        <Text variant="caption" secondary style={{ marginTop: spacing.xs }}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}
