// Big curved blue header for Home: profile photo + name + greeting on the left,
// theme toggle + notification bell on the right, a search box, and a Course
// Info card below.
import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeIn } from 'react-native-reanimated';
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

interface HomeHeaderProps {
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

  return (
    <LinearGradient colors={['#1D4ED8', '#2563EB', '#3B82F6']} style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <Animated.View entering={FadeIn.duration(300)} style={styles.topRow}>
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
      </Animated.View>

      {/* Search box on top, Course Info card below (in that order) */}
      <Pressable onPress={() => router.push('/search')} style={styles.searchBox}>
        <Ionicons name="search" size={18} color="rgba(255,255,255,0.75)" />
        <Text variant="body" style={styles.searchPlaceholder}>Search subjects, notes, exams...</Text>
      </Pressable>

      <View style={{ marginTop: 12 }}>
        <CourseInfoCard courseName={courseName} subcourseName={subcourseName} onPress={onCoursePress} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 18, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
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
});
