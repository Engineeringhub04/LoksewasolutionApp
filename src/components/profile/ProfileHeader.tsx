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
import Svg, { Path } from 'react-native-svg';
import Animated, {
  useAnimatedStyle,
  useAnimatedReaction,
  interpolate,
  Extrapolation,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { Text } from '@/src/components/misc/Text';
import { ProfileAvatar } from '@/src/components/profile/ProfileAvatar';
import { NameWithTick } from '@/src/components/misc/NameWithTick';
import { ThemeToggleButton } from '@/src/components/misc/ThemeToggleButton';

const COLLAPSE_DISTANCE = 150;

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
  /**
   * Premium entitlement is active RIGHT NOW — drives the animated avatar ring.
   * Separate from `isPremiumPlan` on purpose: that one mirrors the stored flag
   * and must keep matching `planLabel`, while this one also respects the expiry
   * date, so a lapsed member stops wearing the ring immediately.
   */
  pro: boolean;
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
  pro,
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
          {/* Green ring on the free tier, the premium colour sweep on a paid
              one. The verified tick no longer rides on the photo — it sits
              BESIDE THE NAME below (Facebook style).

              The pencil lives on the lower-right rim for EVERY tier again: with
              the tick off the photo there is nothing to dodge, so the pro-only
              step-up was removed. */}
          <ProfileAvatar uri={photoURL} name={displayName} size={88} pro={pro} />
          <Pressable
            onPress={onEditPress}
            style={({ pressed }) => [styles.pencilBadge, pressed && styles.pressedSoft]}
            hitSlop={8}
            accessibilityLabel="Edit profile"
          >
            {/* The lucide "Pencil" glyph (user-requested), drawn inline with SVG —
                identical path data to lucide-react's Pencil, no new dependency. */}
            <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
              <Path
                d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"
                stroke="#1D4ED8"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Path
                d="m15 5 4 4"
                stroke="#1D4ED8"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Pressable>
        </View>

        <NameWithTick
          name={displayName ?? ''}
          pro={pro}
          variant="h3"
          weight="bold"
          // The spacing belongs on the ROW, not the text — putting it on the
          // text dropped the name below the tick and broke their alignment.
          containerStyle={styles.name}
          style={styles.nameText}
        />

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
          {/* Same ring, scaled down — whichever one the account earns has to
              survive the collapse, not just be visible at rest. */}
          <ProfileAvatar uri={photoURL} name={displayName} size={30} pro={pro} />
          {/* THE NAME IS THE LOWEST-PRIORITY element in this row: it shrinks and
              ellipsises from its TAIL first ("Loksewa Solution Ad…"). The Edit
              Profile button and the toggles always keep their full size — the
              flex:1 spacer between name and controls is what the name gives up. */}
          <NameWithTick
            name={displayName ?? ''}
            pro={pro}
            variant="bodySmall"
            weight="semiBold"
            style={styles.collapsedName}
          />

          {/* The Edit Profile button never shrinks — flexShrink: 0 — and the
              theme/language controls after it are fixed-size, so a long name is
              the only thing that ever gets truncated. */}
          <Pressable
            onPress={onEditPress}
            style={({ pressed }) => [styles.collapsedEditButton, pressed && styles.pressedSoft]}
          >
            <Text variant="caption" weight="bold" style={styles.collapsedEditText} numberOfLines={1}>
              Edit Profile
            </Text>
          </Pressable>

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

  avatarBlock: { marginTop: 12 },
  // The edit pencil: lower-right for EVERY tier. It used to step to the top rim
  // on premium accounts purely to dodge the tick that lived on the photo — with
  // the tick moved beside the name, there is nothing to dodge and both tiers
  // share the natural corner.
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
  name: { marginTop: 10, alignItems: 'center' },
  nameText: { color: '#FFF' },
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
  // flexShrink: 0 — the Edit Profile label must never truncate; the name is
  // the element that yields.
  collapsedEditButton: {
    flexShrink: 0,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  collapsedEditText: { color: '#FFF' },
  // flexShrink (from NameWithTick's text) lets a long name give up space before
  // anything overflows, so the name uses ALL the room left beside the avatar —
  // no arbitrary width cap shortening it to "Loks..." when space is free.
  // The name is the shrinking element: flexShrink on its text (from
  // NameWithTick) plus NO flex on its row means avatar, button and toggles take
  // their space first, and the name ellipsises from its tail only when the
  // leftovers genuinely run out.
  collapsedName: { color: '#FFF', flexShrink: 1 },
  collapsedLanguagePill: {
    flexShrink: 0,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  pressedSoft: { opacity: 0.75 },
});
