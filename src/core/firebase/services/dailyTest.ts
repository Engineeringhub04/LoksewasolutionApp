// Daily Test service.
//
// A "model" is one small daily quiz. One document per model lives in
// `app_daily_test_models`, scoped by course + subcourse. The Daily Test screen
// reads only the models for the enrolled subcourse (a single-field `subcourseId`
// query — no composite index, Spark-plan friendly and low read count).
//
// SCHEDULING — each model owns its RELEASE DATE (`testDate`, a plain
// "YYYY-MM-DD" string). A model is invisible until that date arrives locally, and
// from 12:00 AM on that date it is playable. Two models sharing one date both
// appear; a date with no model shows the "no test today" card. This replaced an
// index-rotation scheme (`dayNumber % models.length`), which had the fatal flaw
// that adding a document reshuffled which model was "today" for everyone.
//
// Why a string and not a Timestamp: a Timestamp is an absolute instant, so
// 2026-09-12T00:00:00Z is 05:45 in Asia/Kathmandu — the test would appear nearly
// six hours late. A date KEY has no timezone, so "the 12th" means the user's own
// 12th, and comparisons are plain lexicographic string compares.
//
// The "today" key comes from serverNow(), i.e. the device clock corrected by the
// skew Firestore's response headers reveal, so winding the phone clock forward
// does not unlock a future model.
//
// Each model document carries its own EXAM CONFIG, not just questions:
//   • perQuestionTimeSeconds — the countdown shown on every question; when it
//     hits zero the quiz auto-advances.
//   • negativeMarking / negativeMarkPercent — when marking is on, a wrong answer
//     costs `marksPerQuestion * negativeMarkPercent` (0.2 → 20%).
//   • marksPerQuestion / passPercent — used for the score + pass-fail verdict.
//   • rules[] — the point-by-point list shown in the pre-start Rules popup. The
//     seed writes these already resolved from the config above (so the popup can
//     say "Negative Marking 20% (0.2)" without recomputing), and
//     buildDailyTestRules() regenerates them for any model that has none.
//   • isPro / subscriptionType / price — Free vs Premium gating.
//
// Results are saved per-user in `users/{uid}/daily_test_results` so the summary
// can be reopened and each model can be enforced as once-per-user.
import {
  runQuery,
  createDocument,
  commitWrites,
  setWrite,
  serverTimestamp,
  serverNow,
  type WriteSpec,
} from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';

/** Overall difficulty of a model — drives the coloured badge on its card. */
export type DailyTestCategory = 'easy' | 'medium' | 'hard';

/** Mirrors the `subscriptionType` field written to Firestore for premium models. */
export type DailyTestSubscriptionType = 'on' | 'off';

export interface DailyTestQuestion {
  /** Difficulty/label shown on the question ("Easy", "Medium", "Hard"). */
  category: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  /** Per-question countdown in seconds. 0 → fall back to the model default. */
  timeSeconds: number;
  /** Marks awarded for a correct answer. 0 → fall back to the model default. */
  marks: number;
}

