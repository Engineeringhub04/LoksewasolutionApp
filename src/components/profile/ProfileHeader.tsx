// Collapsing curved blue header for the Profile tab.
//
// Mirrors HomeHeader's mechanics exactly (same SharedValue contract, same
// COLLAPSE_DISTANCE, same fixed-overlay + reserved-paddingTop arrangement, same
// useAnimatedReaction/pointerEvents trick) so both tabs feel identical:
//
// AT REST (scrollY = 0): "Profile" title on the left, language switcher on the
// right, then the glowing avatar with a small pencil badge, the user's name and
// their enrolled subcourse pill.
//
// WHILE SCROLLING: the header shrinks in place (never scrolls away) into a
// compact bar — avatar on the far left, name beside it, an "Edit Profile" TEXT
// button in the middle, language switcher on the right.
//
// All interpolation runs on the UI thread via useAnimatedStyle, so there is no
// per-frame JS work and no jank on either platform. Every element uses flex /
// numberOfLines rather than fixed widths, so the bar fits any screen size.
import React, { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  useAnimatedStyle,
  useAnimatedReaction,
  interpolate,
  Extrapolation,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { Text } from '@/src/components/misc/Text';
import { Avatar } from '@/src/components/misc/Avatar';
import { ThemeToggleButton } from '@/src/components/misc/ThemeToggleButton';

const COLLAPSE_DISTANCE = 150;

/** Avatar glow colour — green in BOTH the expanded and collapsed header. */
const GLOW_GREEN = '#22C55E';

export const PROFILE_HEADER_EXPANDED_HEIGHT_BASE = 278;
export const PROFILE_HEADER_COLLAPSED_HEIGHT_BASE = 64;

/** Call with insets.top to get the actual on-screen expanded header height. */
export function getProfileHeaderExpandedHeight(safeAreaTop: number): number {
  return safeAreaTop + PROFILE_HEADER_EXPANDED_HEIGHT_BASE;
}

interface ProfileHeaderProps {
  scrollY: SharedValue<number>;
  displayName: string | null;
  photoURL: string | null | undefined;
  subcourseName: string | null;
  /** "Free Plan" or the active premium plan's name (e.g. "Premium Monthly") — shown just below the subcourse pill. */
  planLabel: string;
  isPremiumPlan: boolean;
  /** Short code for the ACTIVE language, e.g. 'EN' / 'ने'. */
  languageShortLabel: string;
  /** Full label for the ACTIVE language, e.g. 'ENGLISH' / 'नेपाली'. */
  languageLabel: string;
  onToggleLanguage: () => void;
  onEditPress: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

export function ProfileHeader({
  scrollY,
  displayName,
  photoURL,
  subcourseName,
  planLabel,
  isPremiumPlan,
  languageShortLabel,
  languageLabel,
  onToggleLanguage,
  onEditPress,
  isDark,
  onToggleTheme,
}: ProfileHeaderProps) {
  const insets = useSafeAreaInsets();

  const EXPANDED_HEIGHT = insets.top + PROFILE_HEADER_EXPANDED_HEIGHT_BASE;
  const COLLAPSED_HEIGHT = insets.top + PROFILE_HEADER_COLLAPSED_HEIGHT_BASE;

  const [collapsed, setCollapsed] = useState(false);
  useAnimatedReaction(
    () => scrollY.value > COLLAPSE_DISTANCE * 0.55,
    (isCollapsedNow, wasCollapsed) => {
      if (isCollapsedNow !== wasCollapsed) {
        // Worklet -> JS hop, fired only when crossing the halfway point (not
        // per frame), purely so the hidden layer stops capturing touches.
        runOnJS(setCollapsed)(isCollapsedNow);
      }
    },
    []
  );

  const containerStyle = useAnimatedStyle(() => {
    const height = interpolate(scrollY.value, [0, COLLAPSE_DISTANCE], [EXPANDED_HEIGHT, COLLAPSED_HEIGHT], Extrapolation.CLAMP);
    const radius = interpolate(scrollY.value, [0, COLLAPSE_DISTANCE], [30, 20], Extrapolation.CLAMP);
    return { height, borderBottomLeftRadius: radius, borderBottomRightRadius: radius };
  });

  const expandedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [0, COLLAPSE_DISTANCE * 0.6], [1, 0], Extrapolation.CLAMP);
    const translateY = interpolate(scrollY.value, [0, COLLAPSE_DISTANCE], [0, -14], Extrapolation.CLAMP);
    return { opacity, transform: [{ translateY }] };
  });

  const collapsedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [COLLAPSE_DISTANCE * 0.45, COLLAPSE_DISTANCE], [0, 1], Extrapolation.CLAMP);
    const translateY = interpolate(scrollY.value, [COLLAPSE_DISTANCE * 0.45, COLLAPSE_DISTANCE], [8, 0], Extrapolation.CLAMP);
    return { opacity, transform: [{ translateY }] };
  });

  return (
    <Animated.View style={[styles.header, styles.fixedOverlay, containerStyle]}>
      <LinearGradient colors={['#1D4ED8', '#2563EB', '#3B82F6']} style={StyleSheet.absoluteFillObject} />

      {/* ===== EXPANDED (at rest) ===== */}
      <Animated.View
        style={[styles.expandedContent, { paddingTop: insets.top + 6 }, expandedStyle]}
        pointerEvents={collapsed ? 'none' : 'auto'}
      >
        <View style={styles.titleRow}>
          <Text variant="h2" weight="bold" style={styles.pageTitle}>Profile</Text>
          <View style={styles.actionsRow}>
            {/* Theme toggle sits to the LEFT of the language switcher. */}
            <ThemeToggleButton isDark={isDark} onToggle={onToggleTheme} size={36} />
            <Pressable
              onPress={onToggleLanguage}
              style={({ pressed }) => [styles.languagePill, pressed && styles.pressedSoft]}
              accessibilityLabel={`Change language, currently ${languageLabel}`}
            >
              <Text variant="caption" weight="bold" style={styles.languageText} numberOfLines={1}>
                {languageLabel}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.avatarBlock}>
          {/* Green glow ring around the avatar edge */}
          <View style={styles.avatarGlow}>
            <Avatar uri={photoURL} name={displayName ?? undefined} size={88} />
          </View>
          <Pressable
            onPress={onEditPress}
            style={({ pressed }) => [styles.pencilBadge, pressed && styles.pressedSoft]}
            hitSlop={8}
            accessibilityLabel="Edit profile"
          >
            <Ionicons name="pencil" size={14} color="#1D4ED8" />
          </Pressable>
        </View>

        <Text variant="h3" weight="bold" style={styles.name} numberOfLines={1}>
          {displayName ?? ''}
        </Text>

        {subcourseName ? (
          <View style={styles.subcoursePill}>
            <Text variant="caption" weight="semiBold" style={styles.subcourseText} numberOfLines={1}>
              {subcourseName}
            </Text>
          </View>
        ) : null}

        <View style={[styles.planPill, isPremiumPlan ? styles.planPillPremium : styles.planPillFree]}>
          {isPremiumPlan ? <Ionicons name="diamond" size={11} color="#7C2D12" style={{ marginRight: 4 }} /> : null}
          <Text variant="caption" weight="bold" style={isPremiumPlan ? styles.planTextPremium : styles.planTextFree} numberOfLines={1}>
            {planLabel}
          </Text>
        </View>
      </Animated.View>

      {/* ===== COLLAPSED (while scrolling) ===== */}
      <Animated.View
        style={[styles.collapsedContent, { paddingTop: insets.top }, collapsedStyle]}
        pointerEvents={collapsed ? 'auto' : 'none'}
      >
        <View style={styles.collapsedRow}>
          {/* Same green glow, scaled down — the ring must stay visible once the
              header shrinks, not just at rest. */}
          <View style={styles.collapsedAvatarGlow}>
            <Avatar uri={photoURL} name={displayName ?? undefined} size={30} />
          </View>
          <Text variant="bodySmall" weight="semiBold" style={styles.collapsedName} numberOfLines={1}>
            {displayName ?? ''}
          </Text>

          {/* Sits in its own flex:1 cell so the button lands in the middle of
              whatever space is left over, on any screen width. */}
          <View style={styles.collapsedCenterCell}>
            <Pressable
              onPress={onEditPress}
              style={({ pressed }) => [styles.collapsedEditButton, pressed && styles.pressedSoft]}
            >
              <Text variant="caption" weight="bold" style={styles.collapsedEditText} numberOfLines={1}>
                Edit Profile
              </Text>
            </Pressable>
          </View>

          {/* Same order once collapsed: theme toggle, then language. */}
          <ThemeToggleButton isDark={isDark} onToggle={onToggleTheme} size={32} />
          <Pressable
            onPress={onToggleLanguage}
            style={({ pressed }) => [styles.collapsedLanguagePill, pressed && styles.pressedSoft]}
            accessibilityLabel={`Change language, currently ${languageLabel}`}
          >
            <Text variant="caption" weight="bold" style={styles.languageText} numberOfLines={1}>
              {languageShortLabel}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: { overflow: 'hidden' },
  fixedOverlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 },

  // Expanded
  expandedContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingBottom: 16,
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
  },
  pageTitle: { color: '#FFF', fontSize: 22, flexShrink: 1 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  languagePill: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    flexShrink: 1,
  },
  languageText: { color: '#FFF', letterSpacing: 0.5 },

  avatarBlock: { marginTop: 10 },
  avatarGlow: {
    padding: 4,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: GLOW_GREEN,
    backgroundColor: 'rgba(34,197,94,0.22)',
    // Soft green halo — iOS uses shadow*, Android needs elevation.
    shadowColor: GLOW_GREEN,
    shadowOpacity: 0.9,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  pencilBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  name: { color: '#FFF', marginTop: 10, textAlign: 'center', alignSelf: 'stretch' },
  subcoursePill: {
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  subcourseText: { color: '#FFF' },
  planPill: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    maxWidth: '100%',
  },
  planPillFree: { backgroundColor: 'rgba(255,255,255,0.16)' },
  planPillPremium: { backgroundColor: '#FBBF24' },
  planTextFree: { color: 'rgba(255,255,255,0.85)' },
  planTextPremium: { color: '#7C2D12' },

  // Collapsed
  collapsedContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  collapsedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  collapsedAvatarGlow: {
    padding: 2,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: GLOW_GREEN,
    backgroundColor: 'rgba(34,197,94,0.22)',
    shadowColor: GLOW_GREEN,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  // flexShrink + a width cap let a long name give up space before anything
  // overflows, which is what keeps this row fitting on narrow devices.
  collapsedName: { color: '#FFF', flexShrink: 1, maxWidth: '34%' },
  collapsedCenterCell: { flex: 1, alignItems: 'center' },
  collapsedEditButton: {
    flexShrink: 0,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  collapsedEditText: { color: '#FFF' },
  collapsedLanguagePill: {
    flexShrink: 0,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  pressedSoft: { opacity: 0.75 },
});
