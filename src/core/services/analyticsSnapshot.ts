// Analytics snapshots — the per-day history that the rest of the app never kept.
//
// ===== Why this file exists =====
// Every progress record in this app is CUMULATIVE and monotonic. learning_progress
// stores a growing array of attempted question ids; app_activity_progress stores
// growing id arrays per activity; app_usage/summary is a single document of
// ever-increasing counters. None of them record *when* anything happened. Only
// three sources carry a date at all: QOTD (`dateKey`), exam_attempts.createdAt
// and daily_test_results.createdAt.
//
// So "your accuracy over the last 30 days" cannot be queried out of the existing
// data for practice, reading, GK or PM. The information was never written down.
//
// The fix is to write it down from now on, in the cheapest possible shape: one
// document per subcourse holding a `days` map keyed `YYYY-MM-DD` (Kathmandu),
// where each entry is a snapshot of the CUMULATIVE totals on that day.
// Differencing two consecutive days then yields per-day effort, minutes and
// activity for free, and the whole screen renders from a SINGLE document read.
//
// Field keys are two characters (`p`, `pc`, `s`, `a`, `qa`, …) because Firestore
// has no way to append to a map — the entire `days` map is rewritten on every
// snapshot, so its serialized size is paid on every write, every day, forever.
// Over 180 days the short keys save roughly two thirds of the document.
//
// ===== Honesty about backfilled days =====
// On first run we seed history from the three timestamped sources above. Practice,
// reading, GK/PM and study time have no dates, so they are attributed as one lump
// to the earliest seeded day rather than smeared across the period — inventing a
// plausible-looking distribution would make the chart lie. `seededUpTo` marks the
// boundary, and the UI renders those days dashed with a legend note.
//
// The seeding is arranged so the CUMULATIVE curve lands exactly on today's real
// score at the boundary (see buildBackfillDays), which means no artificial jump
// where estimate meets reality. The DELTA charts are the ones that need care:
// the lump makes the first seeded day enormous, so chart scales should be
// computed from non-seeded points when any exist (see `seeded` on each series
// point).
import { getDocument, listDocuments, serverTimestamp, setDocument } from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';
import { getKathmanduDateKey } from '@/src/core/firebase/services/qotd';
import { writeUserStats } from '@/src/core/firebase/services/profile';
import {
  PERCENT_WEIGHTS,
  POINTS,
  READING_TARGET_UNITS,
  percentOf,
  readingUnits,
  round2,
  weightedPercent,
  type PercentPart,
} from '@/src/core/services/scoring';
// Type-only: erased at compile time, so this does NOT create a runtime cycle with
// mainLeaderboard, which imports recordAnalyticsSnapshot from here as a value.
import type { MainLeaderboardBreakdown, MainLeaderboardScore } from '@/src/core/services/mainLeaderboard';

/**
 * How many daily snapshots to keep. Half a year is more history than any chart
 * range offers, and it bounds the document at a size that stays cheap to rewrite.
 */
export const ANALYTICS_MAX_DAYS = 180;

/**
 * One day's snapshot of the cumulative totals. Every field is a running total as
 * of the END of that day, never a per-day amount — per-day amounts are derived
 * by differencing (see buildAnalyticsSeries).
 */
export interface DayBucket {
  /** Points (cumulative effort score). */
  p: number;
  /** Weighted percent at that moment, 0..100. Not cumulative — a snapshot. */
  pc: number;
  /** Foreground seconds in the app. */
  s: number;
  /** Recorded activity count. */
  a: number;
  /** QOTD attempts / correct. */
  qa: number;
  qc: number;
  /** Exam attempts / average of best-per-set percent. */
  ea: number;
  ep: number;
  /** Daily Test attempts / average percent. */
  da: number;
  dp: number;
  /** Practice questions attempted / correct. */
  ta: number;
  tc: number;
  /** GK + PM + past questions attempted / correct. */
  ga: number;
  gc: number;
  /** Reading coverage units (questions read + weighted theory + constitution). */
  rd: number;
}

export const EMPTY_BUCKET: DayBucket = {
  p: 0, pc: 0, s: 0, a: 0,
  qa: 0, qc: 0,
  ea: 0, ep: 0,
  da: 0, dp: 0,
  ta: 0, tc: 0,
  ga: 0, gc: 0,
  rd: 0,
};

