// Course Setup — shown after login/signup if user hasn't selected a course yet.
// Blue curved header with a WORKING theme toggle (colors are theme-aware, unlike
// the previous version which used hardcoded hex values that never changed).
// No back button (mandatory step). Select Course (blue) → Subcourse (red) → Save.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp, FadeIn } from 'react-native-reanimated';
import { fetchCourses, fetchSubcourses, saveUserCourseSetup, fetchUserCourseInfo, type Course, type Subcourse } from '@/src/core/firebase/services/courses';
import { useProfileStore } from '@/src/core/store/profileStore';
import { useManualRefresh } from '@/src/core/hooks/useManualRefresh';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';
import { useAuthStore } from '@/src/core/store/authStore';
import { showToast } from '@/src/core/store/toastStore';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';
import { ThemeToggleButton } from '@/src/components/misc/ThemeToggleButton';

export default function CourseSetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { colors, effective, setMode } = useTheme();
  const params = useLocalSearchParams<{ mode?: string }>();
  // "update" mode = opened from Home (user already has a course); shows a back
  // button and "Update" wording instead of the mandatory first-time setup flow.
  const isUpdateMode = params.mode === 'update';

  const [courses, setCourses] = useState<Course[]>([]);
  const [subcourses, setSubcourses] = useState<Subcourse[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [selectedSubcourse, setSelectedSubcourse] = useState<string | null>(null);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingSub, setLoadingSub] = useState(false);
  const [subcourseError, setSubcourseError] = useState(false);
  const [saving, setSaving] = useState(false);

  // What the user is ALREADY enrolled in. Kept separate from the working
  // selection so the screen can (a) pre-select it when reopened — it previously
  // always opened blank even for users who had already completed setup — and
  // (b) colour-code "currently enrolled" differently from "new selection".
  const [savedCourseId, setSavedCourseId] = useState<string | null>(null);
  const [savedSubcourseId, setSavedSubcourseId] = useState<string | null>(null);
  // Guards the subcourse effect from clearing the pre-selected subcourse during
  // the initial hydration pass (it must only clear on a real user course change).
  const hydratingRef = useRef(false);

  const toggleTheme = () => setMode(effective === 'dark' ? 'light' : 'dark');

  // Extracted so pull-to-refresh can re-run the same fetch.
  const loadCourses = useCallback(async () => {
    try {
      const data = await fetchCourses();
      setCourses(data);
    } catch {
      showToast('Failed to load courses', 'error');
    } finally {
      setLoadingCourses(false);
    }
  }, []);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  const { refreshing, onRefresh } = useManualRefresh(loadCourses);

  // Pre-select whatever the user is already enrolled in.
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const info = await fetchUserCourseInfo(user.uid);
        if (!info.courseId) return;
        hydratingRef.current = true;
        setSavedCourseId(info.courseId);
        setSavedSubcourseId(info.subcourseId);
        setSelectedCourse(info.courseId);
        setSelectedSubcourse(info.subcourseId);
      } catch {
        // Non-fatal — the screen still works as a fresh setup.
      }
    })();
  }, [user?.uid]);

  useEffect(() => {
    if (!selectedCourse) { setSubcourses([]); return; }
    setLoadingSub(true);
    setSubcourseError(false);
    // Only wipe the chosen subcourse when the user actually switches course —
    // not while restoring their saved selection.
    if (hydratingRef.current) {
      hydratingRef.current = false;
    } else {
      setSelectedSubcourse(null);
    }
    (async () => {
      try {
        const data = await fetchSubcourses(selectedCourse);
        setSubcourses(data);
        if (data.length === 0) setSubcourseError(true);
      } catch {
        setSubcourseError(true);
        showToast('Failed to load subcourses', 'error');
      } finally {
        setLoadingSub(false);
      }
    })();
  }, [selectedCourse]);

  const handleSave = async () => {
    if (!user || !selectedCourse || !selectedSubcourse) return;
    setSaving(true);
    try {
      await saveUserCourseSetup(user.uid, selectedCourse, selectedSubcourse);
      // Refresh the shared store so Home's course card and the Profile subcourse
      // pill update immediately, without needing a manual pull-to-refresh.
      await useProfileStore.getState().load(user.uid, { force: true }).catch(() => {});
      setSavedCourseId(selectedCourse);
      setSavedSubcourseId(selectedSubcourse);
      setSaving(false);
      if (isUpdateMode) {
        router.back();
        showToast('Course updated successfully', 'success');
      } else {
        router.replace('/(tabs)');
        showToast('Course setup complete', 'success');
      }
    } catch {
      setSaving(false);
      showToast('Failed to save. Please try again.', 'error');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Blue Curved Header */}
      <LinearGradient colors={['#1D4ED8', '#2563EB', '#3B82F6']} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Animated.View entering={FadeIn.duration(400)} style={styles.headerRow}>
          {isUpdateMode ? (
            <Pressable onPress={() => router.back()} style={styles.headerIconBox} accessibilityLabel="Back">
              <Ionicons name="arrow-back" size={20} color="#FFF" />
            </Pressable>
          ) : (
            <View style={styles.headerIconBox}>
              <Ionicons name="school" size={22} color="#FFF" />
            </View>
          )}
          <Text variant="h2" weight="bold" style={styles.headerTitle}>{isUpdateMode ? 'Update Your Course' : 'Setup Your Course'}</Text>
          {/* Theme toggle intentionally kept here (not delegated to SubpageHeader) since
              this screen has its own hand-rolled gradient header layout with custom
              left-side content (school icon / back button) that SubpageHeader doesn't support. */}
          <ThemeToggleButton isDark={effective === 'dark'} onToggle={toggleTheme} size={36} />
        </Animated.View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Animated.View entering={FadeInUp.duration(400)} style={styles.titleSection}>
          <Text variant="h1" weight="bold" style={{ color: colors.textPrimary, fontSize: 26 }}>
            {isUpdateMode ? 'Update Your Course' : 'Setup Your New Course'}
          </Text>
          <Text variant="body" style={{ color: colors.textSecondary, marginTop: 4 }}>
            {isUpdateMode ? 'Change your selected course or subcourse anytime' : 'Choose a course to start your learning journey'}
          </Text>
        </Animated.View>

        {/* Select Course */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="school" size={18} color="#2563EB" />
            </View>
            <Text variant="h2" weight="bold" style={{ color: colors.textPrimary, fontSize: 18 }}>Select Course</Text>
          </View>

          {loadingCourses ? (
            <ActivityIndicator color="#2563EB" style={{ marginVertical: 20 }} />
          ) : (
            <View style={styles.chipsRow}>
              {courses.map((course, i) => (
                <Animated.View key={course.id} entering={FadeInDown.delay(250 + i * 80).duration(350)}>
                  <Pressable
                    onPress={() => setSelectedCourse(course.id)}
                    style={[
                      styles.chip,
                      selectedCourse === course.id
                        ? styles.chipActiveBlue
                        : { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                  >
                    {selectedCourse === course.id && <Ionicons name="checkmark-circle" size={18} color="#FFF" />}
                    <Text variant="body" weight={selectedCourse === course.id ? 'bold' : 'medium'} style={{ color: selectedCourse === course.id ? '#FFF' : colors.textPrimary }}>
                      {course.name}
                    </Text>
                  </Pressable>
                </Animated.View>
              ))}
            </View>
          )}
        </Animated.View>

        {/* Select Subcourse */}
        {selectedCourse && (
          <Animated.View entering={FadeInDown.duration(400)} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: colors.surfaceAlt }]}>
                <Ionicons name="book" size={18} color="#DC2626" />
              </View>
              <Text variant="h2" weight="bold" style={{ color: colors.textPrimary, fontSize: 18 }}>Select Subcourse</Text>
            </View>

            {loadingSub ? (
              <ActivityIndicator color="#DC2626" style={{ marginVertical: 20 }} />
            ) : subcourseError ? (
              <Animated.View entering={FadeIn.duration(300)} style={styles.errorBox}>
                <Ionicons name="alert-circle" size={20} color="#DC2626" />
                <Text variant="bodySmall" style={styles.errorText}>
                  No subcourses found for this course yet. Please contact support or try again later.
                </Text>
              </Animated.View>
            ) : (
              <View style={styles.chipsRow}>
                {subcourses.map((sub, i) => {
                  const isSelected = selectedSubcourse === sub.id;
                  // Blue = the subcourse you're already enrolled in.
                  // Red  = a NEW pick that differs from what's saved.
                  const isEnrolled = isSelected && sub.id === savedSubcourseId && selectedCourse === savedCourseId;
                  return (
                    <Animated.View key={sub.id} entering={FadeInDown.delay(i * 80).duration(350)}>
                      <Pressable
                        onPress={() => setSelectedSubcourse(sub.id)}
                        style={[
                          styles.chip,
                          isSelected
                            ? isEnrolled
                              ? styles.chipActiveBlue
                              : styles.chipActiveRed
                            : { backgroundColor: colors.surface, borderColor: colors.border },
                        ]}
                      >
                        {isSelected && <Ionicons name="checkmark-circle" size={18} color="#FFF" />}
                        <Text variant="body" weight={isSelected ? 'bold' : 'medium'} style={{ color: isSelected ? '#FFF' : colors.textPrimary }}>
                          {sub.name} ({sub.level})
                        </Text>
                      </Pressable>
                    </Animated.View>
                  );
                })}
              </View>
            )}
          </Animated.View>
        )}

        {/* Colour legend, so the blue/red states are self-explanatory. */}
        {savedCourseId ? (
          <Animated.View entering={FadeIn.duration(300)} style={[styles.legendBox, { backgroundColor: colors.surfaceAlt }]}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#2563EB' }]} />
              <Text variant="caption" style={{ color: colors.textSecondary }}>Currently enrolled</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#DC2626' }]} />
              <Text variant="caption" style={{ color: colors.textSecondary }}>New selection</Text>
            </View>
          </Animated.View>
        ) : null}
      </ScrollView>

      {/* Save Button */}
      <Animated.View entering={FadeInUp.duration(400)} style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.divider, paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          onPress={handleSave}
          disabled={!selectedCourse || !selectedSubcourse || saving}
          style={({ pressed }) => [
            styles.saveButton,
            (!selectedCourse || !selectedSubcourse) && styles.saveButtonDisabled,
            { opacity: pressed ? 0.85 : 1 },
          ]}
        >
          {saving ? <ActivityIndicator color="#FFF" /> : <Text variant="body" weight="bold" style={styles.saveButtonText}>{isUpdateMode ? 'Update Course' : 'Save Course'}</Text>}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 20, borderBottomLeftRadius: 26, borderBottomRightRadius: 26 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  headerIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#FFF', fontSize: 18, flex: 1, textAlign: 'center' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 100 },
  titleSection: { marginBottom: 24 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  sectionIcon: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1.5 },
  chipActiveBlue: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipActiveRed: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FEF2F2', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#FECACA' },
  legendBox: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, padding: 12, borderRadius: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  errorText: { color: '#991B1B', flex: 1, lineHeight: 18 },
  bottomBar: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1 },
  saveButton: { backgroundColor: '#2563EB', paddingVertical: 16, borderRadius: 14, alignItems: 'center', shadowColor: '#2563EB', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  saveButtonDisabled: { backgroundColor: '#9CA3AF', shadowOpacity: 0 },
  saveButtonText: { color: '#FFF', fontSize: 16 },
});
