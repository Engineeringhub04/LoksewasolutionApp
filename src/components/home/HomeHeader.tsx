// Collapsing curved blue header for Home.
//
// AT REST (scrollY = 0): full header — profile row (avatar + greeting/name,
// theme toggle + notifications), search box, and the Course Info card below.
//
// WHILE SCROLLING: as the user scrolls the page up, the header smoothly
// SHRINKS in place (it is a normal in-flow element inside the ScrollView —
// it is never sticky/fixed and never "jumps" away) into a small curved bar:
// avatar on the left, a search icon + the enrolled course/subcourse name in
// the middle, theme toggle + notifications on the right.
//
// Everything here is driven by a single Reanimated SharedValue (scrollY) via
// useAnimatedStyle/interpolate, which runs entirely on the UI thread — there
// is no JS-thread state update per scroll frame, which is what keeps this
// perfectly smooth (no flicker/jutter) on both Android and iOS.
import React, { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
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
import { Badge } from '@/src/components/misc/Badge';
import { ThemeToggleButton } from '@/src/components/misc/ThemeToggleButton';
import { CourseInfoCard } from '@/src/components/home/CourseInfoCard';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// Distance (in px of scroll) over which the header fully collapses. Kept in
// sync 1:1 with scroll position (no spring/delay) so it feels physically
// attached to the gesture rather than "catching up" after the fact.
const COLLAPSE_DISTANCE = 150;

interface HomeHeaderProps {
  scrollY: SharedValue<number>;
  displayName: string | null;
  photoURL: string | null | undefined;
  notificationCount: number;
  isDark: boolean;
  onToggleTheme: () => void;
  onNotificationsPress: () => void;
  onProfilePress: () => void;
  courseName: string | null;
  subcourseName: string | null;
  onCoursePress: () => void;
}

export function HomeHeader({
  scrollY,
  displayName,
  photoURL,
  notificationCount,
  isDark,
  onToggleTheme,
  onNotificationsPress,
  onProfilePress,
  courseName,
  subcourseName,
  onCoursePress,
}: HomeHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const firstName = displayName?.split(' ')[0] ?? 'there';
  const courseLabel = courseName ? (subcourseName ? `${courseName} \u2022 ${subcourseName}` : courseName) : 'Select your course';

  const EXPANDED_HEIGHT = insets.top + 232;
  const COLLAPSED_HEIGHT = insets.top + 64;

  // Only flips (rarely) once the header crosses the halfway point — used to
  // toggle pointerEvents on the two content layers so the invisible one never
  // steals touches, without doing any per-frame JS work.
  const [collapsed, setCollapsed] = useState(false);
  useAnimatedReaction(
    () => scrollY.value > COLLAPSE_DISTANCE * 0.55,
    (isCollapsedNow, wasCollapsed) => {
      if (isCollapsedNow !== wasCollapsed) {
        // This reaction callback runs as a worklet on the UI thread — calling
        // a plain JS function (setState) from it requires runOnJS. This only
        // fires once when crossing the halfway point, not every scroll frame,
        // so it has no impact on scroll smoothness.
        runOnJS(setCollapsed)(isCollapsedNow);
      }
    },
    []
  );

  const containerStyle = useAnimatedStyle(() => {
    const height = interpolate(scrollY.value, [0, COLLAPSE_DISTANCE], [EXPANDED_HEIGHT, COLLAPSED_HEIGHT], Extrapolation.CLAMP);
    const radius = interpolate(scrollY.value, [0, COLLAPSE_DISTANCE], [30, 20], Extrapolation.CLAMP);
    return {
      height,
      borderBottomLeftRadius: radius,
      borderBottomRightRadius: radius,
    };
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
    <Animated.View style={[styles.header, containerStyle]}>
      <LinearGradient colors={['#1D4ED8', '#2563EB', '#3B82F6']} style={StyleSheet.absoluteFillObject} />

      {/* ===== EXPANDED (at rest) ===== */}
      <Animated.View
        style={[styles.expandedContent, { paddingTop: insets.top + 12 }, expandedStyle]}
        pointerEvents={collapsed ? 'none' : 'auto'}
      >
        <View style={styles.topRow}>
          <Pressable onPress={onProfilePress} style={styles.profileRow}>
            <Avatar uri={photoURL} name={displayName ?? undefined} size={48} />
            <View style={{ gap: 1 }}>
              <Text variant="bodySmall" style={styles.greeting}>{greeting()},</Text>
              <Text variant="bodyLarge" weight="bold" style={styles.name} numberOfLines={1}>{firstName}</Text>
            </View>
          </Pressable>

          <View style={styles.actionsRow}>
            <ThemeToggleButton isDark={isDark} onToggle={onToggleTheme} size={38} />
            <Pressable onPress={onNotificationsPress} style={styles.iconBox} accessibilityLabel="Notifications">
              <Ionicons name="notifications-outline" size={20} color="#FFF" />
              {notificationCount > 0 ? (
                <View style={styles.badgeWrap}>
                  <Badge count={notificationCount} />
                </View>
              ) : null}
            </Pressable>
          </View>
        </View>

        <Pressable onPress={() => router.push('/search')} style={styles.searchBox}>
          <Ionicons name="search" size={18} color="rgba(255,255,255,0.75)" />
          <Text variant="body" style={styles.searchPlaceholder}>Search subjects, notes, exams...</Text>
        </Pressable>

        <View style={{ marginTop: 12 }}>
          <CourseInfoCard courseName={courseName} subcourseName={subcourseName} onPress={onCoursePress} />
        </View>
      </Animated.View>

      {/* ===== COLLAPSED (while scrolling) ===== */}
      <Animated.View
        style={[styles.collapsedContent, { paddingTop: insets.top }, collapsedStyle]}
        pointerEvents={collapsed ? 'auto' : 'none'}
      >
        <View style={styles.collapsedRow}>
          <Pressable onPress={onProfilePress}>
            <Avatar uri={photoURL} name={displayName ?? undefined} size={34} />
          </Pressable>

          <Pressable onPress={() => router.push('/search')} style={styles.collapsedSearchIcon} accessibilityLabel="Search">
            <Ionicons name="search" size={16} color="#FFF" />
          </Pressable>

          <Pressable onPress={onCoursePress} style={styles.collapsedCourseLabel}>
            <Text variant="bodySmall" weight="semiBold" style={styles.collapsedCourseText} numberOfLines={1}>
              {courseLabel}
            </Text>
          </Pressable>

          <ThemeToggleButton isDark={isDark} onToggle={onToggleTheme} size={32} />
          <Pressable onPress={onNotificationsPress} style={styles.collapsedIconBox} accessibilityLabel="Notifications">
            <Ionicons name="notifications-outline" size={17} color="#FFF" />
            {notificationCount > 0 ? (
              <View style={styles.badgeWrapSmall}>
                <Badge count={notificationCount} />
              </View>
            ) : null}
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: {
    overflow: 'hidden',
  },
  // Expanded
  expandedContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  greeting: { color: 'rgba(255,255,255,0.8)' },
  name: { color: '#FFF', fontSize: 17 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  badgeWrap: { position: 'absolute', top: -4, right: -4 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  searchPlaceholder: { color: 'rgba(255,255,255,0.75)' },
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
  collapsedRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  collapsedSearchIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapsedCourseLabel: { flex: 1 },
  collapsedCourseText: { color: '#FFF' },
  collapsedIconBox: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  badgeWrapSmall: { position: 'absolute', top: -4, right: -4 },
});
