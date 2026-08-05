// Quiz screen.
//
// Layout: a rail of question numbers down the LEFT for jumping around, the
// question and its four options on the right, a countdown beside the question,
// and Next / Submit at the bottom.
//
// Leaving is guarded: the header back button and the Android hardware back both
// ask for confirmation, and the iOS swipe-back gesture is disabled for this route
// only (see the Stack.Screen options below), so an attempt can't be lost by an
// accidental swipe.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet, BackHandler } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { useAuthStore } from '@/src/core/store/authStore';
import { useProfileStore } from '@/src/core/store/profileStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import {
  fetchExamSet,
  fetchExamRules,
  fetchAttemptsForSet,
  saveExamAttempt,
  scoreAttempt,
  type ExamRule,
} from '@/src/core/firebase/services/examHub';
import { showToast } from '@/src/core/store/toastStore';
import { Text } from '@/src/components/misc/Text';
import { ThemeToggleButton } from '@/src/components/misc/ThemeToggleButton';
import { ExamRulesSheet } from '@/src/components/exam/ExamRulesSheet';
import { ConfirmDialog } from '@/src/components/feedback/ConfirmDialog';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';

/** -1 means "not answered" everywhere in this flow. */
const UNANSWERED = -1;

function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function QuizScreen() {
  const { setId } = useLocalSearchParams<{ setId: string }>();
  const { colors, radius, spacing, effective, setMode } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const profile = useProfileStore((s) => s.profile);
  const courseInfo = useProfileStore((s) => s.courseInfo);

  const examSet = useAsyncData(() => (setId ? fetchExamSet(setId) : Promise.resolve(null)), [setId]);

  const [answers, setAnswers] = useState<number[]>([]);
  const [current, setCurrent] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  // Rules are shown once before the attempt begins, with "Start Quiz" as the
  // primary action — the informational variant lives on the exam card.
  const [rulesVisible, setRulesVisible] = useState(true);
  const [rules, setRules] = useState<ExamRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [started, setStarted] = useState(false);

  const startedAtRef = useRef<number | null>(null);
  const submittedRef = useRef(false);

  const questions = examSet.data?.questions ?? [];

  // Seed the answer array once the set arrives.
  useEffect(() => {
    if (questions.length > 0 && answers.length === 0) {
      setAnswers(new Array(questions.length).fill(UNANSWERED));
    }
  }, [questions.length, answers.length]);

  // Load the rules for this exact set.
  useEffect(() => {
    const set = examSet.data;
    if (!set) return;
    setRulesLoading(true);
    fetchExamRules({
      courseId: set.courseId,
      subcourseId: set.subcourseId,
      provinceId: set.provinceId,
      sectionId: set.sectionId,
    })
      .then(setRules)
      .catch(() => setRules([]))
      .finally(() => setRulesLoading(false));
  }, [examSet.data]);

  const handleSubmit = useCallback(
    async (auto: boolean) => {
      const set = examSet.data;
      if (!set || !user || submittedRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);

      const breakdown = scoreAttempt(set.questions, answers, set.passPercent);
      const elapsed = startedAtRef.current
        ? Math.round((Date.now() - startedAtRef.current) / 1000)
        : set.durationMinutes * 60;

      const previous = await fetchAttemptsForSet(user.uid, set.id).catch(() => []);

      try {
        await saveExamAttempt(
          user.uid,
          {
            examSetId: set.id,
            attemptNumber: previous.length + 1,
            score: breakdown.percent,
            totalQuestions: set.questions.length,
            correct: breakdown.correct,
            incorrect: breakdown.incorrect,
            skipped: breakdown.skipped,
            passed: breakdown.passed ? 1 : 0,
            timeTakenSeconds: elapsed,
            answers,
          },
          {
            name: profile?.name || user.displayName || 'Anonymous',
            photoURL: profile?.photoURL ?? user.photoURL ?? null,
          }
        );
      } catch {
        showToast('Could not save your attempt. Check your connection.', 'error');
        submittedRef.current = false;
        setSubmitting(false);
        return;
      }

      if (auto) showToast('Time is up — your exam was submitted automatically.', 'info');

      // replace(), not push(): the quiz must not be reachable with Back once
      // it has been submitted.
      router.replace({
        pathname: '/exam/[setId]/summary',
        params: {
          setId: set.id,
          answers: JSON.stringify(answers),
          timeTaken: String(elapsed),
        },
      } as never);
    },
    [examSet.data, user, answers, profile, router]
  );

  // Countdown. Starts only after the rules sheet is dismissed, so reading the
  // rules never eats into exam time.
  useEffect(() => {
    if (!started || !examSet.data) return;
    if (secondsLeft === null) {
      setSecondsLeft(examSet.data.durationMinutes * 60);
      startedAtRef.current = Date.now();
      return;
    }
    if (secondsLeft <= 0) {
      void handleSubmit(true);
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [started, examSet.data, secondsLeft, handleSubmit]);

  // Android hardware back gets the same guard as the header button.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (submittedRef.current) return false;
      setShowLeaveConfirm(true);
      return true;
    });
    return () => sub.remove();
  }, []);

  const answeredCount = useMemo(() => answers.filter((a) => a !== UNANSWERED).length, [answers]);
  const question = questions[current];
  const isLast = current === questions.length - 1;

  const selectOption = (optionIndex: number) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[current] = next[current] === optionIndex ? UNANSWERED : optionIndex;
      return next;
    });
  };

  if (examSet.loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <PageLoaderOverlay visible label="Loading Exam…" />
      </View>
    );
  }

  if (examSet.error || !examSet.data || questions.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <DataNotFound
          title="Exam not available"
          description="This exam set has no questions yet."
          onRetry={() => router.back()}
        />
      </View>
    );
  }

  const set = examSet.data;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Disables the iOS swipe-back gesture for this route only. */}
      <Stack.Screen options={{ gestureEnabled: false }} />

      {/* Header */}
      <LinearGradient colors={['#1D4ED8', '#2563EB', '#3B82F6']} style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => setShowLeaveConfirm(true)} style={styles.headerIcon} accessibilityLabel="Leave exam">
          <Ionicons name="arrow-back" size={20} color="#FFF" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text variant="bodyLarge" weight="bold" style={styles.headerTitle} numberOfLines={1}>{set.title}</Text>
          <Text variant="caption" style={styles.headerSubtitle} numberOfLines={1}>
            {courseInfo?.subcourseName ?? courseInfo?.courseName ?? ''}
          </Text>
        </View>
        <ThemeToggleButton isDark={effective === 'dark'} onToggle={() => setMode(effective === 'dark' ? 'light' : 'dark')} size={34} />
      </LinearGradient>

      <View style={styles.body}>
        {/* Question number rail */}
        <ScrollView
          style={[styles.rail, { backgroundColor: colors.surfaceAlt }]}
          contentContainerStyle={styles.railContent}
          showsVerticalScrollIndicator={false}
        >
          {questions.map((_, index) => {
            const isCurrent = index === current;
            const isAnswered = answers[index] !== undefined && answers[index] !== UNANSWERED;
            return (
              <Pressable
                key={index}
                onPress={() => setCurrent(index)}
                style={[
                  styles.railItem,
                  {
                    borderRadius: radius.sm,
                    backgroundColor: isCurrent ? colors.primary : isAnswered ? `${colors.success}22` : colors.surface,
                    borderColor: isCurrent ? colors.primary : isAnswered ? colors.success : colors.border,
                  },
                ]}
                accessibilityLabel={`Question ${index + 1}`}
              >
                <Text
                  variant="bodySmall"
                  weight="bold"
                  style={{ color: isCurrent ? '#FFF' : isAnswered ? colors.success : colors.textSecondary }}
                >
                  {index + 1}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Question + options */}
        <View style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md }}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.questionMetaRow}>
              <View style={[styles.metaPill, { backgroundColor: `${colors.primary}17` }]}>
                <Text variant="caption" weight="bold" style={{ color: colors.primary }}>
                  Q {current + 1} / {questions.length}
                </Text>
              </View>
              <View
                style={[
                  styles.metaPill,
                  {
                    backgroundColor:
                      secondsLeft !== null && secondsLeft <= 30 ? `${colors.error}17` : `${colors.success}17`,
                  },
                ]}
              >
                <Ionicons
                  name="time-outline"
                  size={13}
                  color={secondsLeft !== null && secondsLeft <= 30 ? colors.error : colors.success}
                />
                <Text
                  variant="caption"
                  weight="bold"
                  style={{ color: secondsLeft !== null && secondsLeft <= 30 ? colors.error : colors.success }}
                >
                  {formatClock(secondsLeft ?? set.durationMinutes * 60)}
                </Text>
              </View>
            </View>

            <Animated.View key={current} entering={FadeIn.duration(180)} style={{ gap: spacing.md }}>
              <Text variant="bodyLarge" weight="semiBold" style={{ lineHeight: 26 }}>
                {question?.question ?? ''}
              </Text>

              {(question?.options ?? []).map((option, optionIndex) => {
                const selected = answers[current] === optionIndex;
                return (
                  <Pressable
                    key={optionIndex}
                    onPress={() => selectOption(optionIndex)}
                    style={({ pressed }) => [
                      styles.option,
                      {
                        borderRadius: radius.md,
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected ? `${colors.primary}12` : colors.surface,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.optionBullet,
                        { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : 'transparent' },
                      ]}
                    >
                      <Text variant="caption" weight="bold" style={{ color: selected ? '#FFF' : colors.textSecondary }}>
                        {String.fromCharCode(65 + optionIndex)}
                      </Text>
                    </View>
                    <Text variant="body" style={{ flex: 1 }}>{option}</Text>
                  </Pressable>
                );
              })}
            </Animated.View>
          </ScrollView>

          {/* Bottom bar */}
          <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.divider, paddingBottom: insets.bottom + 12 }]}>
            <Text variant="caption" secondary>{answeredCount} / {questions.length} answered</Text>
            <View style={styles.bottomActions}>
              {current > 0 ? (
                <Pressable
                  onPress={() => setCurrent((c) => c - 1)}
                  style={({ pressed }) => [styles.secondaryBtn, { borderColor: colors.border, borderRadius: radius.md, opacity: pressed ? 0.8 : 1 }]}
                >
                  <Ionicons name="chevron-back" size={16} color={colors.textPrimary} />
                  <Text variant="bodySmall" weight="semiBold">Previous</Text>
                </Pressable>
              ) : null}

              <Pressable
                onPress={() => (isLast ? setShowSubmitConfirm(true) : setCurrent((c) => c + 1))}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { backgroundColor: isLast ? colors.success : colors.primary, borderRadius: radius.md, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text variant="bodySmall" weight="bold" style={{ color: '#FFF' }}>{isLast ? 'Submit' : 'Next'}</Text>
                <Ionicons name={isLast ? 'checkmark-done' : 'chevron-forward'} size={16} color="#FFF" />
              </Pressable>
            </View>
          </View>
        </View>
      </View>

      {/* Rules gate — the countdown only starts once this is dismissed. */}
      <ExamRulesSheet
        visible={rulesVisible}
        onClose={() => {
          setRulesVisible(false);
          setStarted(true);
        }}
        rules={rules}
        loading={rulesLoading}
        examTitle={set.title}
        primaryLabel="Start Quiz"
        onPrimaryPress={() => {
          setRulesVisible(false);
          setStarted(true);
        }}
      />

      <PageLoaderOverlay visible={submitting} label="Submitting your answers…" />

      <ConfirmDialog
        visible={showLeaveConfirm}
        title="Leave the exam?"
        message="Your attempt will not be saved and the questions you have answered will be lost."
        confirmLabel="Leave"
        cancelLabel="Keep going"
        destructive
        onConfirm={() => {
          setShowLeaveConfirm(false);
          router.back();
        }}
        onCancel={() => setShowLeaveConfirm(false)}
      />

      <ConfirmDialog
        visible={showSubmitConfirm}
        title="Submit your exam?"
        message={
          answeredCount < questions.length
            ? `${questions.length - answeredCount} question(s) are still unanswered. Unanswered questions score zero but carry no penalty.`
            : 'You have answered every question. Ready to submit?'
        }
        confirmLabel="Submit"
        cancelLabel="Review first"
        onConfirm={() => {
          setShowSubmitConfirm(false);
          void handleSubmit(false);
        }}
        onCancel={() => setShowSubmitConfirm(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: '#FFF' },
  headerSubtitle: { color: 'rgba(255,255,255,0.85)' },
  body: { flex: 1, flexDirection: 'row' },
  rail: { width: 54 },
  railContent: { padding: 8, gap: 8, alignItems: 'center' },
  railItem: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  questionMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1.5 },
  optionBullet: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingTop: 10, gap: 8 },
  bottomActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1.5,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
  },
});
