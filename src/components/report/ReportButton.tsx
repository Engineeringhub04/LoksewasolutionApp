// The flag icon plus its dialog, as one drop-in component.
//
// Every screen that can be reported renders this and passes what is being
// reported; the popup, the submission and the toasts are handled inside. That
// keeps the call sites to a single element and guarantees the report shape is
// identical everywhere.
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { ReportDialog, type ReportTargetInput } from '@/src/components/report/ReportDialog';

export interface ReportButtonProps {
  /** Built lazily on press so screens don't rebuild the context block every render. */
  target: ReportTargetInput | (() => ReportTargetInput);
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  hitSlop?: number;
}

export function ReportButton({ target, size = 21, color, style, hitSlop = 8 }: ReportButtonProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [resolved, setResolved] = useState<ReportTargetInput | null>(null);
  const pop = useSharedValue(1);

  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const onPress = useCallback(() => {
    pop.value = withSequence(withTiming(0.84, { duration: 90 }), withSpring(1, { damping: 9, stiffness: 240 }));
    setResolved(typeof target === 'function' ? target() : target);
    setOpen(true);
  }, [pop, target]);

  return (
    <>
      <Pressable
        onPress={onPress}
        hitSlop={hitSlop}
        accessibilityRole="button"
        accessibilityLabel={t('report.action')}
        style={[styles.button, { width: size + 9, height: size + 9 }, style]}
      >
        <Animated.View style={popStyle}>
          <Ionicons name="flag-outline" size={size} color={color ?? colors.error} />
        </Animated.View>
      </Pressable>
      <ReportDialog visible={open} target={resolved} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center' },
});
