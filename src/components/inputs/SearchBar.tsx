import React from 'react';
import { View, TextInput, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';

export interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  autoFocus?: boolean;
  filterSlot?: React.ReactNode;
}

export function SearchBar({ value, onChangeText, placeholder, onSubmit, autoFocus, filterSlot }: SearchBarProps) {
  const { colors, spacing, radius, typography } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surfaceAlt,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.md,
        height: 44,
      }}
    >
      <Ionicons name="search" size={18} color={colors.textSecondary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textDisabled}
        autoFocus={autoFocus}
        onSubmitEditing={onSubmit}
        returnKeyType="search"
        style={{ flex: 1, marginLeft: spacing.sm, fontSize: typography.body.fontSize, color: colors.textPrimary }}
      />
      {value.length > 0 ? (
        <Pressable onPress={() => onChangeText('')} accessibilityLabel="Clear search">
          <Ionicons name="close-circle" size={18} color={colors.textDisabled} />
        </Pressable>
      ) : null}
      {filterSlot}
    </View>
  );
}