const BUCKET_KEYS = Object.keys(EMPTY_BUCKET) as (keyof DayBucket)[];

/** Keys whose per-day delta is meaningful. `pc` is a level, not a total. */
const CUMULATIVE_KEYS = BUCKET_KEYS.filter((key) => key !== 'pc' && key !== 'ep' && key !== 'dp');

export interface AnalyticsStreak {
  current: number;
  best: number;
  /** Last day with real study effort, `YYYY-MM-DD`, or '' if never. */
  lastDay: string;
}

export interface AnalyticsDocument {
  courseId: string;
  subcourseId: string;
  percent: number;
  points: number;
  breakdown: MainLeaderboardBreakdown | null;
  streak: AnalyticsStreak;
  /** Days at or before this key were reconstructed, not observed. '' = none. */
  seededUpTo: string;
  /** Earliest day present in `days`. */
  firstDay: string;
  days: Record<string, DayBucket>;
}

// ---------- date-key arithmetic ----------
//
// Keys are Kathmandu calendar days. All arithmetic happens at UTC midnight so a
// day is always exactly 86_400_000 ms; Nepal has no DST, so the Kathmandu day
// boundary maps cleanly onto this and no offset maths is needed.

const DAY_MS = 86_400_000;
const KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isDayKey(value: unknown): value is string {
  return typeof value === 'string' && KEY_PATTERN.test(value);
}

function keyToUtcMs(key: string): number {
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7));
  const day = Number(key.slice(8, 10));
  return Date.UTC(year, month - 1, day);
}

function utcMsToKey(ms: number): string {
  const date = new Date(ms);
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** `addDayKey('2026-09-14', -3)` → `'2026-09-11'`. */
export function addDayKey(key: string, days: number): string {
  if (!isDayKey(key)) return key;
  return utcMsToKey(keyToUtcMs(key) + days * DAY_MS);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function diffDayKeys(from: string, to: string): number {
  if (!isDayKey(from) || !isDayKey(to)) return 0;
  return Math.round((keyToUtcMs(to) - keyToUtcMs(from)) / DAY_MS);
}

/** Today in Kathmandu — the same boundary QOTD uses, so a streak agrees with it. */
export function analyticsTodayKey(): string {
  return getKathmanduDateKey();
}

// ---------- value coercion ----------

function num(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value ? value : fallback;
}

/**
 * Firestore timestamps come back from the REST client as `{ toDate, toMillis }`,
 * but older documents in this app were written with ISO strings or raw millis,
 * so all three shapes have to be accepted.
 */
function toDateOrNull(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function') {
    try {
      const date = (value as { toDate: () => Date }).toDate();
      return Number.isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Seconds vs milliseconds: anything below ~1e11 cannot be a sane ms epoch.
    return new Date(value < 1e11 ? value * 1000 : value);
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed) : null;
  }
  return null;
}

/** The Kathmandu day a timestamp falls in, or '' when it cannot be read. */
function dayKeyOf(value: unknown): string {
  const date = toDateOrNull(value);
  return date ? getKathmanduDateKey(date) : '';
}

function normaliseBucket(raw: unknown): DayBucket {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_BUCKET };
  const source = raw as Record<string, unknown>;
  const bucket = { ...EMPTY_BUCKET };
  for (const key of BUCKET_KEYS) bucket[key] = num(source[key]);
  return bucket;
}

function roundBucket(bucket: DayBucket): DayBucket {
  return {
    p: Math.max(0, Math.round(bucket.p)),
    pc: round2(bucket.pc),
    s: Math.max(0, Math.round(bucket.s)),
    a: Math.max(0, Math.round(bucket.a)),
    qa: Math.max(0, Math.round(bucket.qa)),
    qc: Math.max(0, Math.round(bucket.qc)),
    ea: Math.max(0, Math.round(bucket.ea)),
    ep: round2(bucket.ep),
    da: Math.max(0, Math.round(bucket.da)),
    dp: round2(bucket.dp),
    ta: Math.max(0, Math.round(bucket.ta)),
    tc: Math.max(0, Math.round(bucket.tc)),
    ga: Math.max(0, Math.round(bucket.ga)),
    gc: Math.max(0, Math.round(bucket.gc)),
    rd: Math.max(0, Math.round(bucket.rd)),
  };
}

