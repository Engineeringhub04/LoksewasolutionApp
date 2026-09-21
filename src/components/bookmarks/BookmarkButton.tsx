// One bookmark icon, used everywhere — exam quiz, subject read/practice, GK & PM,
// daily test, question of the day, articles. It owns the whole interaction:
// optimistic save/remove, the free-tier cap, and the right toast for each outcome.
//
// ANIMATION NOTES (hard-won): Ionicons' `color` prop is not animatable, so the
// filled and outline glyphs are stacked and cross-faded by opacity instead. The
// press feedback is a spring "pop" on scale — never on a layout prop.
import React, { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { showToast } from '@/src/core/store/toastStore';
import { useAuthStore } from '@/src/core/store/authStore';
import { useProfileStore } from '@/src/core/store/profileStore';
import { useBookmarkStore } from '@/src/core/store/bookmarkStore';
import { hasActivePremium } from '@/src/core/firebase/services/profile';
import { bookmarkDocId, type BookmarkContext, type BookmarkKind, type BookmarkPayload } from '@/src/core/firebase/services/bookmarks';

export interface BookmarkButtonProps {
  context: BookmarkContext;
  kind: BookmarkKind;
  /** Stable identifier of the saved item inside its context. */
  refId: string;
  title: string;
  preview?: string;
  /** Badge text on the bookmarks card, e.g. "GK · Read Mode". */
  sourceLabel?: string;
  payload?: BookmarkPayload;
  /** Falls back to the signed-in user's own course scope when omitted. */
  courseId?: string | null;
  subcourseId?: string | null;
  size?: number;
  /** Tint of the saved (filled) state. Defaults to the theme primary. */
  color?: string;
  style?: StyleProp<ViewStyle>;
  hitSlop?: number;
}

export function BookmarkButton({
  context,
  kind,
  refId,
  title,
  preview,
  sourceLabel,
  payload,
  courseId,
  subcourseId,
  size = 21,
  color,
  style,
  hitSlop = 8,
}: BookmarkButtonProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const uid = useAuthStore((state) => state.user?.uid ?? null);
  const profile = useProfileStore((state) => state.profile);
  const docId = bookmarkDocId(context, refId);
  const saved = useBookmarkStore((state) => state.items.some((item) => item.id === docId));
  const busy = useBookmarkStore((state) => state.pending.includes(docId));

  const tint = color ?? colors.primary;
  const progress = useSharedValue(saved ? 1 : 0);
  const pop = useSharedValue(1);

  useEffect(() => {
    progress.value = withTiming(saved ? 1 : 0, { duration: 180 });
  }, [progress, saved]);

  // The store de-duplicates, so this is a no-op after the first screen mounts.
  useEffect(() => {
    if (!uid) return;
    void useBookmarkStore.getState().load(uid);
    if (useProfileStore.getState().loadedUid !== uid) void useProfileStore.getState().load(uid);
  }, [uid]);

  const filledStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const outlineStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const onPress = useCallback(async () => {
    if (busy) return;
    pop.value = withSequence(withTiming(0.82, { duration: 90 }), withSpring(1, { damping: 9, stiffness: 240 }));

    const effectiveSubcourse = subcourseId ?? profile?.subcourseId ?? null;
    const result = await useBookmarkStore.getState().toggle(
      uid,
      {
        kind,
        context,
        refId,
        title,
        preview,
        sourceLabel,
        payload,
        courseId: courseId ?? profile?.courseId ?? null,
        subcourseId: effectiveSubcourse,
      },
      hasActivePremium(profile),
    );

    if (result === 'added') showToast(t('bookmarks.savedToast'), 'success');
    else if (result === 'removed') showToast(t('bookmarks.removedToast'), 'info');
    else if (result === 'signin') showToast(t('bookmarks.signInToSave'), 'warning');
    else if (result === 'limit') {
      // Deliberately English on both locales — the user asked for the upsell
      // wording to read the same everywhere.
      showToast(t('bookmarks.limitToast'), 'warning', {
        actionLabel: t('bookmarks.limitAction'),
        onAction: () => router.push('/subscription' as never),
      });
    } else showToast(t('common.somethingWentWrong'), 'error');
  }, [busy, context, courseId, kind, payload, pop, preview, profile, refId, sourceLabel, subcourseId, t, title, uid]);

  return (
    <Pressable
      onPress={() => void onPress()}
      hitSlop={hitSlop}
      disabled={busy}
      accessibilityRole="button"
      accessibilityState={{ selected: saved, busy }}
      accessibilityLabel={saved ? t('bookmarks.removeAction') : t('bookmarks.saveAction')}
      style={[styles.button, { width: size + 9, height: size + 9 }, style]}
    >
      <Animated.View style={[styles.stack, popStyle]}>
        <Animated.View style={[styles.layer, outlineStyle]}>
          <Ionicons name="bookmark-outline" size={size} color={tint} />
        </Animated.View>
        <Animated.View style={[styles.layer, filledStyle]}>
          <Ionicons name="bookmark" size={size} color={tint} />
        </Animated.View>
        {/* Keeps the pressable a fixed square whatever the glyph metrics are. */}
        <View style={{ width: size, height: size }} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center' },
  stack: { alignItems: 'center', justifyContent: 'center' },
  layer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});
