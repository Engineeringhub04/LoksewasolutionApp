// Daily Test — quiz screen.
//
// One question at a time, each inside a single card, each on its own countdown
// taken from the model (`timeSeconds` per question, falling back to the model's
// `perQuestionTimeSeconds`). When a question's time runs out we move on
// automatically — and on the last question that means submitting — so the
// attempt always reflects real exam pressure. The timer blinks through its final
// five seconds as a warning.
//
// Deliberately one-directional: there is no "Previous". Once a question is left
// behind it stays behind, which is what keeps the per-question timer meaningful.
//
// Leaving is guarded (header back + Android back both confirm, iOS swipe-back
// disabled) so an attempt isn't lost by accident. On submit the full result is
// saved to Firestore (users/{uid}/daily_test_results) AND appended to the
// on-device history feed, then we replace() to the summary so Back can't return
// to the finished quiz.
//
// One model, one attempt, PER ACCOUNT: on open this screen asks Firestore whether
// this uid already has a saved result for the model and, if so, replaces itself
// with that result instead of serving the questions. The check is a server read on
// purpose — local history is device-only, so the same id on a second phone (or
// after a reinstall) would otherwise get a free retake.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet, BackHandler } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  FadeInDown,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { useAuthStore } from '@/src/core/store/authStore';
import { useProfileStore } from '@/src/core/store/profileStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import {
  fetchDailyTestModels,
  fetchDailyTestResultForModel,
  formatDateKeyShort,
  isDemoModel,
  isReleased,
  questionTimeSeconds,
  scoreDailyTest,
  saveDailyTestResult,
  todayDateKey,
  type DailyTestModel,
  type DailyTestResult,
} from '@/src/core/firebase/services/dailyTest';
import { addDailyTestActivity } from '@/src/core/services/dailyTestActivity';
import { markDailyTestCompleted } from '@/src/core/store/dailyTestCompletionStore';
import { showToast } from '@/src/core/store/toastStore';
import { Text } from '@/src/components/misc/Text';
import { ConfirmDialog } from '@/src/components/feedback/ConfirmDialog';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { BlurLoaderOverlay } from '@/src/components/feedback/BlurLoaderOverlay';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { ThemeToggleButton } from '@/src/components/misc/ThemeToggleButton';

/** -1 means "not answered" everywhere in this flow. */
const UNANSWERED = -1;
/** Sentinel for "this question's clock hasn't been set yet". */
const TIMER_IDLE = -1;
/** Blink the timer for the last N seconds as a warning. */
const WARN_SECONDS = 5;

function formatClock(seconds: number): string {
  const safe = Math.max(0, seconds);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `0:${String(s).padStart(2, '0')}`;
}

interface QuizBootData {
  model: DailyTestModel | null;
  /** The account's already-saved attempt for this model, if any. Non-null == the
   *  quiz must not be shown again. */
  existing: DailyTestResult | null;
}