/** Today's snapshot, taken straight from a freshly computed score. */
export function bucketFromScore(score: MainLeaderboardScore): DayBucket {
  const b = score.breakdown;
  return roundBucket({
    p: score.points,
    pc: score.percent,
    s: score.usageSeconds,
    a: score.activityCount,
    qa: num(b?.qotd?.attempts),
    qc: num(b?.qotd?.correct),
    ea: num(b?.exam?.attempts),
    ep: num(b?.exam?.averagePercent),
    da: num(b?.dailyTest?.attempts),
    dp: num(b?.dailyTest?.averagePercent),
    ta: num(b?.practice?.attempted),
    tc: num(b?.practice?.correct),
    ga: num(b?.gkPm?.attempted),
    gc: num(b?.gkPm?.correct),
    rd: readingUnits(
      num(b?.reading?.questionsRead),
      num(b?.reading?.theoryCompleted),
      num(b?.reading?.constitutionParts),
    ),
  });
}

/**
 * How many whole tests the user has sat: mock exams plus daily tests.
 *
 * Lives here rather than on the card that shows it so the mirrored
 * `users/{uid}.stats.testsTaken` and the number rendered from a live score can
 * never drift apart. Every group is read optionally — an older breakdown can be
 * missing whole sections, and a zero beats a crash.
 */
export function testsTakenOf(breakdown: MainLeaderboardBreakdown | null | undefined): number {
  return num(breakdown?.exam?.attempts) + num(breakdown?.dailyTest?.attempts);
}

// ---------- streaks ----------
//
// A streak day means the user actually STUDIED something, not merely that the
// app opened. Points alone would not do: study time earns points, so launching
// the app and reading nothing would silently extend a streak.

/** Units of real work done on a day, given the previous observed snapshot. */
function dayEffort(current: DayBucket, previous: DayBucket | null): number {
  const base = previous ?? EMPTY_BUCKET;
  const delta = (key: keyof DayBucket) => Math.max(0, current[key] - base[key]);
  return delta('qa') + delta('ea') + delta('da') + delta('ta') + delta('ga') + delta('rd');
}

/**
 * Current and best streak of consecutive studied days.
 *
 * A missing day means no snapshot was taken, which means the app was not opened,
 * which correctly breaks the streak. Today NOT being studied yet does not break
 * it — the streak is measured from yesterday in that case, so it does not appear
 * to collapse every morning before the user has had a chance to study.
 */
export function computeAnalyticsStreak(days: Record<string, DayBucket>, todayKey: string): AnalyticsStreak {
  const keys = Object.keys(days).filter(isDayKey).sort();
  if (!keys.length) return { current: 0, best: 0, lastDay: '' };

  const studied = new Set<string>();
  let previous: DayBucket | null = null;
  let lastDay = '';
  for (const key of keys) {
    const bucket = days[key];
    if (dayEffort(bucket, previous) > 0) {
      studied.add(key);
      lastDay = key;
    }
    previous = bucket;
  }

  let best = 0;
  let run = 0;
  const firstKey = keys[0];
  const span = Math.max(0, diffDayKeys(firstKey, todayKey));
  for (let offset = 0; offset <= span; offset += 1) {
    if (studied.has(addDayKey(firstKey, offset))) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }

  let cursor = studied.has(todayKey) ? todayKey : addDayKey(todayKey, -1);
  let current = 0;
  while (studied.has(cursor)) {
    current += 1;
    cursor = addDayKey(cursor, -1);
  }

  return { current, best: Math.max(best, current), lastDay };
}

// ---------- backfill ----------

interface BackfillResult {
  days: Record<string, DayBucket>;
  seededUpTo: string;
}

