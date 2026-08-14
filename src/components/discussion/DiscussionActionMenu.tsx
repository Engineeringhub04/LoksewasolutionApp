import React from 'react';
import { Modal, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { Text } from '@/src/components/misc/Text';

export interface DiscussionActionMenuItem {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  destructive?: boolean;
  onPress: () => void;
}

interface DiscussionActionMenuProps {
  visible: boolean;
  top: number;
  right?: number;
  actions: DiscussionActionMenuItem[];
  onClose: () => void;
}

export function DiscussionActionMenu({ visible, top, right = 18, actions, onClose }: DiscussionActionMenuProps) {
  const { colors, radius, spacing } = useTheme();
  const { t } = useTranslation();

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('common.cancel')}>
        <Animated.View
          entering={FadeIn.duration(140)}
          exiting={FadeOut.duration(140)}
          style={[styles.card, { top, right, backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, padding: spacing.xs }]}
        >
          {actions.map((action) => (
            <Pressable
              key={action.label}
              onPress={() => {
                onClose();
                action.onPress();
              }}
              style={({ pressed }) => [styles.row, { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm }, pressed && styles.pressed]}
            >
              <Ionicons name={action.icon} size={18} color={action.destructive ? colors.error : colors.textPrimary} />
              <Text variant="bodySmall" weight="semiBold" style={{ color: action.destructive ? colors.error : colors.textPrimary, flex: 1 }}>
                {action.label}
              </Text>
            </Pressable>
          ))}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    width: 214,
    borderWidth: 1,
    shadowColor: '#0F172A',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 9,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10 },
  pressed: { opacity: 0.65, transform: [{ scale: 0.98 }] },
});

export default DiscussionActionMenu;

