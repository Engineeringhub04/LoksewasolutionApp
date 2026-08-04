// Global Bottom Sheet (PRD §8.4, §10.3): slide up + backdrop fade.
import React from 'react';
import { Modal, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/core/theme';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function BottomSheet({ visible, onClose, children }: BottomSheetProps) {
  const { colors, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={onClose}>
        <View
          style={{
            marginTop: 'auto',
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            paddingTop: spacing.sm,
            paddingBottom: insets.bottom + spacing.md,
            paddingHorizontal: spacing.lg,
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.border,
              marginBottom: spacing.md,
            }}
          />
          <Pressable onPress={(e) => e.stopPropagation()}>{children}</Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}