/**
 * Reconstructs history from the only three sources that recorded a date.
 *
 * Untimed work (practice, GK/PM, reading, study time) is added in full to the
 * EARLIEST seeded day. Two consequences, both deliberate:
 *
 *  - the cumulative curve reaches today's real totals by the last seeded day, so
 *    estimate and reality meet without a step;
 *  - the untimed deltas are zero on every later seeded day, which is the honest
 *    answer to "when did this happen?" — we do not know.
 *
 * The percentage uses the untimed sources at their FINAL accuracy throughout the
 * seeded window, consistent with having attributed all of that volume to day one.
 */
async function buildBackfillDays(
  uid: string,
  subcourseId: string,
  todayKey: string,
  score: MainLeaderboardScore,
): Promise<BackfillResult> {
  const [qotdDocs, examDocs, dailyDocs] = await Promise.all([
    listDocuments(`users/${uid}/questionofdata`).catch(() => [] as Record<string, unknown>[]),
    listDocuments(Collections.examAttempts(uid)).catch(() => [] as Record<string, unknown>[]),
    listDocuments(Collections.dailyTestResults(uid)).catch(() => [] as Record<string, unknown>[]),
  ]);

  const belongs = (recordSubcourseId: unknown) => {
    const value = str(recordSubcourseId);
    return !value || value === subcourseId;
  };
  const clampScore = (value: unknown) => Math.max(0, Math.min(100, num(value)));

  interface DayEvents {
    qotdAttempts: number;
    qotdCorrect: number;
    exams: { setId: string; score: number }[];
    dailyScores: number[];
  }
  const byDay = new Map<string, DayEvents>();
  const dayOf = (key: string): DayEvents => {
    let entry = byDay.get(key);
    if (!entry) {
      entry = { qotdAttempts: 0, qotdCorrect: 0, exams: [], dailyScores: [] };
      byDay.set(key, entry);
    }
    return entry;
  };

  for (const doc of qotdDocs) {
    // The same collection holds the rolling 'summary' document, which is not an
    // attempt and carries no dateKey.
    if (str(doc.id) === 'summary') continue;
    if (!belongs(doc.subcourseId)) continue;
    const key = isDayKey(doc.dateKey) ? (doc.dateKey as string) : dayKeyOf(doc.answeredAt);
    if (!isDayKey(key)) continue;
    const entry = dayOf(key);
    entry.qotdAttempts += 1;
    if (doc.isCorrect === true) entry.qotdCorrect += 1;
  }

  for (const doc of examDocs) {
    if (!belongs(doc.subcourseId)) continue;
    const setId = str(doc.examSetId);
    if (!setId) continue;
    const key = dayKeyOf(doc.createdAt) || dayKeyOf(doc.submittedAt);
    if (!isDayKey(key)) continue;
    dayOf(key).exams.push({ setId, score: clampScore(doc.score) });
  }

  for (const doc of dailyDocs) {
    if (!belongs(doc.subcourseId)) continue;
    const key = dayKeyOf(doc.createdAt) || dayKeyOf(doc.submittedAt);
    if (!isDayKey(key)) continue;
    dayOf(key).dailyScores.push(clampScore(doc.score));
  }

  const eventKeys = [...byDay.keys()].filter((key) => key <= todayKey).sort();
  if (!eventKeys.length) {
    // Nothing is dated, so there is nothing to attribute across days. Today's
    // snapshot stands alone and is fully accurate — mark nothing as seeded.
    return { days: { [todayKey]: bucketFromScore(score) }, seededUpTo: '' };
  }

  const breakdown = score.breakdown;
  const finalPractice = {
    attempted: num(breakdown?.practice?.attempted),
    correct: num(breakdown?.practice?.correct),
    percent: num(breakdown?.practice?.percent),
  };
  const finalGkPm = {
    attempted: num(breakdown?.gkPm?.attempted),
    correct: num(breakdown?.gkPm?.correct),
    percent: num(breakdown?.gkPm?.percent),
  };
  const finalReading = readingUnits(
    num(breakdown?.reading?.questionsRead),
    num(breakdown?.reading?.theoryCompleted),
    num(breakdown?.reading?.constitutionParts),
  );

  // Points the three timed sources account for in total. Whatever is left of the
  // real score belongs to untimed work, completion bonuses and study time.
  let timedPointsTotal = 0;
  for (const key of eventKeys) {
    const entry = byDay.get(key)!;
    timedPointsTotal += entry.qotdAttempts * POINTS.qotdAttempt + entry.qotdCorrect * POINTS.qotdCorrect;
    for (const exam of entry.exams) {
      timedPointsTotal += POINTS.examAttempt + exam.score * POINTS.examPerScorePoint;
    }
    for (const value of entry.dailyScores) {
      timedPointsTotal += POINTS.dailyTestAttempt + value * POINTS.dailyTestPerScorePoint;
    }
  }
  const untimedPoints = Math.max(0, score.points - timedPointsTotal);

  const days: Record<string, DayBucket> = {};
  const bestByExamSet = new Map<string, number>();
  let qa = 0;
  let qc = 0;
  let ea = 0;
  let da = 0;
  let dailySum = 0;
  let points = 0;

  eventKeys.forEach((key, index) => {
    const entry = byDay.get(key)!;

    qa += entry.qotdAttempts;
    qc += entry.qotdCorrect;
    points += entry.qotdAttempts * POINTS.qotdAttempt + entry.qotdCorrect * POINTS.qotdCorrect;

    for (const exam of entry.exams) {
      ea += 1;
      points += POINTS.examAttempt + exam.score * POINTS.examPerScorePoint;
      const previousBest = bestByExamSet.get(exam.setId);
      if (previousBest === undefined || exam.score > previousBest) bestByExamSet.set(exam.setId, exam.score);
    }

    for (const value of entry.dailyScores) {
      da += 1;
      dailySum += value;
      points += POINTS.dailyTestAttempt + value * POINTS.dailyTestPerScorePoint;
    }

    // The whole untimed lump lands on the first seeded day (see the doc comment).
    const untimedApplied = index === 0;
    if (untimedApplied) points += untimedPoints;

    const examBests = [...bestByExamSet.values()];
    const ep = examBests.length ? examBests.reduce((sum, value) => sum + value, 0) / examBests.length : 0;
    const dp = da > 0 ? dailySum / da : 0;

    const parts: PercentPart[] = [];
    if (qa > 0) parts.push({ value: percentOf(qc, qa), weight: PERCENT_WEIGHTS.qotd });
    if (ea > 0) parts.push({ value: ep, weight: PERCENT_WEIGHTS.exam });
    if (da > 0) parts.push({ value: dp, weight: PERCENT_WEIGHTS.dailyTest });
    if (finalPractice.attempted > 0) parts.push({ value: finalPractice.percent, weight: PERCENT_WEIGHTS.practice });
    if (finalGkPm.attempted > 0) parts.push({ value: finalGkPm.percent, weight: PERCENT_WEIGHTS.gkPm });
    if (finalReading > 0) {
      parts.push({ value: percentOf(finalReading, READING_TARGET_UNITS), weight: PERCENT_WEIGHTS.reading });
    }

    days[key] = roundBucket({
      p: points,
      pc: weightedPercent(parts),
      s: score.usageSeconds,
      a: score.activityCount,
      qa,
      qc,
      ea,
      ep,
      da,
      dp,
      ta: finalPractice.attempted,
      tc: finalPractice.correct,
      ga: finalGkPm.attempted,
      gc: finalGkPm.correct,
      rd: finalReading,
    });
  });

  // Today is observed, never estimated — overwrite whatever the reconstruction
  // produced for it and mark only the strictly earlier days as seeded.
  days[todayKey] = bucketFromScore(score);
  const seededKeys = eventKeys.filter((key) => key < todayKey);
  return { days, seededUpTo: seededKeys.length ? seededKeys[seededKeys.length - 1] : '' };
}

