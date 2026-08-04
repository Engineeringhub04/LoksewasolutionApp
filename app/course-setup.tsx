// Course Setup — shown after login if user hasn't selected a course yet.
// Select Course (blue buttons) → Select Subcourse (red buttons) → Save.
import React, { useEffect, useState } from 'react';
import { View, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { fetchCourses, fetchSubcourses, saveUserCourseSetup, type Course, type Subcourse } from '@/src/core/firebase/services/courses';
import { useAuthStore } from '@/src/core/store/authStore';
import { showToast } from '@/src/core/store/toastStore';
import { Text } from '@/src/components/misc/Text';

export default function CourseSetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [courses, setCourses] = useState<Course[]>([]);
  const [subcourses, setSubcourses] = useState<Subcourse[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [selectedSubcourse, setSelectedSubcourse] = useState<string | null>(null);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingSub, setLoadingSub] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load courses on mount
  useEffect(() => {
    (async () => {
      try {
        const data = await fetchCourses();
        setCourses(data);
      } catch {
        showToast('Failed to load courses', 'error');
      } finally {
        setLoadingCourses(false);
      }
    })();
  }, []);

  // Load subcourses when course is selected
  useEffect(() => {
    if (!selectedCourse) { setSubcourses([]); return; }
    setLoadingSub(true);
    setSelectedSubcourse(null);
    (async () => {
      try {
        const data = await fetchSubcourses(selectedCourse);
        setSubcourses(data);
      } catch {
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
      showToast('Course setup complete! 🎉', 'success');
      router.replace('/(tabs)');
    } catch {
      showToast('Failed to save. Try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </Pressable>
        <Text variant="body" weight="bold" style={styles.headerTitle}>Setup Your Course</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Title Section */}
        <Animated.View entering={FadeInUp.duration(400)} style={styles.titleSection}>
          <Text variant="h1" weight="bold" style={styles.mainTitle}>Setup Your New Course</Text>
          <Text variant="body" style={styles.subtitle}>Choose a course to start your learning journey</Text>
        </Animated.View>

        {/* Select Course */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="school" size={18} color="#2563EB" />
            </View>
            <Text variant="h2" weight="bold" style={styles.sectionTitle}>Select Course</Text>
          </View>

          {loadingCourses ? (
            <ActivityIndicator color="#2563EB" style={{ marginVertical: 20 }} />
          ) : (
            <View style={styles.chipsRow}>
              {courses.map((course) => (
                <Pressable
                  key={course.id}
                  onPress={() => setSelectedCourse(course.id)}
                  style={[
                    styles.chip,
                    selectedCourse === course.id ? styles.chipActiveBlue : styles.chipInactive,
                  ]}
                >
                  {selectedCourse === course.id && <Ionicons name="checkmark-circle" size={18} color="#FFF" />}
                  <Text
                    variant="body"
                    weight={selectedCourse === course.id ? 'bold' : 'medium'}
                    style={{ color: selectedCourse === course.id ? '#FFF' : '#374151' }}
                  >
                    {course.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </Animated.View>

        {/* Select Subcourse — only shows when course is selected */}
        {selectedCourse && (
          <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="book" size={18} color="#DC2626" />
              </View>
              <Text variant="h2" weight="bold" style={styles.sectionTitle}>Select Subcourse</Text>
            </View>

            {loadingSub ? (
              <ActivityIndicator color="#DC2626" style={{ marginVertical: 20 }} />
            ) : (
              <View style={styles.chipsRow}>
                {subcourses.map((sub) => (
                  <Pressable
                    key={sub.id}
                    onPress={() => setSelectedSubcourse(sub.id)}
                    style={[
                      styles.chip,
                      selectedSubcourse === sub.id ? styles.chipActiveRed : styles.chipInactive,
                    ]}
                  >
                    {selectedSubcourse === sub.id && <Ionicons name="checkmark-circle" size={18} color="#FFF" />}
                    <Text
                      variant="body"
                      weight={selectedSubcourse === sub.id ? 'bold' : 'medium'}
                      style={{ color: selectedSubcourse === sub.id ? '#FFF' : '#374151' }}
                    >
                      {sub.name} ({sub.level})
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </Animated.View>
        )}
      </ScrollView>

      {/* Save Button — disabled until both selected */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          onPress={handleSave}
          disabled={!selectedCourse || !selectedSubcourse || saving}
          style={({ pressed }) => [
            styles.saveButton,
            (!selectedCourse || !selectedSubcourse) && styles.saveButtonDisabled,
            { opacity: pressed ? 0.8 : 1 },
          ]}
        >
          {saving ? <ActivityIndicator color="#FFF" /> : (
            <Text variant="body" weight="bold" style={styles.saveButtonText}>Save Course</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#1E3A5F' },
  backBtn: { padding: 8 },
  headerTitle: { color: '#FFF', fontSize: 16 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 100 },
  titleSection: { marginBottom: 24 },
  mainTitle: { color: '#1F2937', fontSize: 26 },
  subtitle: { color: '#6B7280', marginTop: 4 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  sectionIcon: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { color: '#1F2937', fontSize: 18 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1.5 },
  chipInactive: { backgroundColor: '#FFF', borderColor: '#E5E7EB' },
  chipActiveBlue: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipActiveRed: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
  bottomBar: { paddingHorizontal: 20, paddingTop: 12, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  saveButton: { backgroundColor: '#2563EB', paddingVertical: 16, borderRadius: 14, alignItems: 'center', shadowColor: '#2563EB', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  saveButtonDisabled: { backgroundColor: '#9CA3AF', shadowOpacity: 0 },
  saveButtonText: { color: '#FFF', fontSize: 16 },
});
