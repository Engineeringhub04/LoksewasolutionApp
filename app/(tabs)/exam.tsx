// Exam Hub — the Exams tab.
//
// Header is STABLE (no collapse/scroll animation, as requested): a compact
// "Loksewa Exams Hub" heading, then the province filter row, then the section
// tabs. Only the card list below scrolls.
//
// Everything shown comes from Firestore via services/examHub.ts, filtered by the
// user's enrolled course/subcourse.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { useProfileStore } from '@/src/core/store/profileStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import {
  fetchProvinces,
  fetchExamSections,
  fetchExamSets,
  fetchExamRules,
  fetchExamAttempts,
  resolveExamCardState,
  ALL_PROVINCES,
  type ExamRule,
  type ExamSet,
} from '@/src/core/firebase/services/examHub';
import { seedExamHub } from '@/src/core/firebase/seedExamHub';
import { showToast } from '@/src/core/store/toastStore';
import { Text } from '@/src/components/misc/Text';
import { ExamCard } from '@/src/components/exam/ExamCard';
import { ExamRulesSheet } from '@/src/components/exam/ExamRulesSheet';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';

/** Cards re-evaluate their state on this cadence so countdowns tick. */
const TICK_MS = 1000;

export default function ExamScreen() {
  const { colors, spacing, radius } = useTheme();
  const { language } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  const profile = useProfileStore((s) => s.profile);
  const courseInfo = useProfileStore((s) => s.courseInfo);
  const courseId = courseInfo?.courseId ?? profile?.courseId ?? null;
  const subcourseId = courseInfo?.subcourseId ?? profile?.subcourseId ?? null;
  const subcourseLabel = courseInfo?.subcourseName ?? courseInfo?.courseName ?? '';

  const [provinceId, setProvinceId] = useState<string>(ALL_PROVINCES);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const [rulesVisible, setRulesVisible] = useState(false);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rules, setRules] = useState<ExamRule[]>([]);
  const [rulesForSet, setRulesForSet] = useState<ExamSet | null>(null);

  // Drives the countdown labels without re-fetching anything.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const provinces = useAsyncData(() => fetchProvinces(), []);
  const sections = useAsyncData(() => fetchExamSections(courseId, subcourseId), [courseId, subcourseId]);

  // Default to the first available tab once sections arrive.
  useEffect(() => {
    if (!sectionId && sections.data && sections.data.length > 0) {
      setSectionId(sections.data[0].id);
    }
  }, [sections.data, sectionId]);

  const sets = useAsyncData(
    () =>
      subcourseId && sectionId
        ? fetchExamSets({ subcourseId, sectionId, provinceId })
        : Promise.resolve([]),
    [subcourseId, sectionId, provinceId]
  );

  const attempts = useAsyncData(
    () => (user ? fetchExamAttempts(user.uid) : Promise.resolve({})),
    [user?.uid]
  );

  const activeSection = useMemo(
    () => sections.data?.find((s) => s.id === sectionId) ?? null,
    [sections.data, sectionId]
  );
  const accentColor = activeSection?.color ?? colors.primary;

  const loading = provinces.loading || sections.loading || sets.loading;
  const refreshing = provinces.refreshing || sections.refreshing || sets.refreshing || attempts.refreshing;
  const onRefresh = useCallback(() => {
    provinces.refresh();
    sections.refresh();
    sets.refresh();
    attempts.refresh();
  }, [provinces, sections, sets, attempts]);

  /** Cards more than 10 minutes away are filtered out entirely. */
  const visibleCards = useMemo(() => {
    const attemptMap = attempts.data ?? {};
    return (sets.data ?? [])
      .map((set) => ({
        set,
        state: resolveExamCardState(
          set,
          now,
          (attemptMap[set.id]?.length ?? 0) > 0,
          // Purchases aren't implemented yet, so a pro set stays locked. The
          // subscription screen will supply this later.
          false
        ),
      }))
      .filter((entry) => entry.state.kind !== 'hidden');
  }, [sets.data, attempts.data, now]);

  const openRules = async (set: ExamSet) => {
    setRulesForSet(set);
    setRules([]);
    setRulesVisible(true);
    setRulesLoading(true);
    try {
      const fetched = await fetchExamRules({
        courseId: set.courseId,
        subcourseId: set.subcourseId,
        provinceId: set.provinceId,
        sectionId: set.sectionId,
      });
      setRules(fetched);
    } catch {
      setRules([]);
    } finally {
      setRulesLoading(false);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const result = await seedExamHub();
      showToast(`Seeded ${result.total} exam documents`, 'success');
      onRefresh();
    } catch {
      showToast('Seeding failed. Check Firestore rules allow writes.', 'error');
    } finally {
      setSeeding(false);
    }
  };

  const provinceChips = useMemo(
    () => [
      { id: ALL_PROVINCES, label: 'All Board' },
      ...(provinces.data ?? []).map((p) => ({
        id: p.id,
        label: language === 'ne' ? p.nameNe : p.nameEn,
      })),
    ],
    [provinces.data, language]
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ===== Stable header ===== */}
      <LinearGradient
        colors={['#1D4ED8', '#2563EB', '#3B82F6']}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <View style={styles.headerTopRow}>
          <View style={styles.headerTitleRow}>
            <View style={styles.headerIconBox}>
              <Ionicons name="school" size={18} color="#FFF" />
            </View>
            <Text variant="h2" weight="bold" style={styles.headerTitle} numberOfLines={1}>
              Loksewa Exams Hub
            </Text>
          </View>
          {/* Dev seeding entry point. Remove once the collections are populated. */}
          <Pressable
            onPress={handleSeed}
            disabled={seeding}
            style={({ pressed }) => [styles.seedButton, { opacity: pressed || seeding ? 0.6 : 1 }]}
            accessibilityLabel="Seed exam data"
          >
            <Ionicons name={seeding ? 'cloud-upload' : 'cloud-upload-outline'} size={14} color="#FFF" />
            <Text variant="caption" weight="bold" style={styles.seedText}>
              {seeding ? 'Seeding…' : 'Seed Remaining'}
            </Text>
          </Pressable>
        </View>

        {/* Province filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabStrip}
        >
          {provinceChips.map((chip) => {
            const active = chip.id === provinceId;
            return (
              <Pressable
                key={chip.id}
                onPress={() => setProvinceId(chip.id)}
                style={[styles.provinceChip, active ? styles.provinceChipActive : styles.provinceChipIdle]}
              >
                {active ? <Ionicons name="checkmark" size={14} color="#1D4ED8" /> : null}
                <Text
                  variant="bodySmall"
                  weight={active ? 'bold' : 'medium'}
                  style={{ color: active ? '#1D4ED8' : '#FFF' }}
                  numberOfLines={1}
                >
                  {chip.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Section tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabStrip}
        >
          {(sections.data ?? []).map((section) => {
            const active = section.id === sectionId;
            return (
              <Pressable
                key={section.id}
                onPress={() => setSectionId(section.id)}
                style={[styles.sectionTab, active ? styles.sectionTabActive : styles.sectionTabIdle]}
              >
                <Text
                  variant="bodySmall"
                  weight="bold"
                  style={{ color: active ? '#78350F' : 'rgba(255,255,255,0.9)' }}
                  numberOfLines={1}
                >
                  {language === 'ne' ? section.nameNe : section.nameEn}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </LinearGradient>

      {/* ===== Cards ===== */}
      {sets.error || sections.error ? (
        <DataNotFound
          onRetry={() => {
            sections.refetch();
            sets.refetch();
          }}
        />
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: spacing.xxl, gap: spacing.md }}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Section description banner */}
          {activeSection ? (
            <Animated.View
              entering={FadeIn.duration(250)}
              style={[
                styles.banner,
                { backgroundColor: `${accentColor}12`, borderColor: `${accentColor}33`, borderRadius: radius.lg, padding: spacing.md },
              ]}
            >
              <View style={styles.bannerHead}>
                <Ionicons name="megaphone" size={18} color={accentColor} />
                <Text variant="bodyLarge" weight="bold" style={{ flex: 1, color: accentColor }}>
                  {language === 'ne' ? activeSection.nameNe : activeSection.nameEn}
                </Text>
              </View>
              <Text variant="bodySmall" secondary style={{ lineHeight: 19 }}>
                {activeSection.description}
              </Text>
            </Animated.View>
          ) : null}

          {!subcourseId ? (
            <EmptyState
              icon="school-outline"
              title="Set up your course first"
              description="Exam sets are matched to your enrolled course and subcourse."
              ctaLabel="Set up course"
              ctaIcon="arrow-forward"
              onCtaPress={() => router.push('/course-setup?mode=update')}
            />
          ) : loading ? null : visibleCards.length === 0 ? (
            <EmptyState
              icon="calendar-outline"
              title="No exams open right now"
              description="Exam cards appear 10 minutes before their start time. Pull down to refresh, or check another board."
            />
          ) : (
            visibleCards.map((entry, index) => (
              <Animated.View key={entry.set.id} entering={FadeInDown.delay(index * 60).duration(280)}>
                <ExamCard
                  set={entry.set}
                  state={entry.state}
                  accentColor={accentColor}
                  subcourseLabel={subcourseLabel}
                  onRulesPress={() => openRules(entry.set)}
                  onPrimaryPress={() => {
                    if (entry.state.kind === 'locked') {
                      showToast('Purchasing is coming in the next update.', 'info');
                      return;
                    }
                    if (entry.set.contentType === 'pdf') {
                      if (entry.set.pdfUrl) {
                        router.push({
                          pathname: '/pdf/[id]',
                          params: { id: entry.set.id, uri: entry.set.pdfUrl, title: entry.set.title },
                        } as never);
                      } else {
                        showToast('The paper for this set has not been uploaded yet.', 'warning');
                      }
                      return;
                    }
                    // Quiz, summary, review and rankings land in the next update.
                    showToast('The quiz screen is coming in the next update.', 'info');
                  }}
                  onRankingPress={() => showToast('Rankings are coming in the next update.', 'info')}
                />
              </Animated.View>
            ))
          )}
        </ScrollView>
      )}

      <PageLoaderOverlay visible={loading || seeding} label={seeding ? 'Seeding exam data…' : 'Loading Exams…'} />

      <ExamRulesSheet
        visible={rulesVisible}
        onClose={() => setRulesVisible(false)}
        rules={rules}
        loading={rulesLoading}
        examTitle={rulesForSet?.title}
        accentColor={accentColor}
        // Opened from the card, so this is informational only — the pre-attempt
        // variant with "Start Quiz" arrives with the quiz screen.
        primaryLabel="OK"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingBottom: 14,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    gap: 12,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 16,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  headerIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: '#FFF', fontSize: 19, flexShrink: 1 },
  seedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    flexShrink: 0,
  },
  seedText: { color: '#FFF' },
  tabStrip: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  provinceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  // Provinces select to WHITE; sections select to AMBER. Two different rows of
  // pills sitting next to each other read as one control if they highlight the
  // same way, so each level of filtering gets its own colour.
  provinceChipActive: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  provinceChipIdle: { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.45)' },
  sectionTab: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5 },
  sectionTabActive: { backgroundColor: '#FBBF24', borderColor: '#FBBF24' },
  sectionTabIdle: { backgroundColor: 'rgba(255,255,255,0.10)', borderColor: 'rgba(255,255,255,0.35)' },
  banner: { borderWidth: StyleSheet.hairlineWidth, gap: 6 },
  bannerHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
