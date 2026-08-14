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
import { useRefreshOnFocus } from '@/src/core/hooks/useRefreshOnFocus';
import {
  fetchProvinces,
  fetchExamSections,
  fetchExamSets,
  fetchExamRules,
  fetchExamAttempts,
  resolveExamCardState,
  ALL_PROVINCES,
  type ExamAttempt,
  type ExamRule,
  type ExamSet,
} from '@/src/core/firebase/services/examHub';
import { fetchMyExamAnswersBySet, type ExamAnswer } from '@/src/core/firebase/services/examAnswers';
import { fetchMyExamPurchases } from '@/src/core/firebase/services/examPurchases';
import { showToast } from '@/src/core/store/toastStore';
import { Text } from '@/src/components/misc/Text';
import { ExamCard } from '@/src/components/exam/ExamCard';
import { AdminAnswerDesk } from '@/src/components/exam/AdminAnswerDesk';
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
  const [purchaseNavigating, setPurchaseNavigating] = useState(false);

  const [rulesVisible, setRulesVisible] = useState(false);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rules, setRules] = useState<ExamRule[]>([]);
  const [rulesForSet, setRulesForSet] = useState<ExamSet | null>(null);
  /**
   * 'info'  — opened from the Rules button, primary action is just "OK"
   * 'start' — opened from Start, primary action confirms and enters the quiz
   *
   * The gate lives here rather than inside the quiz screen so the quiz page is
   * never rendered behind a modal; it only opens once the user has confirmed.
   */
  const [rulesMode, setRulesMode] = useState<'info' | 'start'>('info');

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

  const attempts = useAsyncData<Record<string, ExamAttempt[]>>(
    () => (user ? fetchExamAttempts(user.uid) : Promise.resolve({} as Record<string, ExamAttempt[]>)),
    [user?.uid]
  );

  // Keyed by examSetId so PDF cards can look up "did I already submit an
  // answer for this set?" in O(1) — see ExamCard's answerStatus prop.
  const myAnswers = useAsyncData<Record<string, ExamAnswer>>(
    () => (user ? fetchMyExamAnswersBySet(user.uid) : Promise.resolve({} as Record<string, ExamAnswer>)),
    [user?.uid]
  );

  const purchases = useAsyncData(
    () => (user ? fetchMyExamPurchases(user.uid) : Promise.resolve([])),
    [user?.uid]
  );

  const approvedExamIds = useMemo(
    () => (purchases.data ?? []).filter((record) => record.status === 'active').map((record) => record.examSetId),
    [purchases.data]
  );
  const pendingExamIds = useMemo(
    () => (purchases.data ?? []).filter((record) => record.status === 'pending').map((record) => record.examSetId),
    [purchases.data]
  );

  const activeSection = useMemo(
    () => sections.data?.find((s) => s.id === sectionId) ?? null,
    [sections.data, sectionId]
  );
  const overallSubscriptionActive = profile?.isPremium === true && (!profile.premiumExpiryDate || new Date(profile.premiumExpiryDate).getTime() > Date.now());
  const accentColor = activeSection?.color ?? colors.primary;

  const loading = provinces.loading || sections.loading || sets.loading || purchases.loading;
  const refreshing = provinces.refreshing || sections.refreshing || sets.refreshing || attempts.refreshing || myAnswers.refreshing || purchases.refreshing;
  const onRefresh = useCallback(() => {
    provinces.refresh();
    sections.refresh();
    sets.refresh();
    attempts.refresh();
    myAnswers.refresh();
    purchases.refresh();
  }, [provinces, sections, sets, attempts, myAnswers, purchases]);

  // Returning from the summary/details screens must show the new state (a card
  // flipping to Re-Join, a fresh attempt count) without a manual pull.
  useRefreshOnFocus(onRefresh);

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
          overallSubscriptionActive || approvedExamIds.includes(set.id),
          pendingExamIds.includes(set.id)
        ),
      }))
      .filter((entry) => entry.state.kind !== 'hidden');
  }, [sets.data, attempts.data, now, approvedExamIds, pendingExamIds, overallSubscriptionActive]);

  const openRules = async (set: ExamSet, mode: 'info' | 'start') => {
    setRulesForSet(set);
    setRulesMode(mode);
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
          ) : activeSection?.kind === 'theory' && profile?.isAdmin ? (
            // Admins browsing the Theory Desk get the Answer Review workspace
            // right here instead of the normal exam-set card list — grading
            // submissions is the only thing an admin needs to do on this board.
            <AdminAnswerDesk />
          ) : loading ? null : visibleCards.length === 0 ? (
            <EmptyState
              icon="calendar-outline"
              title="No exams open right now"
              description="Exam cards appear 10 minutes before their start time. Pull down to refresh, or check another board."
            />
          ) : (
            visibleCards.map((entry, index) => {
              const myAnswer = entry.set.contentType === 'pdf' ? myAnswers.data?.[entry.set.id] : undefined;
              return (
                <Animated.View key={entry.set.id} entering={FadeInDown.delay(index * 60).duration(280)}>
                  <ExamCard
                    set={entry.set}
                    state={entry.state}
                    accentColor={accentColor}
                    subcourseLabel={subcourseLabel}
                    answerStatus={myAnswer?.status}
                    onRulesPress={() => void openRules(entry.set, 'info')}
                    onPrimaryPress={() => {
                      if (entry.state.kind === 'locked') {
                        setPurchaseNavigating(true);
                        router.push({ pathname: '/exam-purchase/[id]', params: { id: entry.set.id } } as never);
                        return;
                      }
                      if (entry.state.kind === 'pending') {
                        setPurchaseNavigating(true);
                        const pendingPurchase = (purchases.data ?? []).find((record) => record.examSetId === entry.set.id && record.status === 'pending');
                        if (pendingPurchase) {
                          router.push({ pathname: '/subscription/exam-purchase/[id]', params: { id: pendingPurchase.id } } as never);
                        } else {
                          setPurchaseNavigating(false);
                        }
                        return;
                      }
                      if (entry.set.contentType === 'pdf') {
                        // Already submitted -> straight to the (view-only /
                        // editable-within-1hr) submission details screen.
                        // Multiple attempts are not allowed, so this never
                        // routes back into Upload once a submission exists.
                        if (myAnswer) {
                          router.push({ pathname: '/exam-answer/[id]', params: { id: myAnswer.id } } as never);
                          return;
                        }
                        if (entry.set.pdfUrl) {
                          router.push({
                            pathname: '/pdf/[id]',
                            params: {
                              id: entry.set.id,
                              uri: entry.set.pdfUrl,
                              title: entry.set.title,
                              // Only Theory Desk papers accept a written-answer upload —
                              // Past Qns/GK papers are reference material, not assignments.
                              examSetId: entry.set.id,
                              sectionName: language === 'ne' ? activeSection?.nameNe ?? '' : activeSection?.nameEn ?? '',
                              allowUpload: activeSection?.kind === 'theory' ? '1' : '0',
                            },
                          } as never);
                        } else {
                          showToast('The paper for this set has not been uploaded yet.', 'warning');
                        }
                        return;
                      }
                      // Already attempted -> details/attempts screen. Otherwise the
                      // rules sheet opens first and only its confirm enters the quiz.
                      if (entry.state.kind === 'rejoin') {
                        router.push({ pathname: '/exam/[setId]', params: { setId: entry.set.id } } as never);
                      } else {
                        void openRules(entry.set, 'start');
                      }
                    }}
                    onRankingPress={() =>
                      router.push({ pathname: '/exam/[setId]/ranking', params: { setId: entry.set.id } } as never)
                    }
                  />
                </Animated.View>
              );
            })
          )}
        </ScrollView>
      )}

      <PageLoaderOverlay visible={loading || purchaseNavigating} label={purchaseNavigating ? 'Loading…' : 'Loading Exams…'} />

      <ExamRulesSheet
        visible={rulesVisible}
        onClose={() => setRulesVisible(false)}
        rules={rules}
        loading={rulesLoading}
        examTitle={rulesForSet?.title}
        accentColor={accentColor}
        primaryLabel={rulesMode === 'start' ? 'Start Quiz' : 'OK'}
        onPrimaryPress={() => {
          setRulesVisible(false);
          if (rulesMode === 'start' && rulesForSet) {
            router.push({ pathname: '/exam/[setId]/quiz', params: { setId: rulesForSet.id } } as never);
          }
        }}
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
