// AppDialog — the ONE modal shell every dialog in this app is built from.
//
// Anything that stops the user to say or ask something goes through here: the
// confirmations (via ConfirmDialog, which wraps this), the Daily Test rules popup,
// the exam rules sheet, premium gates, report forms. One shell means one look: a
// coloured gradient cap with an icon badge, an optional subtitle, a scrollable
// body, and a footer where Cancel is always visually secondary to Confirm.
//
// If you need a dialog, do NOT hand-roll a <Modal> — import ConfirmDialog for a
// yes/no question, or this shell directly when the body needs custom content.
// (This file was `PremiumDialog`; the name suggested it was about subscriptions,
// which it never was.)
//
// Tapping the backdrop does NOT dismiss. These dialogs all ask a real question,
// so the only ways out are Cancel and Confirm — and, just as importantly, the
// backdrop is a plain View rather than a Pressable, which is what lets the body
// ScrollView receive drag gestures instead of losing them to the wrapper.
//
// FADE IN / FADE OUT comes from the Modal's own `animationType="fade"` (it plays
// on dismiss too, which a reanimated `exiting` cannot do once the Modal unmounts),
// and the card adds a soft fade of its own — no slide, no spring.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, View, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';

/** Auto-scroll pacing: 1px every 30ms ≈ 33px/s — slow enough to read along. */
const AUTO_STEP_PX = 1;
const AUTO_TICK_MS = 30;
/** Grace period before auto-scroll starts, so the first rules are readable. */
const AUTO_START_DELAY_MS = 1200;
/** How long after the user's last touch auto-scroll picks up again. */
const AUTO_RESUME_MS = 3000;
/**
 * Beat held at each end before the creep turns around. Without it the reversal
 * looks like a glitch — the text would appear to bounce off the edge — and the
 * last rule would never sit still long enough to finish reading.
 */
const AUTO_TURN_HOLD_MS = 1100;
const AUTO_TURN_HOLD_TICKS = Math.round(AUTO_TURN_HOLD_MS / AUTO_TICK_MS);