// ---------- read / write ----------

function parseAnalyticsDocument(raw: Record<string, unknown>, subcourseId: string): AnalyticsDocument {
  const rawDays = (raw.days ?? {}) as Record<string, unknown>;
  const days: Record<string, DayBucket> = {};
  for (const [key, value] of Object.entries(rawDays)) {
    if (!isDayKey(key)) continue;
    days[key] = normaliseBucket(value);
  }
  const sorted = Object.keys(days).sort();
  const streak = (raw.streak ?? {}) as Record<string, unknown>;

  return {
    courseId: str(raw.courseId),
    subcourseId: str(raw.subcourseId, subcourseId),
    percent: num(raw.percent),
    points: num(raw.points),
    breakdown: (raw.breakdown as MainLeaderboardBreakdown | undefined) ?? null,
    streak: {
      current: num(streak.current),
      best: num(streak.best),
      lastDay: str(streak.lastDay),
    },
    seededUpTo: str(raw.seededUpTo),
    firstDay: str(raw.firstDay, sorted[0] ?? ''),
    days,
  };
}

/** Reads the stored analytics document. Returns null when none exists yet. */
export async function fetchAnalyticsDocument(
  uid: string,
  subcourseId: string,
): Promise<AnalyticsDocument | null> {
  if (!uid || !subcourseId) return null;
  try {
    const raw = await getDocument(`${Collections.analytics(uid)}/${subcourseId}`);
    if (!raw) return null;
    return parseAnalyticsDocument(raw, subcourseId);
  } catch {
    return null;
  }
}

