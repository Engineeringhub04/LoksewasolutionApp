// Exam rules popup.
//
// Opened either from a card's "Rules" button (informational — primary action is
// just "OK") or immediately before an attempt starts (primary action becomes
// "Start Quiz"). The caller decides via `primaryLabel`.
//
// Uses real Ionicons throughout rather than emoji, per the design direction.
import React from 'react';
import { Modal, View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';
import { Spinner } from '@/src/components/feedback/Spinner';
import type { ExamRule } from '@/src/core/firebase/services/examHub';

interface ExamRulesSheetProps {
  visible: boolean;
  onClose: () => void;
  rules: ExamRule[];
  loading?: boolean;
  examTitle?: string;
  /** Accent colour of the owning section. */
  accentColor?: string;
  /** Label for the confirming button — e.g. "OK" or "Start Quiz". */
  primaryLabel: string;
  /** Called when the primary button is pressed. Defaults to closing. */
  onPrimaryPress?: () => void;
}

export function ExamRulesSheet({
  visible,
  onClose,
  rules,
  loading = false,
  examTitle,
  accentColor = '#2563EB',
  primaryLabel,
  onPrimaryPress,
}: ExamRulesSheetProps) {
  const { colors, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(180)} style={[styles.backdrop, { paddingBottom: insets.bottom }]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} accessibilityLabel="Close rules" />

        <Animated.View
          entering={FadeInDown.duration(260)}
          style={[styles.card, { backgroundColor: colors.surface, borderRadius: radius.lg }]}
        >
          {/* Header */}
          <LinearGradient
            colors={[accentColor, `${accentColor}CC`]}
            style={[styles.header, { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }]}
          >
            <View style={styles.headerIcon}>
              <Ionicons name="shield-checkmark" size={22} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="h3" weight="bold" style={styles.headerTitle}>Exam Rules</Text>
              {examTitle ? (
                <Text variant="caption" style={styles.headerSubtitle} numberOfLines={1}>{examTitle}</Text>
              ) : null}
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={22} color="#FFF" />
            </Pressable>
          </LinearGradient>

          {/* Rules */}
          {loading ? (
            <View style={styles.loadingBox}>
              <Spinner />
            </View>
          ) : rules.length === 0 ? (
            <View style={styles.loadingBox}>
              <Ionicons name="document-text-outline" size={40} color={colors.textDisabled} />
              <Text variant="bodySmall" secondary style={{ textAlign: 'center', marginTop: spacing.sm }}>
                Rules for this exam have not been published yet.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={{ maxHeight: 420 }}
              contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
              showsVerticalScrollIndicator={false}
            >
              {rules.map((rule, index) => (
                <Animated.View
                  key={`${rule.title}-${index}`}
                  entering={FadeInDown.delay(index * 45).duration(240)}
                  style={styles.ruleRow}
                >
                  <View style={[styles.ruleIcon, { backgroundColor: `${accentColor}17`, borderRadius: radius.md }]}>
                    <Ionicons name={rule.icon as never} size={18} color={accentColor} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={styles.ruleTitleRow}>
                      <View style={[styles.stepBadge, { backgroundColor: `${accentColor}17` }]}>
                        <Text variant="caption" weight="bold" style={{ color: accentColor }}>{index + 1}</Text>
                      </View>
                      <Text variant="body" weight="bold" style={{ flex: 1 }}>{rule.title}</Text>
                    </View>
                    <Text variant="bodySmall" secondary style={{ lineHeight: 19 }}>{rule.description}</Text>
                  </View>
                </Animated.View>
              ))}
            </ScrollView>
          )}

          {/* Primary action */}
          <View style={[styles.footer, { borderTopColor: colors.divider, padding: spacing.md }]}>
            <Pressable
              onPress={onPrimaryPress ?? onClose}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: accentColor, borderRadius: radius.md, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text variant="body" weight="bold" style={{ color: '#FFF' }}>{primaryLabel}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: { width: '100%', maxWidth: 480, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: '#FFF' },
  headerSubtitle: { color: 'rgba(255,255,255,0.85)' },
  loadingBox: { padding: 32, alignItems: 'center', justifyContent: 'center' },
  ruleRow: { flexDirection: 'row', gap: 12 },
  ruleIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  ruleTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  footer: { borderTopWidth: StyleSheet.hairlineWidth },
  primaryButton: { paddingVertical: 14, alignItems: 'center' },
});