export interface AppDialogProps {
  visible: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  message?: string;
  /** Accent colour for the gradient cap and the confirm button. */
  accent?: string;
  /** Body slot rendered inside the card's scroll area (e.g. a numbered list). */
  children?: React.ReactNode;
  /**
   * Creeps the body up and down on its own so long content (the rules list) is
   * seen without the user having to drag. It ping-pongs: on reaching the bottom
   * it pauses for a beat and creeps back to the top, then down again, for as long
   * as the dialog is open. Any touch pauses it; it resumes 3s after the finger
   * lifts.
   */
  autoScroll?: boolean;
  confirmLabel: string;
  confirmIcon?: keyof typeof Ionicons.glyphMap;
  cancelLabel?: string;
  /** Hides Cancel and lets Confirm take the full width. */
  singleButton?: boolean;
  /** Greys out Confirm — for dialogs that gate on typed input or a selection. */
  confirmDisabled?: boolean;
  /** Spinner in place of the confirm label while the action is in flight. */
  confirmLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Slightly darker companion for the accent, so the cap reads as a gradient. */
function darken(hex: string): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return hex;
  const value = parseInt(match[1], 16);
  const r = Math.round(((value >> 16) & 0xff) * 0.72);
  const g = Math.round(((value >> 8) & 0xff) * 0.72);
  const b = Math.round((value & 0xff) * 0.72);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export function AppDialog({
  visible,
  icon,
  title,
  subtitle,
  message,
  accent,
  children,
  autoScroll,
  confirmLabel,
  confirmIcon,
  cancelLabel,
  singleButton,
  confirmDisabled,
  confirmLoading,
  onConfirm,
  onCancel,
}: AppDialogProps) {
  const { colors, radius, spacing } = useTheme();
  const tone = accent ?? colors.primary;
  const confirmBlocked = !!confirmDisabled || !!confirmLoading;

  // --- Auto-scroll ------------------------------------------------------------
  // Position/size live in refs (they change every frame and must not re-render);
  // only the on/off switch is state, because the ticker effect depends on it.
  const scrollRef = useRef<ScrollView>(null);
  const offsetRef = useRef(0);
  const contentHeightRef = useRef(0);
  const viewportHeightRef = useRef(0);
  /** +1 creeping down, −1 creeping back up. */
  const directionRef = useRef<1 | -1>(1);
  /** Ticks still to skip while resting at an end before turning around. */
  const holdTicksRef = useRef(0);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [autoRunning, setAutoRunning] = useState(false);

  const clearResume = () => {
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  };

  // Reset on every open so a re-opened dialog starts from the first rule again.
  useEffect(() => {
    clearResume();
    setAutoRunning(false);
    offsetRef.current = 0;
    directionRef.current = 1;
    holdTicksRef.current = 0;
    if (!visible || !autoScroll) return;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    const id = setTimeout(() => setAutoRunning(true), AUTO_START_DELAY_MS);
    return () => clearTimeout(id);
  }, [visible, autoScroll]);

  // The creep itself. `animated: false` + 1px steps reads as smooth motion,
  // whereas animated jumps would fight the user's own scrolling.
  //
  // It PING-PONGS rather than stopping at the bottom. Stopping meant a user who
  // glanced away missed the tail of the rules for good — the list just sat at the
  // end with no hint that it had moved. Turning around means every rule comes
  // back round, so the popup keeps reading itself out for as long as it is open.
  useEffect(() => {
    if (!autoRunning) return;
    const id = setInterval(() => {
      const max = contentHeightRef.current - viewportHeightRef.current;
      // Content fits: nothing to creep through, and no end to turn at.
      if (max <= 0) return;

      // Resting at an end. The direction was already flipped when we arrived.
      if (holdTicksRef.current > 0) {
        holdTicksRef.current -= 1;
        return;
      }

      const next = offsetRef.current + AUTO_STEP_PX * directionRef.current;

      // Clamped to the ends, and each arrival flips the direction and starts the
      // hold — so the turn happens once, not on every subsequent tick.
      if (next >= max) {
        offsetRef.current = max;
        directionRef.current = -1;
        holdTicksRef.current = AUTO_TURN_HOLD_TICKS;
      } else if (next <= 0) {
        offsetRef.current = 0;
        directionRef.current = 1;
        holdTicksRef.current = AUTO_TURN_HOLD_TICKS;
      } else {
        offsetRef.current = next;
      }

      scrollRef.current?.scrollTo({ y: offsetRef.current, animated: false });
    }, AUTO_TICK_MS);
    return () => clearInterval(id);
  }, [autoRunning]);

  useEffect(() => clearResume, []);

  /** Any finger on the list stops the creep immediately. */
  const pauseAuto = useCallback(() => {
    if (!autoScroll) return;
    clearResume();
    setAutoRunning(false);
  }, [autoScroll]);

  /** …and it picks up again 3s after that finger lifts. */
  const scheduleResume = useCallback(() => {
    if (!autoScroll) return;
    clearResume();
    resumeTimerRef.current = setTimeout(() => setAutoRunning(true), AUTO_RESUME_MS);
  }, [autoScroll]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
      {/* Plain View, not a Pressable: the backdrop must not dismiss, and it must
          not swallow the drag gestures the body ScrollView needs. */}
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <Animated.View
          entering={FadeIn.duration(200)}
          style={[styles.cardWrap, { borderRadius: 26 }]}
        >
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            {/* Gradient cap */}
            <LinearGradient
              colors={[tone, darken(tone)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cap}
            >
              <View style={styles.capGlow} />
              <View style={styles.capIcon}>
                <Ionicons name={icon} size={24} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="h3" weight="bold" style={styles.capTitle} numberOfLines={2}>
                  {title}
                </Text>
                {subtitle ? (
                  <Text variant="caption" style={styles.capSubtitle} numberOfLines={1}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
            </LinearGradient>

            {/* Body — scrolls when the content (e.g. a long rules list) is
                taller than the card, so the footer buttons stay pinned. */}
            <ScrollView
              ref={scrollRef}
              style={styles.body}
              contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
              showsVerticalScrollIndicator
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              scrollEventThrottle={16}
              onScroll={(e) => {
                offsetRef.current = e.nativeEvent.contentOffset.y;
              }}
              onLayout={(e) => {
                viewportHeightRef.current = e.nativeEvent.layout.height;
              }}
              onContentSizeChange={(_w, h) => {
                contentHeightRef.current = h;
              }}
              onTouchStart={pauseAuto}
              onTouchEnd={scheduleResume}
              onTouchCancel={scheduleResume}
              onScrollBeginDrag={pauseAuto}
              onScrollEndDrag={scheduleResume}
              onMomentumScrollEnd={scheduleResume}
            >
              {message ? (
                <Text variant="body" secondary style={{ lineHeight: 21 }}>
                  {message}
                </Text>
              ) : null}
              {children}
            </ScrollView>

            {/* Footer */}
            <View
              style={[
                styles.footer,
                { borderTopColor: colors.divider, padding: spacing.md, gap: spacing.sm },
              ]}
            >
              {!singleButton ? (
                <Pressable
                  onPress={onCancel}
                  disabled={confirmLoading}
                  style={({ pressed }) => [
                    styles.ghostBtn,
                    {
                      borderColor: colors.border,
                      backgroundColor: pressed ? colors.surfaceAlt : 'transparent',
                      borderRadius: radius.md,
                      opacity: confirmLoading ? 0.5 : 1,
                    },
                  ]}
                >
                  <Text variant="bodySmall" weight="bold" secondary>
                    {cancelLabel ?? 'Cancel'}
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                onPress={onConfirm}
                disabled={confirmBlocked}
                style={({ pressed }) => [
                  styles.confirmBtn,
                  {
                    borderRadius: radius.md,
                    // Disabled reads as "not yet", not as broken: the fill stays,
                    // it just loses its weight.
                    opacity: confirmBlocked ? 0.45 : pressed ? 0.88 : 1,
                  },
                ]}
              >
                <LinearGradient
                  colors={[tone, darken(tone)]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.confirmFill}
                >
                  {confirmLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      {confirmIcon ? <Ionicons name={confirmIcon} size={16} color="#FFFFFF" /> : null}
                      <Text variant="bodySmall" weight="bold" style={{ color: '#FFFFFF' }}>
                        {confirmLabel}
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  cardWrap: {
    width: '100%',
    // Deliberately narrow — a wide dialog reads like a page, not a prompt.
    maxWidth: 340,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
  },
  // flexShrink lets the card collapse to the wrapper's maxHeight instead of
  // overflowing it — that shrink is passed down to the body ScrollView so the
  // footer buttons can never be pushed off-screen, however many rules there are.
  card: { borderRadius: 26, overflow: 'hidden', flexShrink: 1 },
  cap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 18,
    overflow: 'hidden',
    flexShrink: 0,
  },
  capGlow: {
    position: 'absolute',
    top: -34,
    right: -18,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  capIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  capTitle: { color: '#FFFFFF' },
  capSubtitle: { color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  body: { flexGrow: 0, flexShrink: 1 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexShrink: 0,
  },
  ghostBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderWidth: 1.5,
  },
  confirmBtn: { flex: 1.4, overflow: 'hidden' },
  confirmFill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 14,
  },
});