/** Light summary of every subcourse the user has analytics for — for the switcher. */
export async function listAnalyticsSubcourses(
  uid: string,
): Promise<{ subcourseId: string; courseId: string; percent: number; points: number }[]> {
  if (!uid) return [];
  try {
    const docs = await listDocuments(Collections.analytics(uid));
    return docs
      .map((doc) => ({
        subcourseId: str(doc.subcourseId, str(doc.id)),
        courseId: str(doc.courseId),
        percent: num(doc.percent),
        points: num(doc.points),
      }))
      .filter((row) => !!row.subcourseId);
  } catch {
    return [];
  }
}

/**
 * Records today's snapshot, seeding history on first run.
 *
 * Never throws. Analytics are a derived convenience; a failure here must not
 * surface anywhere the user can see, and the next app open simply tries again.
 *
 * Note that `days` is rewritten WHOLE rather than merged: the REST client builds
 * `updateMask.fieldPaths` from the top-level keys it is given, so a merge write
 * containing `days` replaces the entire map. That is exactly what this
 * read-modify-write wants, and it is the reason the map is pruned aggressively.
 */
export async function recordAnalyticsSnapshot(
  uid: string,
  score: MainLeaderboardScore,
): Promise<void> {
  const subcourseId = score?.subcourseId;
  if (!uid || !subcourseId) return;

  try {
    const todayKey = analyticsTodayKey();
    const existing = await fetchAnalyticsDocument(uid, subcourseId);

    let days: Record<string, DayBucket>;
    let seededUpTo: string;

    if (existing && Object.keys(existing.days).length > 0) {
      days = { ...existing.days, [todayKey]: bucketFromScore(score) };
      seededUpTo = existing.seededUpTo;
    } else {
      const backfill = await buildBackfillDays(uid, subcourseId, todayKey, score);
      days = backfill.days;
      seededUpTo = backfill.seededUpTo;
    }

    // Prune oldest first. Keeping the newest window is what the charts read, and
    // an unbounded map would grow the write cost of every future snapshot.
    const keys = Object.keys(days).filter(isDayKey).sort();
    const kept = keys.slice(Math.max(0, keys.length - ANALYTICS_MAX_DAYS));
    const prunedDays: Record<string, DayBucket> = {};
    for (const key of kept) prunedDays[key] = days[key];

    const firstDay = kept[0] ?? todayKey;
    // A seed boundary that has been pruned away no longer marks anything.
    if (seededUpTo && seededUpTo < firstDay) seededUpTo = '';

    const streak = computeAnalyticsStreak(prunedDays, todayKey);

    await setDocument(
      `${Collections.analytics(uid)}/${subcourseId}`,
      {
        courseId: score.courseId,
        subcourseId,
        percent: score.percent,
        points: score.points,
        breakdown: score.breakdown,
        streak,
        seededUpTo,
        firstDay,
        days: prunedDays,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    // Mirror three of the four headline numbers onto users/{uid}.stats while we
    // still have them. The Profile card reads that map instead of this document
    // — it is one 180-day map of buckets, and opening a tab should not have to
    // download half a year of history to print a streak. The fourth, `rank`,
    // comes from the Leaderboard screen, which is the only place the board is
    // already in memory.
    await writeUserStats(uid, {
      points: score.points,
      testsTaken: testsTakenOf(score.breakdown),
      streak: streak.current,
    });
  } catch {
    // Swallowed on purpose — see the doc comment above.
  }
}

// ---------- derivation for the charts ----------

export type AnalyticsRange = 7 | 30 | 90 | 'all';

export interface AnalyticsSeriesPoint {
  key: string;
  /** Position in the returned series, 0-based. */
  index: number;
  /** Cumulative totals, carried forward across days with no snapshot. */
  cumulative: DayBucket;
  /** Change since the previous day. Zero on carried-forward days. */
  delta: DayBucket;
  /** True when a snapshot actually exists for this day. */
  observed: boolean;
  /** True when this day was reconstructed rather than observed. */
  seeded: boolean;
}

/**
 * Expands the stored sparse map into one point per calendar day.
 *
 * Days with no snapshot carry the previous cumulative values forward and report
 * a zero delta, which is semantically right: nothing was recorded, so nothing
 * changed. Charts can therefore index straight into this array without having to
 * reason about gaps.
 */
export function buildAnalyticsSeries(
  doc: Pick<AnalyticsDocument, 'days' | 'seededUpTo' | 'firstDay'> | null,
  range: AnalyticsRange,
  todayKey = analyticsTodayKey(),
): AnalyticsSeriesPoint[] {
  if (!doc) return [];
  const keys = Object.keys(doc.days).filter(isDayKey).sort();
  if (!keys.length) return [];

  const earliest = doc.firstDay && isDayKey(doc.firstDay) ? doc.firstDay : keys[0];
  const windowStart = range === 'all' ? earliest : addDayKey(todayKey, -(range - 1));
  const start = windowStart > earliest ? windowStart : earliest;
  const span = diffDayKeys(start, todayKey);
  if (span < 0) return [];

  // Carry-forward must begin from the last snapshot BEFORE the window, or a
  // 7-day view of a long-running account would start from zero and show a
  // fictitious jump on its first observed day.
  let carried: DayBucket = { ...EMPTY_BUCKET };
  for (const key of keys) {
    if (key >= start) break;
    carried = doc.days[key];
  }

  const points: AnalyticsSeriesPoint[] = [];
  let previous = carried;
  for (let offset = 0; offset <= span; offset += 1) {
    const key = addDayKey(start, offset);
    const snapshot = doc.days[key];
    const observed = snapshot !== undefined;
    const cumulative = observed ? snapshot : previous;

    const delta = { ...EMPTY_BUCKET };
    if (observed) {
      for (const field of CUMULATIVE_KEYS) {
        delta[field] = Math.max(0, cumulative[field] - previous[field]);
      }
      // Levels report their movement, which may legitimately be negative.
      delta.pc = round2(cumulative.pc - previous.pc);
      delta.ep = round2(cumulative.ep - previous.ep);
      delta.dp = round2(cumulative.dp - previous.dp);
    }

    points.push({
      key,
      index: offset,
      cumulative,
      delta,
      observed,
      seeded: !!doc.seededUpTo && key <= doc.seededUpTo,
    });
    previous = cumulative;
  }

  return points;
}

/** Sum of one delta field across a series — e.g. questions answered this week. */
export function sumDelta(points: AnalyticsSeriesPoint[], field: keyof DayBucket): number {
  return points.reduce((total, point) => total + point.delta[field], 0);
}

/** Total real work done per day, the number the effort chart plots. */
export function effortOf(point: AnalyticsSeriesPoint): number {
  const d = point.delta;
  return d.qa + d.ea + d.da + d.ta + d.ga + d.rd;
}

/**
 * The same window immediately before the one given, for "vs. previous period"
 * comparisons. Returns an empty array when there is no history to compare with.
 */
export function previousPeriodSeries(
  doc: Pick<AnalyticsDocument, 'days' | 'seededUpTo' | 'firstDay'> | null,
  range: AnalyticsRange,
  todayKey = analyticsTodayKey(),
): AnalyticsSeriesPoint[] {
  if (!doc || range === 'all') return [];
  return buildAnalyticsSeries(doc, range, addDayKey(todayKey, -range));
}