export default function DailyTestQuizScreen() {
  const { modelId } = useLocalSearchParams<{ modelId: string }>();
  const { colors, radius, spacing, effective, setMode } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const courseInfo = useProfileStore((s) => s.courseInfo);
  const subcourseId = courseInfo?.subcourseId ?? null;

  // Load the model by id from the enrolled subcourse's list, AND ask the database
  // whether this account has already finished it. The re-attempt guard has to be
  // a server read: on-device history is wiped by a reinstall and never travels to
  // a second phone, so trusting it would let the same id retake a done model.
  const modelData = useAsyncData<QuizBootData>(
    async () => {
      if (!subcourseId || !modelId) return { model: null, existing: null };
      const models = await fetchDailyTestModels(subcourseId);
      // EXACT id, with no fallback. There used to be a `?? pickTodayModel(models)`
      // here, which quietly served *some* model when the requested one was gone.
      // Under date-based scheduling that is a hole rather than a convenience: a
      // stale link, a notification tap or a hand-typed id would start today's
      // test under yesterday's identity, and the result would be saved against
      // the wrong model. Missing means missing.
      const found = models.find((m) => m.id === modelId) ?? null;
      if (!found) return { model: null, existing: null };
      const existing = user?.uid
        ? await fetchDailyTestResultForModel(user.uid, found.id).catch(() => null)
        : null;
      return { model: found, existing };
    },
    [subcourseId, modelId, user?.uid],
    { enabled: !!subcourseId },
  );

  const model = modelData.data?.model ?? null;
  const existingResult = modelData.data?.existing ?? null;
  const questions = model?.questions ?? [];

  // THE SCHEDULE, RE-CHECKED HERE. The landing card already refuses to open a
  // model that is not playable, but this screen can also be reached by a deep
  // link, a notification, or Back-then-forward after midnight, so the rule is
  // enforced where the questions actually live rather than only at the button.
  // Returning a reason (not a boolean) lets the screen say *why*, which is the
  // difference between "not unlocked until Saturday" and a dead end.
  const scheduleBlock = useMemo<{ title: string; description: string } | null>(() => {
    if (!model) return null;
    if (isDemoModel(model)) {
      return {
        title: 'Not a real test',
        description:
          'That card is only a preview of how the next Daily Test will look. The real one appears on its release date.',
      };
    }
    if (!model.testDate) {
      return {
        title: 'Test not scheduled',
        description: 'This model has no release date yet, so it cannot be attempted.',
      };
    }
    const today = todayDateKey();
    if (!isReleased(model, today)) {
      return {
        title: 'Not unlocked yet',
        description: `This test unlocks on ${formatDateKeyShort(model.testDate)} at 12:00 AM. Come back then.`,
      };
    }
    // Released, its day has passed, and the account has no saved attempt → the
    // user skipped it. A COMPLETED older model is not blocked here: it has an
    // `existingResult`, and the effect below opens its summary instead.
    if (model.testDate < today && !existingResult) {
      return {
        title: 'Test missed',
        description: `This test was only available on ${formatDateKeyShort(
          model.testDate,
        )} and can no longer be attempted.`,
      };
    }
    return null;
  }, [model, existingResult]);

  const [answers, setAnswers] = useState<number[]>([]);
  const [current, setCurrent] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  // The clock carries the index it belongs to. Without that, the render between
  // "advance" and "reset the clock" still holds `left: 0` and would fire the
  // expiry a second time for the next question.
  const [timer, setTimer] = useState<{ index: number; left: number }>({
    index: -1,
    left: TIMER_IDLE,
  });

  const startedAtRef = useRef<number>(Date.now());
  const submittedRef = useRef(false);
  const redirectedRef = useRef(false);

  // Already done on this account → never show the questions again. Send the user
  // straight to their saved result instead, whichever phone they are on.
  useEffect(() => {
    if (!existingResult || redirectedRef.current) return;
    redirectedRef.current = true;
    // Reuse the submitted flag so the leave guard / back handler stay quiet.
    submittedRef.current = true;
    showToast('You have already completed this model.', 'info');
    router.replace({
      pathname: '/daily-test/[modelId]/summary',
      params: {
        modelId: existingResult.modelId,
        answers: JSON.stringify(existingResult.answers),
        timeTaken: String(existingResult.timeTakenSeconds),
        fromHistory: '1',
      },
    } as never);
  }, [existingResult, router]);

  // A blocked model is not an attempt in progress, so the leave-confirm guard
  // must stay out of the way — pressing Back on the explanation screen should
  // simply go back, not ask whether to abandon answers that do not exist.
  useEffect(() => {
    if (scheduleBlock) submittedRef.current = true;
  }, [scheduleBlock]);

  useEffect(() => {
    if (questions.length > 0 && answers.length === 0) {
      setAnswers(new Array(questions.length).fill(UNANSWERED));
    }
  }, [questions.length, answers.length]);

  const answeredCount = useMemo(
    () => answers.filter((a) => a !== UNANSWERED).length,
    [answers],
  );
  const question = questions[current];
  const isLast = current === questions.length - 1;

  const handleSubmit = useCallback(async () => {
    if (!model || !user || submittedRef.current) return;
    // Belt-and-braces: a blocked model never renders the quiz, and its clock is
    // paused, so nothing should be able to reach here — but scoring and saving
    // an attempt at a test the user was not allowed to take is the one mistake
    // that would be written to the database permanently.
    if (scheduleBlock) return;
    submittedRef.current = true;
    setSubmitting(true);

    const breakdown = scoreDailyTest(model, answers);
    const elapsed = Math.round((Date.now() - startedAtRef.current) / 1000);
    const modelName = model.modelName || model.name;

    // Declared outside the try because the on-device history write below needs it
    // and lives in its own try/catch — see the note there.
    let resultId: string;
    try {
      resultId = await saveDailyTestResult(user.uid, {
        modelId: model.id,
        modelName,
        courseId: model.courseId,
        subcourseId: model.subcourseId,
        score: breakdown.percent,
        totalQuestions: model.questions.length,
        correct: breakdown.correct,
        incorrect: breakdown.incorrect,
        skipped: breakdown.skipped,
        timeTakenSeconds: elapsed,
        answers,
      });

      // Tell the landing screen straight away. Without this the user walks back
      // from the summary to a card still offering "Start Test" until they
      // pull-to-refresh — the fetched results map is a snapshot from before this
      // attempt existed. This is an in-memory store, so the flip costs no read,
      // and the next real fetch supersedes it.
      markDailyTestCompleted(user.uid, {
        id: resultId,
        modelId: model.id,
        modelName,
        courseId: model.courseId,
        subcourseId: model.subcourseId,
        score: breakdown.percent,
        totalQuestions: model.questions.length,
        correct: breakdown.correct,
        incorrect: breakdown.incorrect,
        skipped: breakdown.skipped,
        timeTakenSeconds: elapsed,
        answers,
        // The server stamped the real value; this local copy only needs to sort
        // correctly against other entries until the next fetch replaces it.
        createdAt: new Date().toISOString(),
      });
    } catch {
      showToast('Could not save your result. Check your connection.', 'error');
      submittedRef.current = false;
      setSubmitting(false);
      return;
    }

    // On-device history feed, scoped to this uid so two accounts on the same
    // phone never see each other's attempts. The answer sheet is stored alongside
    // so tapping this entry later reopens the summary with zero reads.
    //
    // Its own try/catch on purpose: the account's result is already saved on the
    // server by this point, so a failed local write must NOT unwind the submit
    // and invite a second attempt — that would duplicate the stored result. The
    // feed is a convenience; losing one row of it is not worth a retry prompt.
    try {
      await addDailyTestActivity(user.uid, {
        id: resultId,
        modelId: model.id,
        modelName,
        score: breakdown.percent,
        totalQuestions: model.questions.length,
        correct: breakdown.correct,
        incorrect: breakdown.incorrect,
        skipped: breakdown.skipped,
        timeTakenSeconds: elapsed,
        completedAt: Date.now(),
        answers,
        passed: breakdown.passed,
        passPercent: model.passPercent,
      });
    } catch {
      // Silent: the result itself is safe, and the history list rebuilds from the
      // server on the next visit.
    }

    router.replace({
      pathname: '/daily-test/[modelId]/summary',
      params: {
        modelId: model.id,
        answers: JSON.stringify(answers),
        timeTaken: String(elapsed),
      },
    } as never);
  }, [model, user, answers, router, scheduleBlock]);

  // --- Per-question countdown -------------------------------------------------
  // Paused while a dialog is up, the result is saving, we are bouncing the user to
  // an already-saved result, or the model is not playable at all — so neither a
  // confirmation nor an explanation screen eats into anyone's time.
  const paused =
    submitting || showLeaveConfirm || showSubmitConfirm || !!existingResult || !!scheduleBlock;

  // Restart the clock whenever the question changes.
  useEffect(() => {
    if (!model || questions.length === 0) return;
    setTimer({ index: current, left: questionTimeSeconds(model, current) });
  }, [model, current, questions.length]);

  const secondsLeft = timer.index === current ? timer.left : TIMER_IDLE;

  // Tick. A chained timeout (rather than an interval) means `paused` takes effect
  // immediately and no tick can queue up behind a dialog.
  useEffect(() => {
    if (paused || timer.left <= 0) return;
    const id = setTimeout(
      () => setTimer((prev) => (prev.left > 0 ? { ...prev, left: prev.left - 1 } : prev)),
      1000,
    );
    return () => clearTimeout(id);
  }, [timer, paused]);

  // Expiry: advance, or submit if this was the last question.
  useEffect(() => {
    if (paused || !model) return;
    if (timer.index !== current || timer.left !== 0) return;

    if (isLast) {
      showToast("Time's up — submitting your answers.", 'info');
      void handleSubmit();
    } else {
      showToast("Time's up — moved to the next question.", 'info');
      setCurrent((c) => c + 1);
    }
  }, [timer, paused, model, current, isLast, handleSubmit]);

  // Warning blink over the final seconds.
  const warning = secondsLeft >= 0 && secondsLeft <= WARN_SECONDS;
  const blink = useSharedValue(1);
  useEffect(() => {
    if (warning && !paused) {
      blink.value = withRepeat(
        withSequence(withTiming(0.35, { duration: 320 }), withTiming(1, { duration: 320 })),
        -1,
        true,
      );
    } else {
      cancelAnimation(blink);
      blink.value = 1;
    }
  }, [warning, paused, blink]);
  const blinkStyle = useAnimatedStyle(() => ({ opacity: blink.value }));

  // Android hardware back gets the same guard as the header button.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (submittedRef.current) return false;
      setShowLeaveConfirm(true);
      return true;
    });
    return () => sub.remove();
  }, []);

  const selectOption = (optionIndex: number) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[current] = next[current] === optionIndex ? UNANSWERED : optionIndex;
      return next;
    });
  };

  // The redirect above is a replace(), so hold the loader rather than flashing a
  // quiz the user is not allowed to retake.
  if (modelData.loading || existingResult) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <PageLoaderOverlay
          visible
          label={existingResult ? 'Opening your saved result…' : 'Loading Daily Test…'}
        />
      </View>
    );
  }

  // Not playable: say exactly why and offer the only useful action, going back.
  // Checked BEFORE the questions render, so a future-dated or missed model never
  // flashes its first question.
  if (scheduleBlock) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <DataNotFound
          title={scheduleBlock.title}
          description={scheduleBlock.description}
          onRetry={() => (router.canGoBack() ? router.back() : router.replace('/daily-test'))}
          retryLabel="Go back"
          retryIcon="arrow-back"
        />
      </View>
    );
  }

  if (modelData.error || !model || questions.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <DataNotFound
          title="Daily Test not available"
          description="This model has no questions yet."
          onRetry={() => router.back()}
        />
      </View>
    );
  }

  const timerColor = warning ? '#DC2626' : colors.primary;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Disables the iOS swipe-back gesture for this route only. */}
      <Stack.Screen options={{ gestureEnabled: false }} />

      {/* Header — back on the left, theme toggle on the right. */}
      <LinearGradient
        colors={['#1D4ED8', '#2563EB', '#3B82F6']}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <Pressable
          onPress={() => setShowLeaveConfirm(true)}
          style={styles.headerIcon}
          hitSlop={6}
          accessibilityLabel="Leave Daily Test"
        >
          <Ionicons name="arrow-back" size={20} color="#FFF" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text variant="bodyLarge" weight="bold" style={styles.headerTitle} numberOfLines={1}>
            {model.modelName || model.name}
          </Text>
          <Text variant="caption" style={styles.headerSubtitle} numberOfLines={1}>
            {courseInfo?.subcourseName ?? courseInfo?.courseName ?? 'Daily Test'}
          </Text>
        </View>
        <ThemeToggleButton
          isDark={effective === 'dark'}
          onToggle={() => setMode(effective === 'dark' ? 'light' : 'dark')}
          size={34}
          iconColor="#FFFFFF"
          backgroundColor="rgba(255,255,255,0.2)"
        />
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}
        showsVerticalScrollIndicator={false}
      >
        {/* Everything for this question lives in ONE card. The card itself does
            not animate — it is only keyed by index so that switching questions
            remounts the options below and replays their entrance. */}
        <View
          key={current}
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border, borderRadius: radius.lg },
          ]}
        >
          <View style={styles.cardTopRow}>
            <View style={[styles.metaPill, { backgroundColor: `${colors.primary}17` }]}>
              <Ionicons name="layers-outline" size={12} color={colors.primary} />
              <Text variant="caption" weight="bold" style={{ color: colors.primary }}>
                Q {current + 1} / {questions.length}
              </Text>
            </View>

            {/* Countdown — blinks for the last few seconds. */}
            <Animated.View
              style={[
                styles.metaPill,
                styles.timerPill,
                { backgroundColor: `${timerColor}18`, borderColor: `${timerColor}55` },
                blinkStyle,
              ]}
            >
              <Ionicons name="timer-outline" size={14} color={timerColor} />
              <Text variant="bodySmall" weight="bold" style={{ color: timerColor }}>
                {formatClock(secondsLeft)}
              </Text>
            </Animated.View>
          </View>

          {question?.category ? (
            <View style={styles.categoryRow}>
              <Ionicons name="pricetag-outline" size={12} color={colors.textSecondary} />
              <Text variant="caption" secondary>
                {question.category}
              </Text>
            </View>
          ) : null}

          <Text variant="bodyLarge" weight="semiBold" style={styles.questionText}>
            {question?.question ?? ''}
          </Text>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Options fade up one after another — the same stagger the Syllabus
              list uses, so the whole app shares one entrance language. */}
          <View style={{ gap: spacing.sm }}>
            {(question?.options ?? []).map((option, optionIndex) => {
              const selected = answers[current] === optionIndex;
              return (
                <Animated.View
                  key={optionIndex}
                  entering={FadeInDown.delay(optionIndex * 60).springify()}
                >
                  <Pressable
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
                        {
                          borderColor: selected ? colors.primary : colors.border,
                          backgroundColor: selected ? colors.primary : 'transparent',
                        },
                      ]}
                    >
                      <Text
                        variant="caption"
                        weight="bold"
                        style={{ color: selected ? '#FFF' : colors.textSecondary }}
                      >
                        {String.fromCharCode(65 + optionIndex)}
                      </Text>
                    </View>
                    <Text variant="body" style={{ flex: 1 }}>
                      {option}
                    </Text>
                    {selected ? (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    ) : null}
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Bottom bar — forward only. */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.divider,
            paddingBottom: insets.bottom + 12,
          },
        ]}
      >
        <Text variant="caption" secondary>
          {answeredCount} / {questions.length} answered
        </Text>
        <Pressable
          onPress={() => (isLast ? setShowSubmitConfirm(true) : setCurrent((c) => c + 1))}
          style={({ pressed }) => [
            styles.primaryBtn,
            {
              backgroundColor: isLast ? colors.success : colors.primary,
              borderRadius: radius.md,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text variant="bodySmall" weight="bold" style={{ color: '#FFF' }}>
            {isLast ? 'Submit' : 'Next'}
          </Text>
          <Ionicons name={isLast ? 'checkmark-done' : 'chevron-forward'} size={16} color="#FFF" />
        </Pressable>
      </View>

      {/* Submit: dim + blur the quiz behind a loader, then go to the summary. */}
      <BlurLoaderOverlay visible={submitting} label="Submitting your answers…" />

      {/* Both prompts are the app's shared ConfirmDialog — the same component the
          rest of the app confirms with, so leaving a quiz looks like deleting a
          note looks like logging out. Only the tone and the labels differ. */}
      <ConfirmDialog
        visible={showLeaveConfirm}
        tone="danger"
        icon="exit-outline"
        title="Leave the Daily Test?"
        subtitle={model.modelName || model.name}
        message={`Your progress will not be saved. ${answeredCount} answered question(s) will be lost and this attempt will not appear in your history.`}
        confirmLabel="Leave anyway"
        confirmIcon="exit-outline"
        cancelLabel="Keep going"
        onConfirm={() => {
          setShowLeaveConfirm(false);
          router.back();
        }}
        onCancel={() => setShowLeaveConfirm(false)}
      />

      <ConfirmDialog
        visible={showSubmitConfirm}
        tone="success"
        icon="checkmark-done"
        title="Submit your answers?"
        subtitle={`${answeredCount} of ${questions.length} answered`}
        message={
          answeredCount < questions.length
            ? `${questions.length - answeredCount} question(s) are still unanswered. Unanswered questions score zero${
                model.negativeMarking ? ' (but carry no penalty)' : ''
              }.`
            : 'You have answered every question. Ready to see your result?'
        }
        confirmLabel="Submit"
        confirmIcon="checkmark-done"
        cancelLabel="Not yet"
        onConfirm={() => {
          setShowSubmitConfirm(false);
          void handleSubmit();
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
  card: {
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  timerPill: { borderWidth: 1, minWidth: 74, justifyContent: 'center' },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12 },
  questionText: { lineHeight: 26, marginTop: 10 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 14 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1.5 },
  optionBullet: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingTop: 10,
    gap: 8,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
  },
});
