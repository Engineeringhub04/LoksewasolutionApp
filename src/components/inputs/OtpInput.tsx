import React, { useRef } from 'react';
import { View, TextInput } from 'react-native';
import { useTheme } from '@/src/core/theme';

export interface OtpInputProps {
  length?: number;
  value: string;
  onChangeText: (value: string) => void;
}

export function OtpInput({ length = 6, value, onChangeText }: OtpInputProps) {
  const { colors, radius, spacing, typography } = useTheme();
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const digits = value.split('').concat(Array(length).fill('')).slice(0, length);

  const setDigit = (index: number, digit: string) => {
    const clean = digit.replace(/[^0-9]/g, '').slice(-1);
    const next = digits.slice();
    next[index] = clean;
    onChangeText(next.join(''));
    if (clean && index < length - 1) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {digits.map((digit, index) => (
        <TextInput
          key={index}
          ref={(ref) => {
            inputRefs.current[index] = ref;
          }}
          value={digit}
          onChangeText={(text) => setDigit(index, text)}
          onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
          keyboardType="number-pad"
          maxLength={1}
          textAlign="center"
          style={{
            width: 44,
            height: 52,
            borderWidth: 1.5,
            borderColor: digit ? colors.primary : colors.border,
            borderRadius: radius.md,
            fontSize: typography.h2.fontSize,
            color: colors.textPrimary,
            backgroundColor: colors.surface,
            marginHorizontal: spacing.xs / 2,
          }}
        />
      ))}
    </View>
  );
}