export interface DailyTestModel {
  id: string;
  name: string;
  modelName: string;
  courseId: string;
  subcourseId: string;
  /**
   * RELEASE DATE as a local calendar key, "YYYY-MM-DD". The model is hidden until
   * this date and becomes playable at 12:00 AM on it. Empty string only if the
   * document has no date and no createdAt to fall back on — such a model is
   * treated as unscheduled and never shown.
   */
  testDate: string;
  questions: DailyTestQuestion[];
  /** Overall difficulty: easy | medium | hard. */
  category: DailyTestCategory;
  /** Default countdown per question, in seconds. */
  perQuestionTimeSeconds: number;
  /** Whether wrong answers are penalised. */
  negativeMarking: boolean;
  /** Fraction of a question's marks lost per wrong answer (0.2 = 20%). */
  negativeMarkPercent: number;
  /** Marks awarded per correct answer. */
  marksPerQuestion: number;
  /** Percentage needed to pass. */
  passPercent: number;
  /** Point-by-point rules shown before the test starts. */
  rules: string[];
  isPro: boolean;
  /** 'on' for premium models (subscription required), 'off' for free ones. */
  subscriptionType: DailyTestSubscriptionType;
  price: number;
  active: boolean;
  order: number;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface DailyTestResult {
  id: string;
  modelId: string;
  modelName: string;
  courseId: string;
  subcourseId: string;
  score: number;
  totalQuestions: number;
  correct: number;
  incorrect: number;
  skipped: number;
  timeTakenSeconds: number;
  /** User's chosen option index per question; -1 = skipped. */
  answers: number[];
  createdAt: unknown;
}

/** Defaults applied to any model document that predates the enriched schema. */
export const DAILY_TEST_DEFAULTS = {
  perQuestionTimeSeconds: 30,
  negativeMarkPercent: 0.2,
  marksPerQuestion: 1,
  passPercent: 40,
  category: 'medium' as DailyTestCategory,
};

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asCategory(value: unknown): DailyTestCategory {
  const raw = asString(value).toLowerCase();
  if (raw === 'easy' || raw === 'medium' || raw === 'hard') return raw;
  return DAILY_TEST_DEFAULTS.category;
}

// ---------- Date keys ----------
//
// A "date key" is a local calendar day written as "YYYY-MM-DD". Keys sort and
// compare as plain strings (`a < b` is chronological), which is why every date
// decision in this feature is a string compare rather than Date arithmetic —
// no timezone can shift a key, and no DST transition can make a day 23h long.

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Formats a Date as its LOCAL calendar key, e.g. "2026-09-12". */
export function localDateKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/**
 * Today's key according to the best clock we have. serverNow() is the device
 * clock corrected by the skew seen in Firestore's response headers, so a user who
 * sets their phone to next week does NOT unlock next week's test.
 */
export function todayDateKey(): string {
  return localDateKey(serverNow());
}

/** Parses a key back into a local midnight Date. Manual parse — `new Date("2026-09-12")` would be UTC. */
export function dateFromKey(key: string): Date | null {
  if (!DATE_KEY_RE.test(key)) return null;
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Whole days from `from` to `to` (negative if `to` is earlier). 0 when either key is invalid. */
export function daysBetweenKeys(from: string, to: string): number {
  const a = dateFromKey(from);
  const b = dateFromKey(to);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** The key `days` after `key` (accepts negatives). Returns `key` unchanged if it is invalid. */
export function addDaysToKey(key: string, days: number): string {
  const base = dateFromKey(key);
  if (!base) return key;
  base.setDate(base.getDate() + days);
  return localDateKey(base);
}

/**
 * Reads a release date off a raw document. Accepts the `testDate` string, an
 * older `scheduledFor` field, or a Firestore timestamp in either — and finally
 * falls back to `createdAt`, so documents written before scheduling existed
 * behave as "released on the day they were created" rather than vanishing.
 */
function dateKeyFromRaw(value: unknown): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (DATE_KEY_RE.test(trimmed)) return trimmed;
    // A full ISO string ("2026-09-12T00:00:00.000Z") — keep the date part only.
    if (trimmed.length >= 10 && DATE_KEY_RE.test(trimmed.slice(0, 10))) return trimmed.slice(0, 10);
    return '';
  }
  if (value instanceof Date) return localDateKey(value);
  const ts = value as { toDate?: () => Date } | null;
  if (ts && typeof ts.toDate === 'function') {
    try {
      return localDateKey(ts.toDate());
    } catch {
      return '';
    }
  }
  return '';
}

/** "Sat, 12 Sep" — the compact form used on cards and chips. */
export function formatDateKeyShort(key: string): string {
  const date = dateFromKey(key);
  if (!date) return key;
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "Saturday, 12 September 2026" — the long form used in the empty-state card. */
export function formatDateKeyLong(key: string): string {
  const date = dateFromKey(key);
  if (!date) return key;
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Human label for a date relative to today: "Today", "Tomorrow", "Yesterday",
 * "in 3 days", "5 days ago", else the short date. Used on the upcoming/missed
 * cards so the user never has to work out how far away a test is.
 */
export function relativeDayLabel(key: string, today: string = todayDateKey()): string {
  if (!DATE_KEY_RE.test(key)) return '';
  const diff = daysBetweenKeys(today, key);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff <= 6) return `in ${diff} days`;
  if (diff < -1 && diff >= -6) return `${Math.abs(diff)} days ago`;
  return formatDateKeyShort(key);
}

function questionFromRaw(raw: unknown): DailyTestQuestion {
  const q = (raw ?? {}) as Record<string, unknown>;
  const options = Array.isArray(q.options) ? q.options.map((o) => String(o)) : [];
  return {
    category: asString(q.category, 'Medium'),
    question: asString(q.question),
    options,
    correctIndex: asNumber(q.correctIndex, 0),
    explanation: asString(q.explanation),
    timeSeconds: asNumber(q.timeSeconds),
    marks: asNumber(q.marks),
  };
}

function modelFromDocument(doc: Record<string, unknown>, id: string): DailyTestModel {
  const rawQuestions = Array.isArray(doc.questions) ? doc.questions : [];
  const isPro = doc.isPro === true;
  const rawRules = Array.isArray(doc.rules) ? doc.rules.map((r) => String(r)).filter(Boolean) : [];
  // Release date, most explicit source first. `createdAt` is the last resort so a
  // pre-scheduling document counts as released on its creation day instead of
  // disappearing from the app entirely.
  const testDate =
    dateKeyFromRaw(doc.testDate) ||
    dateKeyFromRaw(doc.scheduledFor) ||
    dateKeyFromRaw(doc.createdAt);
  return {
    id,
    name: asString(doc.name),
    modelName: asString(doc.modelName, asString(doc.name)),
    courseId: asString(doc.courseId),
    subcourseId: asString(doc.subcourseId),
    testDate,
    questions: rawQuestions.map(questionFromRaw),
    category: asCategory(doc.category),
    perQuestionTimeSeconds: asNumber(
      doc.perQuestionTimeSeconds,
      DAILY_TEST_DEFAULTS.perQuestionTimeSeconds,
    ),
    negativeMarking: doc.negativeMarking === true,
    negativeMarkPercent: asNumber(
      doc.negativeMarkPercent,
      DAILY_TEST_DEFAULTS.negativeMarkPercent,
    ),
    marksPerQuestion: asNumber(doc.marksPerQuestion, DAILY_TEST_DEFAULTS.marksPerQuestion),
    passPercent: asNumber(doc.passPercent, DAILY_TEST_DEFAULTS.passPercent),
    rules: rawRules,
    isPro,
    subscriptionType: asString(doc.subscriptionType) === 'on' || isPro ? 'on' : 'off',
    price: asNumber(doc.price),
    active: doc.active !== false,
    order: asNumber(doc.order),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/**
 * Fetches every active Daily Test model for the enrolled subcourse. One query
 * filtered by `subcourseId` only — `active` is filtered client-side so a
 * single-field index is enough. Sorted by release date, then by `order` so two
 * models released on the same day keep a stable, author-chosen sequence.
 */
export async function fetchDailyTestModels(subcourseId: string): Promise<DailyTestModel[]> {
  if (!subcourseId) return [];
  const rows = await runQuery(Collections.dailyTestModels, {
    where: [{ field: 'subcourseId', op: '==', value: subcourseId }],
  });
  return rows
    .map((row) => modelFromDocument(row, String(row.id ?? '')))
    .filter((m) => m.active && m.questions.length > 0)
    .sort((a, b) => (a.testDate === b.testDate ? a.order - b.order : a.testDate < b.testDate ? -1 : 1));
}

// ---------- Release scheduling ----------

/** True once the model's release date has arrived (or passed). */
export function isReleased(model: DailyTestModel, today: string = todayDateKey()): boolean {
  return !!model.testDate && model.testDate <= today;
}

/**
 * Every model scheduled for exactly this date, in `order`. Two models sharing a
 * date both come back — the carousel then shows "Test 1 of 2" / "Test 2 of 2".
 */
export function modelsForDate(models: DailyTestModel[], dateKey: string): DailyTestModel[] {
  if (!dateKey) return [];
  return models.filter((m) => m.testDate === dateKey).sort((a, b) => a.order - b.order);
}

/** Everything already unlocked, newest release first. */
export function releasedModels(
  models: DailyTestModel[],
  today: string = todayDateKey(),
): DailyTestModel[] {
  return models
    .filter((m) => isReleased(m, today))
    .sort((a, b) => (a.testDate === b.testDate ? b.order - a.order : a.testDate < b.testDate ? 1 : -1));
}

/** Everything still locked, soonest release first. */
export function upcomingModels(
  models: DailyTestModel[],
  today: string = todayDateKey(),
): DailyTestModel[] {
  return models
    .filter((m) => !!m.testDate && m.testDate > today)
    .sort((a, b) => (a.testDate === b.testDate ? a.order - b.order : a.testDate < b.testDate ? -1 : 1));
}

/** The next date on which anything is scheduled, or null when nothing is queued. */
export function nextScheduledDate(
  models: DailyTestModel[],
  today: string = todayDateKey(),
): string | null {
  const next = upcomingModels(models, today)[0];
  return next ? next.testDate : null;
}

/**
 * Released models the user never attempted, most recent first — the "Missed"
 * slides. `completedIds` is the set of model ids this ACCOUNT has a saved result
 * for; today's own models are excluded because they are still playable.
 */
export function missedModels(
  models: DailyTestModel[],
  completedIds: Set<string> | Record<string, unknown>,
  today: string = todayDateKey(),
): DailyTestModel[] {
  const done = (id: string) =>
    completedIds instanceof Set ? completedIds.has(id) : !!completedIds[id];
  return models
    .filter((m) => !!m.testDate && m.testDate < today && !done(m.id))
    .sort((a, b) => (a.testDate === b.testDate ? b.order - a.order : a.testDate < b.testDate ? 1 : -1));
}

/** Milliseconds until the next local midnight — used to schedule the auto-rollover. */
export function msUntilNextLocalMidnight(date: Date = new Date()): number {
  const next = new Date(date);
  next.setHours(24, 0, 0, 0);
  return next.getTime() - date.getTime();
}

// ---------- Demo "upcoming" placeholder ----------

/** Marks the placeholder card so screens never try to open or score it. */
export const DEMO_UPCOMING_MODEL_ID = '__demo-upcoming';

/**
 * A stand-in for the "Upcoming" slot in subcourses that genuinely have nothing
 * scheduled ahead, so the strip still shows what comes next instead of a gap.
 *
 * It is deliberately NOT labelled a sample. The user's point is that a learner
 * should not be told "this card is fake" — from their side a new set really is
 * coming, so the card reads like any other upcoming test ("<Subcourse> New Set",
 * unlocking on its date) and simply cannot be opened yet.
 *
 * `subcourseName` names it after the course the learner is actually studying,
 * e.g. "Civil Sub Engineer 5th level New Set"; without one it falls back to a
 * neutral title rather than printing an empty prefix.
 */
export function buildDemoUpcomingModel(
  courseId: string,
  subcourseId: string,
  dateKey: string = addDaysToKey(todayDateKey(), 1),
  subcourseName?: string,
): DailyTestModel {
  const title = subcourseName?.trim() ? `${subcourseName.trim()} New Set` : 'New Set';
  return {
    id: DEMO_UPCOMING_MODEL_ID,
    name: title,
    modelName: title,
    courseId,
    subcourseId,
    testDate: dateKey,
    // Deliberately EMPTY: nothing here is playable, and an empty question list
    // means every guard in the app (`questions.length > 0`) already refuses it
    // even if a stray navigation ever got through. The card renders its own
    // placeholder chips instead of counting these.
    questions: [],
    category: DAILY_TEST_DEFAULTS.category,
    perQuestionTimeSeconds: DAILY_TEST_DEFAULTS.perQuestionTimeSeconds,
    negativeMarking: false,
    negativeMarkPercent: DAILY_TEST_DEFAULTS.negativeMarkPercent,
    marksPerQuestion: DAILY_TEST_DEFAULTS.marksPerQuestion,
    passPercent: DAILY_TEST_DEFAULTS.passPercent,
    rules: [],
    isPro: false,
    subscriptionType: 'off',
    price: 0,
    active: true,
    order: 9_999,
    createdAt: null,
    updatedAt: null,
  };
}

/** True for the placeholder above — screens use it to refuse navigation. */
export function isDemoModel(model: DailyTestModel | null | undefined): boolean {
  return !!model && model.id === DEMO_UPCOMING_MODEL_ID;
}

/** Countdown for a single question — its own value, else the model default. */
export function questionTimeSeconds(model: DailyTestModel, index: number): number {
  const own = model.questions[index]?.timeSeconds ?? 0;
  if (own > 0) return own;
  return model.perQuestionTimeSeconds > 0
    ? model.perQuestionTimeSeconds
    : DAILY_TEST_DEFAULTS.perQuestionTimeSeconds;
}

/** Total time budget for the whole model, in seconds. */
export function totalTestSeconds(model: DailyTestModel): number {
  return model.questions.reduce((sum, _q, i) => sum + questionTimeSeconds(model, i), 0);
}

/** "1m 30s" / "45s" — shared by every Daily Test screen. */
export function formatDailyTestDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

/**
 * Saves a completed Daily Test attempt to the user's private history and returns
 * the new document id. The summary screen reads back from params, but persisting
 * lets us enforce once-per-user and rebuild history later.
 */
export async function saveDailyTestResult(
  uid: string,
  result: Omit<DailyTestResult, 'id' | 'createdAt'>,
): Promise<string> {
  const { id } = await createDocument(Collections.dailyTestResults(uid), {
    ...result,
    createdAt: serverTimestamp(),
  });
  return id;
}

/** Shared row → DailyTestResult mapper for the single- and multi-doc reads. */
function resultFromRow(row: Record<string, unknown>): DailyTestResult {
  return {
    id: String(row.id ?? ''),
    modelId: asString(row.modelId),
    modelName: asString(row.modelName),
    courseId: asString(row.courseId),
    subcourseId: asString(row.subcourseId),
    score: asNumber(row.score),
    totalQuestions: asNumber(row.totalQuestions),
    correct: asNumber(row.correct),
    incorrect: asNumber(row.incorrect),
    skipped: asNumber(row.skipped),
    timeTakenSeconds: asNumber(row.timeTakenSeconds),
    answers: Array.isArray(row.answers) ? row.answers.map((a) => asNumber(a, -1)) : [],
    createdAt: row.createdAt,
  };
}

/**
 * Returns the saved result for a model if this user has already completed it,
 * else null. A single direct read scoped to the user's own subcollection.
 *
 * This is the ONLY source of truth for "already attempted" — the device-local
 * history is just a convenience feed, so a user who signs in on a second phone
 * still cannot re-attempt a model they have finished.
 */
export async function fetchDailyTestResultForModel(
  uid: string,
  modelId: string,
): Promise<DailyTestResult | null> {
  const rows = await runQuery(Collections.dailyTestResults(uid), {
    where: [{ field: 'modelId', op: '==', value: modelId }],
    limit: 1,
  });
  if (rows.length === 0) return null;
  return resultFromRow(rows[0]);
}

/**
 * The user's most recent saved attempts, newest first. One query, so the landing
 * screen can resolve "which of these models are already done" (and re-open the
 * last one) on any device, from the account rather than from local storage.
 */
export async function fetchDailyTestResults(
  uid: string,
  max = 25,
): Promise<DailyTestResult[]> {
  const rows = await runQuery(Collections.dailyTestResults(uid), {
    orderBy: [{ field: 'createdAt', direction: 'desc' }],
    limit: max,
  });
  return rows.map(resultFromRow);
}

export interface DailyTestScore {
  correct: number;
  incorrect: number;
  skipped: number;
  /** Marks won from correct answers. */
  marksEarned: number;
  /** Marks lost to negative marking (a positive number). */
  marksLost: number;
  /** marksEarned − marksLost, never below zero. */
  netMarks: number;
  /** Maximum obtainable marks. */
  totalMarks: number;
  /** netMarks / totalMarks as a rounded percentage — this is the saved score. */
  percent: number;
  /** correct / totalQuestions as a rounded percentage (ignores the penalty). */
  accuracy: number;
  passed: boolean;
}

/** Everything scoring needs — lets callers pass a model straight through. */
export type DailyTestScoreConfig = Pick<
  DailyTestModel,
  'questions' | 'negativeMarking' | 'negativeMarkPercent' | 'marksPerQuestion' | 'passPercent'
>;

/**
 * Scores an attempt against the model's own config. Negative marking, when the
 * model has it on, deducts `marksPerQuestion * negativeMarkPercent` for every
 * wrong answer — skipped questions are never penalised.
 */
export function scoreDailyTest(model: DailyTestScoreConfig, answers: number[]): DailyTestScore {
  const questions = model.questions ?? [];
  const perQuestion =
    model.marksPerQuestion > 0 ? model.marksPerQuestion : DAILY_TEST_DEFAULTS.marksPerQuestion;
  const penaltyRate = model.negativeMarking
    ? Math.max(0, model.negativeMarkPercent || DAILY_TEST_DEFAULTS.negativeMarkPercent)
    : 0;

  let correct = 0;
  let incorrect = 0;
  let skipped = 0;

  questions.forEach((q, i) => {
    const a = answers[i];
    if (a === undefined || a === -1) skipped += 1;
    else if (a === q.correctIndex) correct += 1;
    else incorrect += 1;
  });

  const totalMarks = questions.length * perQuestion;
  const marksEarned = correct * perQuestion;
  const marksLost = Math.round(incorrect * perQuestion * penaltyRate * 100) / 100;
  const netMarks = Math.max(0, Math.round((marksEarned - marksLost) * 100) / 100);
  const percent = totalMarks > 0 ? Math.round((netMarks / totalMarks) * 100) : 0;
  const accuracy = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;
  const passPercent = model.passPercent > 0 ? model.passPercent : DAILY_TEST_DEFAULTS.passPercent;

  return {
    correct,
    incorrect,
    skipped,
    marksEarned,
    marksLost,
    netMarks,
    totalMarks,
    percent,
    accuracy,
    passed: percent >= passPercent,
  };
}

// ---------- Rules ----------

interface RuleConfig {
  modelName: string;
  questionCount: number;
  category: DailyTestCategory;
  perQuestionTimeSeconds: number;
  totalSeconds: number;
  negativeMarking: boolean;
  negativeMarkPercent: number;
  marksPerQuestion: number;
  passPercent: number;
  isPro: boolean;
}

const CATEGORY_LABEL: Record<DailyTestCategory, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

/**
 * Builds the point-by-point rule list from a model's config. The seed stores the
 * result on each document (so the popup renders straight from Firestore), and
 * the app calls this again as a fallback for any model without rules.
 */
function composeRules(cfg: RuleConfig): string[] {
  const perQuestionMark = cfg.marksPerQuestion;
  const penaltyMarks = Math.round(perQuestionMark * cfg.negativeMarkPercent * 100) / 100;
  const percentLabel = `${Math.round(cfg.negativeMarkPercent * 100)}% (${cfg.negativeMarkPercent})`;

  return [
    `This test has ${cfg.questionCount} question${cfg.questionCount === 1 ? '' : 's'} and must be finished in one sitting.`,
    `Difficulty level of this model is ${CATEGORY_LABEL[cfg.category]}.`,
    `Every question has its own timer of ${cfg.perQuestionTimeSeconds} seconds.`,
    `Total time for the whole test is about ${formatDailyTestDuration(cfg.totalSeconds)}.`,
    'When a question timer runs out the app moves to the next question automatically — the timer blinks for the last 5 seconds as a warning.',
    `Each correct answer awards ${perQuestionMark} mark${perQuestionMark === 1 ? '' : 's'}.`,
    cfg.negativeMarking
      ? `Negative Marking is ON — ${percentLabel} of the marks is deducted for every wrong answer, so a wrong answer costs ${penaltyMarks} mark${penaltyMarks === 1 ? '' : 's'}.`
      : 'Negative Marking is OFF — a wrong answer does not reduce your marks.',
    'Skipped questions carry no marks and no penalty.',
    'Only one option can be selected per question. Tap the selected option again to clear it.',
    'You cannot go back to a previous question, so read carefully before moving on.',
    'Each model can be attempted only ONCE — the result is saved to your account, so it stays completed even if you sign in on another phone.',
    `You need ${cfg.passPercent}% or more to pass this test.`,
    'Leaving the test before you submit will discard the whole attempt.',
    cfg.isPro
      ? 'This is a Premium model — an active subscription is required to attempt it.'
      : 'This model is Free for every enrolled user.',
    'Your score and a full answer review are available immediately after you submit.',
  ];
}

/** Rules for a model — its own stored list, else generated from its config. */
export function buildDailyTestRules(model: DailyTestModel): string[] {
  if (model.rules.length > 0) return model.rules;
  return composeRules({
    modelName: model.modelName || model.name,
    questionCount: model.questions.length,
    category: model.category,
    perQuestionTimeSeconds:
      model.perQuestionTimeSeconds > 0
        ? model.perQuestionTimeSeconds
        : DAILY_TEST_DEFAULTS.perQuestionTimeSeconds,
    totalSeconds: totalTestSeconds(model),
    negativeMarking: model.negativeMarking,
    negativeMarkPercent: model.negativeMarkPercent || DAILY_TEST_DEFAULTS.negativeMarkPercent,
    marksPerQuestion:
      model.marksPerQuestion > 0 ? model.marksPerQuestion : DAILY_TEST_DEFAULTS.marksPerQuestion,
    passPercent: model.passPercent > 0 ? model.passPercent : DAILY_TEST_DEFAULTS.passPercent,
    isPro: model.isPro,
  });
}

// ---------- Seeding (admin-only, re-runnable) ----------

type SeedQuestion = Omit<DailyTestQuestion, 'timeSeconds' | 'marks'> & {
  timeSeconds?: number;
  marks?: number;
};

// Three question sets, one per seeded model. Deterministic content so the whole
// flow (timer, negative marking, rules, review) is testable end-to-end.
const SEED_SET_EASY: SeedQuestion[] = [
  {
    category: 'Easy',
    question: 'Which test is commonly used to determine the compressive strength of concrete?',
    options: ['Slump test', 'Compression test', 'Impact test', 'Tensile test'],
    correctIndex: 1,
    explanation:
      'The compression test is used to determine the compressive strength of concrete, which is one of its most important properties.',
  },
  {
    category: 'Easy',
    question: 'In surveying, which instrument is primarily used to measure horizontal and vertical angles?',
    options: ['Level', 'Plane table', 'Theodolite', 'Measuring tape'],
    correctIndex: 2,
    explanation:
      'A theodolite is a surveying instrument used mainly for accurately measuring horizontal and vertical angles.',
  },
  {
    category: 'Easy',
    question: 'The SI unit of electric current is:',
    options: ['Volt', 'Ampere', 'Ohm', 'Watt'],
    correctIndex: 1,
    explanation:
      'The ampere (A) is the SI base unit of electric current. Volt measures potential difference, ohm resistance and watt power.',
  },
  {
    category: 'Easy',
    question: 'Which of the following is a renewable source of energy?',
    options: ['Coal', 'Diesel', 'Hydropower', 'Natural gas'],
    correctIndex: 2,
    explanation:
      'Hydropower is renewable because it uses the continuously replenished flow of water. Coal, diesel and natural gas are fossil fuels.',
  },
  {
    category: 'Easy',
    question: 'One hectare is equal to how many square metres?',
    options: ['1,000', '10,000', '100,000', '1,000,000'],
    correctIndex: 1,
    explanation: 'One hectare is 100 m × 100 m = 10,000 square metres.',
  },
];

const SEED_SET_MEDIUM: SeedQuestion[] = [
  {
    category: 'Medium',
    question:
      'For a simply supported beam carrying a uniformly distributed load over its entire span, where does the maximum bending moment occur?',
    options: [
      'At either support',
      'At one-quarter of the span',
      'At the centre of the span',
      'At three-quarters of the span',
    ],
    correctIndex: 2,
    explanation:
      'For a simply supported beam with a uniformly distributed load over the full span, the maximum bending moment occurs at mid-span, where the shear force becomes zero.',
  },
  {
    category: 'Medium',
    question: 'The slump test on fresh concrete measures its:',
    options: ['Durability', 'Workability', 'Compressive strength', 'Permeability'],
    correctIndex: 1,
    explanation:
      'The slump test is a field measure of the workability (consistency) of fresh concrete, not of its hardened strength.',
  },
  {
    category: 'Medium',
    question: 'In a levelling operation, the difference between a back sight and a fore sight gives the:',
    options: ['Reduced level', 'Rise or fall', 'Height of instrument', 'Bench mark value'],
    correctIndex: 1,
    explanation:
      'Back sight minus fore sight gives the rise (positive) or fall (negative) between the two points, which is then applied to the known reduced level.',
  },
  {
    category: 'Medium',
    question: 'Three resistors of 3 Ω each are connected in parallel. The equivalent resistance is:',
    options: ['1 Ω', '3 Ω', '9 Ω', '0.33 Ω'],
    correctIndex: 0,
    explanation:
      'For n equal resistors in parallel the equivalent resistance is R/n, so 3 Ω / 3 = 1 Ω.',
  },
  {
    category: 'Medium',
    question: 'If a number is increased by 25% and then decreased by 20%, the net change is:',
    options: ['No change', '5% increase', '5% decrease', '10% increase'],
    correctIndex: 0,
    explanation:
      'Taking 100 → +25% gives 125 → −20% of 125 gives 100. The two changes cancel exactly, so there is no net change.',
  },
];

const SEED_SET_HARD: SeedQuestion[] = [
  {
    category: 'Hard',
    question:
      'The minimum grade of concrete recommended for reinforced concrete work exposed to moderate conditions as per IS 456:2000 is:',
    options: ['M15', 'M20', 'M25', 'M30'],
    correctIndex: 2,
    explanation:
      'IS 456:2000 prescribes a minimum grade of M25 for reinforced concrete under moderate exposure conditions to ensure adequate durability.',
  },
  {
    category: 'Hard',
    question:
      'In a closed traverse the sum of the interior angles of a five-sided figure should equal:',
    options: ['360°', '540°', '720°', '900°'],
    correctIndex: 1,
    explanation:
      'The sum of interior angles of an n-sided closed traverse is (n − 2) × 180°. For n = 5 that is 3 × 180° = 540°.',
  },
  {
    category: 'Hard',
    question:
      'The critical depth in an open channel flow occurs when the Froude number is:',
    options: ['Less than 1', 'Equal to 1', 'Greater than 1', 'Equal to zero'],
    correctIndex: 1,
    explanation:
      'Critical flow is defined by a Froude number of exactly 1. Below 1 the flow is subcritical, above 1 it is supercritical.',
  },
  {
    category: 'Hard',
    question:
      'In a three-phase star-connected balanced system, the relation between line voltage and phase voltage is:',
    options: ['V_L = V_ph', 'V_L = √3 · V_ph', 'V_L = V_ph / √3', 'V_L = 3 · V_ph'],
    correctIndex: 1,
    explanation:
      'In a star (Y) connection the line voltage is √3 times the phase voltage, while the line current equals the phase current.',
  },
  {
    category: 'Hard',
    question:
      'The slenderness ratio of a column is the ratio of its effective length to its:',
    options: [
      'Cross-sectional area',
      'Least lateral dimension or least radius of gyration',
      'Moment of inertia',
      'Section modulus',
    ],
    correctIndex: 1,
    explanation:
      'Slenderness ratio = effective length / least radius of gyration (or least lateral dimension for the simplified check). A higher ratio means a greater tendency to buckle.',
  },
];

// Tomorrow's set — mixed difficulty, so the model that unlocks at midnight looks
// and feels different from today's three rather than repeating them.
const SEED_SET_MIXED: SeedQuestion[] = [
  {
    category: 'Easy',
    question: 'Which body is responsible for conducting the civil service examination in Nepal?',
    options: [
      'Ministry of Education',
      'Public Service Commission',
      'National Planning Commission',
      'Department of Urban Development',
    ],
    correctIndex: 1,
    explanation:
      'The Public Service Commission (Lok Sewa Aayog) is the constitutional body that conducts examinations for appointments to the civil service in Nepal.',
  },
  {
    category: 'Medium',
    question: 'The bearing capacity of a soil is usually improved by:',
    options: [
      'Increasing the water content',
      'Compaction',
      'Loosening the top layer',
      'Adding organic matter',
    ],
    correctIndex: 1,
    explanation:
      'Compaction reduces the void ratio and increases the density of the soil, which raises its shear strength and hence its bearing capacity.',
  },
  {
    category: 'Medium',
    question: 'A contour line on a map joins points of equal:',
    options: ['Slope', 'Elevation', 'Distance', 'Temperature'],
    correctIndex: 1,
    explanation:
      'A contour is a line joining points of equal elevation above a datum. Closely spaced contours indicate steep ground.',
  },
  {
    category: 'Medium',
    question: 'The power consumed by a 5 ohm resistor carrying a current of 2 A is:',
    options: ['10 W', '20 W', '2.5 W', '40 W'],
    correctIndex: 1,
    explanation: 'P = I squared times R = 2 x 2 x 5 = 20 W.',
  },
  {
    category: 'Hard',
    question:
      'In Rankine theory, the coefficient of ACTIVE earth pressure for a cohesionless soil with angle of internal friction phi is:',
    options: [
      '(1 - sin phi) / (1 + sin phi)',
      '(1 + sin phi) / (1 - sin phi)',
      'tan squared (45 + phi/2)',
      '1 - sin phi',
    ],
    correctIndex: 0,
    explanation:
      'Ka = (1 - sin phi) / (1 + sin phi), which equals tan squared (45 - phi/2). The reciprocal expression is the PASSIVE coefficient Kp.',
  },
];

interface SeedModelSpec {
  suffix: string;
  order: number;
  modelName: string;
  /**
   * Days from the seeding day to this model's release date. 0 = available the
   * moment the seed runs; 1 = unlocks at 12:00 AM tomorrow, which is what makes
   * the "Upcoming" card show real data instead of the demo placeholder.
   */
  dayOffset: number;
  category: DailyTestCategory;
  perQuestionTimeSeconds: number;
  negativeMarking: boolean;
  negativeMarkPercent: number;
  marksPerQuestion: number;
  passPercent: number;
  isPro: boolean;
  price: number;
  questions: SeedQuestion[];
}

const SEED_MODELS: SeedModelSpec[] = [
  {
    suffix: 'model-1',
    order: 1,
    modelName: 'Model 1 — Warm Up',
    dayOffset: 0,
    category: 'easy',
    perQuestionTimeSeconds: 30,
    negativeMarking: false,
    negativeMarkPercent: 0.2,
    marksPerQuestion: 1,
    passPercent: 40,
    isPro: false,
    price: 0,
    questions: SEED_SET_EASY,
  },
  {
    suffix: 'model-2',
    order: 2,
    modelName: 'Model 2 — Daily Drill',
    dayOffset: 0,
    category: 'medium',
    perQuestionTimeSeconds: 45,
    negativeMarking: true,
    negativeMarkPercent: 0.2,
    marksPerQuestion: 1,
    passPercent: 40,
    isPro: false,
    price: 0,
    questions: SEED_SET_MEDIUM,
  },
  {
    suffix: 'model-3',
    order: 3,
    modelName: 'Model 3 — Challenger',
    dayOffset: 0,
    category: 'hard',
    perQuestionTimeSeconds: 60,
    negativeMarking: true,
    negativeMarkPercent: 0.2,
    marksPerQuestion: 1,
    passPercent: 50,
    isPro: true,
    price: 199,
    questions: SEED_SET_HARD,
  },
  {
    // Dated TOMORROW on purpose: it proves the release schedule end to end. It is
    // invisible today except as the "Upcoming" card (showing its real name and
    // config), and it unlocks by itself at local midnight with no new deploy,
    // no push and no extra read.
    suffix: 'model-4',
    order: 4,
    modelName: "Model 4 — Tomorrow's Mixed Set",
    dayOffset: 1,
    category: 'medium',
    perQuestionTimeSeconds: 40,
    negativeMarking: true,
    negativeMarkPercent: 0.25,
    marksPerQuestion: 1,
    passPercent: 45,
    isPro: false,
    price: 0,
    questions: SEED_SET_MIXED,
  },
];

// Every course → its subcourses, matching the seedCourseData ids in courses.ts.
const SUBCOURSES: { courseId: string; subcourseId: string }[] = [
  { courseId: 'civil-engineering', subcourseId: 'civil-assistant-sub-engineer' },
  { courseId: 'civil-engineering', subcourseId: 'civil-sub-engineer' },
  { courseId: 'civil-engineering', subcourseId: 'civil-engineering-7th' },
  { courseId: 'geometric-engineering', subcourseId: 'amin' },
  { courseId: 'geometric-engineering', subcourseId: 'surveyor' },
  { courseId: 'geometric-engineering', subcourseId: 'geometric-engineering-7th' },
  { courseId: 'electrical-engineering', subcourseId: 'electrical-assistant-engineer' },
  { courseId: 'electrical-engineering', subcourseId: 'sub-electrical-engineer' },
  { courseId: 'electrical-engineering', subcourseId: 'electrical-engineering-7th' },
];

function buildSeedQuestions(spec: SeedModelSpec): DailyTestQuestion[] {
  return spec.questions.map((q) => ({
    category: q.category,
    question: q.question,
    options: q.options,
    correctIndex: q.correctIndex,
    explanation: q.explanation,
    timeSeconds: q.timeSeconds ?? spec.perQuestionTimeSeconds,
    marks: q.marks ?? spec.marksPerQuestion,
  }));
}

/**
 * Seeds FOUR enriched Daily Test models into every subcourse: three released for
 * today and one dated TOMORROW, so the release schedule can be seen working
 * (today's cards playable, tomorrow's shown as a real locked "Upcoming" card that
 * unlocks by itself at 12:00 AM).
 *
 * Deterministic doc ids (`{subcourseId}__model-N`) with merge OFF, so a re-run
 * fully REPLACES the older, thinner seed documents instead of leaving stale
 * fields behind — safe to press more than once, and the UI limits it to admins.
 *
 * Every document is written with EVERY field the app reads, none omitted:
 * identity (name, modelName, courseId, subcourseId), schedule (testDate,
 * releaseDayOffset), content (questions with per-question time + marks), exam
 * config (per-question time, total time, negative marking + percent, marks per
 * question, total marks, pass percent), the resolved rules[], gating (isPro,
 * subscriptionType, price) and bookkeeping (active, order, isSeed, timestamps).
 * A missing field would silently fall back to a default, which is exactly the
 * ambiguity the explicit write avoids.
 *
 * Returns the number of models written.
 */
export async function seedDailyTestModels(): Promise<number> {
  const writes: WriteSpec[] = [];
  // One base day for the whole run, so all nine subcourses agree on what "today"
  // and "tomorrow" mean even if the loop crosses midnight mid-commit.
  const baseDay = todayDateKey();

  for (const entry of SUBCOURSES) {
    for (const spec of SEED_MODELS) {
      const questions = buildSeedQuestions(spec);
      const totalSeconds = questions.reduce(
        (sum, q) => sum + (q.timeSeconds || spec.perQuestionTimeSeconds),
        0,
      );
      const testDate = addDaysToKey(baseDay, spec.dayOffset);
      const rules = composeRules({
        modelName: spec.modelName,
        questionCount: questions.length,
        category: spec.category,
        perQuestionTimeSeconds: spec.perQuestionTimeSeconds,
        totalSeconds,
        negativeMarking: spec.negativeMarking,
        negativeMarkPercent: spec.negativeMarkPercent,
        marksPerQuestion: spec.marksPerQuestion,
        passPercent: spec.passPercent,
        isPro: spec.isPro,
      });

      writes.push(
        setWrite(
          `${Collections.dailyTestModels}/${entry.subcourseId}__${spec.suffix}`,
          {
            // --- identity ---
            name: `Daily Test ${spec.modelName}`,
            modelName: spec.modelName,
            courseId: entry.courseId,
            subcourseId: entry.subcourseId,
            // --- schedule ---
            // The local calendar day this model unlocks on. A plain string, never
            // a Timestamp: "2026-09-12" means the user's own 12th, whereas a
            // Timestamp at UTC midnight would arrive 5h45m late in Kathmandu.
            testDate,
            releaseDayOffset: spec.dayOffset,
            // --- content ---
            questions,
            questionCount: questions.length,
            // --- exam config ---
            category: spec.category,
            perQuestionTimeSeconds: spec.perQuestionTimeSeconds,
            totalTimeSeconds: totalSeconds,
            negativeMarking: spec.negativeMarking,
            negativeMarkPercent: spec.negativeMarkPercent,
            marksPerQuestion: spec.marksPerQuestion,
            totalMarks: questions.length * spec.marksPerQuestion,
            passPercent: spec.passPercent,
            rules,
            // --- gating ---
            isPro: spec.isPro,
            subscriptionType: spec.isPro ? 'on' : 'off',
            price: spec.price,
            // --- bookkeeping ---
            active: true,
            order: spec.order,
            isSeed: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: false },
        ),
      );
    }
  }

  // Committed in small chunks rather than one giant atomic batch: each document
  // embeds its full question array, so a single commit for every subcourse would
  // be a needlessly large request.
  const CHUNK = 6;
  for (let i = 0; i < writes.length; i += CHUNK) {
    await commitWrites(writes.slice(i, i + CHUNK));
  }
  return writes.length;
}
