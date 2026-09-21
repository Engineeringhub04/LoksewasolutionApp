// Shared curved blue gradient header used across sub-pages (Course Setup style).
// Bigger than the flat TopAppBar, with an optional back button, title, and a
// right-side actions slot (theme toggle, icons, etc).
//
// NO ENTERING ANIMATION HERE — deliberately.
// This row used to fade in over 300ms on mount. Because this header is on every
// single sub-page, that fade fired at the exact moment the page transition was
// playing, and the two ran the same 300ms against each other: the page arrived
// while its own header was still materialising. The transition IS the
// animation; the header should already be painted when the page arrives.
import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/src/components/misc/Text';

import { useTheme } from '@/src/core/theme';
import { ThemeToggleButton } from '@/src/components/misc/ThemeToggleButton';

export interface SubpageHeaderProps {
  title: string;
  showBack?: boolean;
  onBackPress?: () => void;
  rightSlot?: React.ReactNode;
  /**
   * Extra action(s) placed to the LEFT of the default right slot, so a screen
   * can add its own button WITHOUT losing the theme toggle. Passing `rightSlot`
   * REPLACES the toggle; this adds alongside it — prefer this one, because no
   * screen should have to give up theme switching to gain a button.
   */
  headerActions?: React.ReactNode;
  /** Shows a working theme toggle on the right (ignored if rightSlot is provided). */
  showThemeToggle?: boolean;
  gradientColors?: readonly [string, string, ...string[]];
}

export function SubpageHeader({
  title,
  showBack = true,
  onBackPress,
  rightSlot,
  headerActions,
  // Defaults to true so every screen gets a working theme toggle out of the
  // box without needing to remember to opt in — this was the root cause of
  // several subpages missing it. Pass showThemeToggle={false} explicitly
  // (or provide a custom rightSlot) to opt out.
  showThemeToggle = true,
  gradientColors = ['#1D4ED8', '#2563EB', '#3B82F6'],
}: SubpageHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { effective, setMode } = useTheme();

  const resolvedRightSlot =
    rightSlot ??
    (showThemeToggle ? (
      <ThemeToggleButton isDark={effective === 'dark'} onToggle={() => setMode(effective === 'dark' ? 'light' : 'dark')} size={36} />
    ) : (
      <View style={styles.iconBox} />
    ));

  return (
    <LinearGradient colors={gradientColors} style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <View style={styles.row}>
        {showBack ? (
          <Pressable onPress={onBackPress ?? (() => router.back())} style={styles.iconBox} accessibilityLabel="Back">
            <Ionicons name="arrow-back" size={20} color="#FFF" />
          </Pressable>
        ) : (
          <View style={styles.iconBox} />
        )}
        <Text variant="h2" weight="bold" style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.rightSlot}>
          {headerActions}
          {resolvedRightSlot}
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: { paddingBottom: 20, borderBottomLeftRadius: 26, borderBottomRightRadius: 26 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  iconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#FFF', fontSize: 18, flex: 1, textAlign: 'center' },
  // flexDirection:'row' is the fix here — Gorkhapatra passes TWO icon buttons
  // (prev/next chevrons) as its rightSlot; without an explicit row direction
  // they stacked vertically (View's default flexDirection is 'column'),
  // breaking that page's header layout specifically.
  rightSlot: { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'flex-end' },
});
