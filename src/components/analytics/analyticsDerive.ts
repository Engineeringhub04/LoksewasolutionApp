// Everything that sits between a stored snapshot and what a chart actually draws.
//
// Deliberately free of React, of the theme and of the chart components. The maths
// here is the part most likely to be quietly wrong — deltas across days with no
// snapshot, scales that one backfilled lump would flatten, accuracy read as a
// level rather than summed like a total — so it has to be runnable and checkable
// on its own.
//
// ===== The one rule that governs this whole file =====
// SEEDED DAYS HAVE NO PER-DAY MEANING. The backfill attributes every untimed
// source (practice, reading, GK/PM, study time) as a single lump to the earliest
// reconstructed day, because that is the only honest answer to "when did this
// happen?" — we do not know. Their CUMULATIVE values are trustworthy and are what
// the trend line plots; their DELTAS are an artefact. So every window total and
// every chart scale in this file is computed from observed days only.
import {
  addDayKey,
  effortOf,
  type AnalyticsSeriesPoint,
  type DayBucket,
} from '@/src/core/services/analyticsSnapshot';
import {
  PERCENT_WEIGHTS,
  POINTS,
  READING_TARGET_UNITS,
  TIME_POINTS_CAP,
  TIME_POINTS_PER_HOUR,
  percentOf,
  timePoints,
} from '@/src/core/services/scoring';
import { niceMax } from '@/src/components/charts/chartMath';
import type {
  MainLeaderboardBreakdown,
  MainLeaderboardRow,
} from '@/src/core/services/mainLeaderboard';

// ---------- sources ----------

export type AnalyticsSourceKey = 'exam' | 'dailyTest' | 'practice' | 'qotd' | 'gkPm' | 'reading';

/**
 * Canonical order. The radar plots its axes in this order and the donut lays out
 * its arcs in it, so keeping one array as the source of truth is what stops two
 * sections of the same page disagreeing about which colour means what.
 */
export const ANALYTICS_SOURCES: AnalyticsSourceKey[] = [
  'exam',
  'dailyTest',
  'practice',
  'qotd',
  'gkPm',
  'reading',
];

export interface AnalyticsSourceMeta {
  /**
   * A fixed hue, not a theme token. A legend colour has to mean the same thing
   * in light and dark, and all six have to stay apart from one another; the
   * theme palette offers neither guarantee.
   */
  color: string;
  /** i18n key under `analytics.sources`. */
  labelKey: string;
}

export const SOURCE_META: Record<AnalyticsSourceKey, AnalyticsSourceMeta> = {
  exam: { color: '#6366F1', labelKey: 'analytics.sources.exam' },
  dailyTest: { color: '#0EA5E9', labelKey: 'analytics.sources.dailyTest' },
  practice: { color: '#10B981', labelKey: 'analytics.sources.practice' },
  qotd: { color: '#F59E0B', labelKey: 'analytics.sources.qotd' },
  gkPm: { color: '#A855F7', labelKey: 'analytics.sources.gkPm' },
  reading: { color: '#14B8A6', labelKey: 'analytics.sources.reading' },
};

/**
 * Where a "go practise this" button sends the user.
 *
 * Practice and reading point at the SUBJECT LIST rather than
 * `/subjects/practice` and `/subjects/read`: those two screens require
 * courseId, subcourseId, subjectId, chapterId and unitId params, and pushing
 * them bare lands the user on a broken screen. The subject list is the real
 * entry point to both flows.
 */
export const SOURCE_ROUTES: Record<AnalyticsSourceKey, string> = {
  exam: '/(tabs)/exam',
  dailyTest: '/daily-test',
  practice: '/subjects',
  qotd: '/question-of-the-day',
  gkPm: '/additional-features/gk',
  reading: '/subjects',
};

/**
 * How well the user is doing at one source, 0..100.
 *
 * Reading has no right or wrong answer, so its "accuracy" is coverage against the
 * nominal target — the same substitution the leaderboard percent already makes,
 * reused here so the radar cannot disagree with the score it sits under.
 */
export function sourceAccuracy(bucket: DayBucket, key: AnalyticsSourceKey): number {
  switch (key) {
    case 'exam':
      return clampPercent(bucket.ep);
    case 'dailyTest':
      return clampPercent(bucket.dp);
    case 'practice':
      return clampPercent(percentOf(bucket.tc, bucket.ta));
    case 'qotd':
      return clampPercent(percentOf(bucket.qc, bucket.qa));
    case 'gkPm':
      return clampPercent(percentOf(bucket.gc, bucket.ga));
    case 'reading':
      return clampPercent(percentOf(bucket.rd, READING_TARGET_UNITS));
    default:
      return 0;
  }
}

/** Attempts (or covered units, for reading) recorded in one bucket. */
export function sourceVolume(bucket: DayBucket, key: AnalyticsSourceKey): number {
  switch (key) {
    case 'exam':
      return bucket.ea;
    case 'dailyTest':
      return bucket.da;
    case 'practice':
      return bucket.ta;
    case 'qotd':
      return bucket.qa;
    case 'gkPm':
      return bucket.ga;
    case 'reading':
      return bucket.rd;
    default:
      return 0;
  }
}

export interface SourceStat {
  key: AnalyticsSourceKey;
  color: string;
  /** 0..100, read off the newest snapshot — accuracy is a level, not a total. */
  accuracy: number;
  /** Attempts inside the selected window, from observed days only. */
  volume: number;
  /** Lifetime attempts, which is what decides "never touched". */
  lifetimeVolume: number;
  /** False when the user has never used this source at all. */
  touched: boolean;
}

/**
 * One row per source: current accuracy, volume in the window, lifetime volume.
 *
 * A source at zero because it was never opened and a source at zero because the
 * user keeps getting it wrong are completely different messages, which is why
 * `touched` is carried separately rather than inferred from the number.
 */
export function buildSourceStats(points: AnalyticsSeriesPoint[]): SourceStat[] {
  const latest = latestBucket(points);
  const observed = points.filter((point) => !point.seeded);

  return ANALYTICS_SOURCES.map((key) => {
    const lifetimeVolume = latest ? sourceVolume(latest, key) : 0;
    let volume = 0;
    for (const point of observed) volume += sourceVolume(point.delta, key);

    return {
      key,
      color: SOURCE_META[key].color,
      accuracy: latest ? sourceAccuracy(latest, key) : 0,
      volume,
      lifetimeVolume,
      touched: lifetimeVolume > 0,
    };
  });
}

// ---------- window summary ----------

export interface RangeSummary {
  /** Seconds of app time recorded inside the window. */
  studySeconds: number;
  /** Questions answered plus units covered inside the window. */
  activities: number;
  /** Points earned inside the window. */
  pointsEarned: number;
  /** Days inside the window that carry real work. */
  activeDays: number;
  /** Latest weighted accuracy, 0..100. A level: read, never summed. */
  accuracy: number;
  /** Accuracy on the first observed day of the window; null with nothing to compare. */
  accuracyStart: number | null;
  /** How many of the window's days were actually recorded rather than carried forward. */
  observedDays: number;
  /** Lifetime figures, read off the newest snapshot. */
  totalStudySeconds: number;
  totalPoints: number;
  totalActivities: number;
}

const EMPTY_SUMMARY: RangeSummary = {
  studySeconds: 0,
  activities: 0,
  pointsEarned: 0,
  activeDays: 0,
  accuracy: 0,
  accuracyStart: null,
  observedDays: 0,
  totalStudySeconds: 0,
  totalPoints: 0,
  totalActivities: 0,
};

export function summarise(points: AnalyticsSeriesPoint[]): RangeSummary {
  if (!points.length) return { ...EMPTY_SUMMARY };

  const observed = points.filter((point) => !point.seeded);
  const latest = latestBucket(points);

  let studySeconds = 0;
  let activities = 0;
  let pointsEarned = 0;
  let activeDays = 0;
  let observedDays = 0;

  for (const point of observed) {
    if (point.observed) observedDays += 1;
    studySeconds += point.delta.s;
    pointsEarned += point.delta.p;
    const effort = effortOf(point);
    activities += effort;
    if (effort > 0) activeDays += 1;
  }

  // Compared against the first OBSERVED day, not the first day of the window:
  // an estimate makes a poor baseline for "how much did I improve".
  const firstObserved = observed.find((point) => point.observed);
  const accuracyStart =
    firstObserved && observedDays > 1 ? firstObserved.cumulative.pc : null;

  return {
    studySeconds,
    activities,
    pointsEarned,
    activeDays,
    accuracy: latest ? clampPercent(latest.pc) : 0,
    accuracyStart,
    observedDays,
    totalStudySeconds: latest ? latest.s : 0,
    totalPoints: latest ? latest.p : 0,
    totalActivities: latest ? totalActivitiesOf(latest) : 0,
  };
}

/**
 * Relative change, as a percentage.
 *
 * Returns null rather than Infinity or 100 when there is no baseline: "you did
 * 40 minutes last week and 40 this week" is a real comparison, "you did nothing
 * last week" is not, and dressing the second up as +100% would be a lie the user
 * would reasonably act on.
 */
export function percentChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

// ---------- series → chart input ----------

/** Pulls one number per day out of the series. */
export function seriesValues(
  points: AnalyticsSeriesPoint[],
  pick: (point: AnalyticsSeriesPoint) => number,
): number[] {
  return points.map(pick);
}

/**
 * How many days at the START of the window are reconstructed.
 *
 * Charts draw exactly this many leading points dashed and dimmed. Counting only
 * the leading run (rather than every seeded day anywhere) is what lets a chart
 * split into two paths instead of needing per-point styling.
 */
export function leadingSeededCount(points: AnalyticsSeriesPoint[]): number {
  let count = 0;
  for (const point of points) {
    if (!point.seeded) break;
    count += 1;
  }
  return count;
}

/**
 * A y-axis ceiling that the backfill lump cannot blow out.
 *
 * The first seeded day absorbs every untimed source at once, so including it
 * would scale a 90-day chart to a spike that is not a real day's work and press
 * every genuine bar flat against the axis.
 */
export function chartMaxFor(
  points: AnalyticsSeriesPoint[],
  pick: (point: AnalyticsSeriesPoint) => number,
  minimum = 1,
): number {
  const observed = points.filter((point) => !point.seeded);
  const source = observed.length ? observed : points;
  let max = 0;
  for (const point of source) {
    const value = pick(point);
    if (Number.isFinite(value) && value > max) max = value;
  }
  return niceMax(Math.max(max, minimum));
}

/** Indices of Friday and Saturday — Nepal's weekend — for the effort chart tint. */
export function weekendIndices(points: AnalyticsSeriesPoint[]): number[] {
  const indices: number[] = [];
  points.forEach((point, index) => {
    const weekday = weekdayOfKey(point.key);
    if (weekday === 5 || weekday === 6) indices.push(index);
  });
  return indices;
}

// ---------- §8 points breakdown ----------

/** Neutral greys: neither is a learning source, and both must stay off the six hues. */
const TIME_COLOR = '#64748B';
const BONUS_COLOR = '#94A3B8';

export type PointsRowKey = AnalyticsSourceKey | 'time' | 'bonus';

export interface PointsRow {
  key: PointsRowKey;
  color: string;
  labelKey: string;
  points: number;
  /** Share of the total, 0..100. */
  share: number;
}

export interface PointsBreakdown {
  rows: PointsRow[];
  total: number;
  /** True when the exam row had to be inferred rather than summed exactly. */
  estimated: boolean;
}

const POINTS_META: Record<PointsRowKey, { color: string; labelKey: string }> = {
  ...SOURCE_META,
  time: { color: TIME_COLOR, labelKey: 'analytics.sources.time' },
  bonus: { color: BONUS_COLOR, labelKey: 'analytics.sources.bonus' },
};

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * Where the PTS total actually came from, using the leaderboard's own constants.
 *
 * The point of this section is to stop the score being a magic number, so it has
 * to reconcile: the rows are made to add up to the total the hero shows rather
 * than to a figure only this card believes in.
 *
 * Accuracy of each row, honestly:
 * - qotd, practice, gkPm, time — EXACT from the stored breakdown.
 * - dailyTest — EXACT. Its `averagePercent` is the mean over every attempt, and
 *   points were `attempts × 6 + Σscore × 0.5`, so `attempts × average × 0.5`
 *   reproduces Σscore exactly.
 * - reading — an UNDER-estimate. Read-mode completion bonuses were awarded per
 *   completed record and the count of those records is not stored.
 * - exam — an UPPER bound. Points accrued per attempt (`attempts × 10 + Σscore`)
 *   but the snapshot only keeps the average of each set's BEST attempt, so Σscore
 *   is unrecoverable. It is exact when every set was attempted once, and too high
 *   when a set was retried.
 *
 * Since exam is the only row that can overshoot, any excess over the real total
 * is subtracted from exam alone — never spread across rows that are already
 * right — and floored at the attempt points, which are certain. Whatever is left
 * under the total becomes the "bonus" row, which is where the unrecorded reading
 * bonuses genuinely belong.
 */
export function pointsBreakdown(
  breakdown: MainLeaderboardBreakdown | null,
  totalPoints: number,
): PointsBreakdown {
  if (!breakdown) return { rows: [], total: 0, estimated: false };

  const qotd =
    num(breakdown.qotd?.attempts) * POINTS.qotdAttempt +
    num(breakdown.qotd?.correct) * POINTS.qotdCorrect;

  const examAttempts = num(breakdown.exam?.attempts);
  const examFloor = examAttempts * POINTS.examAttempt;
  let exam =
    examFloor +
    examAttempts * clampPercent(breakdown.exam?.averagePercent) * POINTS.examPerScorePoint;

  const dailyAttempts = num(breakdown.dailyTest?.attempts);
  const dailyTest =
    dailyAttempts * POINTS.dailyTestAttempt +
    dailyAttempts *
      clampPercent(breakdown.dailyTest?.averagePercent) *
      POINTS.dailyTestPerScorePoint;

  const practice =
    num(breakdown.practice?.attempted) * POINTS.practiceAttempt +
    num(breakdown.practice?.correct) * POINTS.practiceCorrect +
    num(breakdown.practice?.chaptersCompleted) * POINTS.completionBonus;

  const gkPm =
    num(breakdown.gkPm?.attempted) * POINTS.gkPmAttempt +
    num(breakdown.gkPm?.correct) * POINTS.gkPmCorrect;

  const reading =
    num(breakdown.reading?.questionsRead) * POINTS.readViewed +
    num(breakdown.reading?.theoryCompleted) * POINTS.theoryCompleted +
    num(breakdown.reading?.constitutionParts) * POINTS.constitutionRead;

  const time = timePoints(num(breakdown.usage?.foregroundSeconds));

  const total = Math.max(0, Math.round(totalPoints));
  const sumOf = () => qotd + exam + dailyTest + practice + gkPm + reading + time;

  if (total > 0 && sumOf() > total) {
    exam = Math.max(examFloor, exam - (sumOf() - total));
  }

  const values: Record<PointsRowKey, number> = {
    exam,
    dailyTest,
    practice,
    qotd,
    gkPm,
    reading,
    time,
    bonus: total > 0 ? Math.max(0, total - sumOf()) : 0,
  };

  const denominator = total > 0 ? total : sumOf();
  const rows = (Object.keys(values) as PointsRowKey[])
    // Sub-point slivers are noise, and a row reading "0 PTS" invites the
    // question of why it is there at all.
    .filter((key) => values[key] >= 1)
    .map((key) => ({
      key,
      color: POINTS_META[key].color,
      labelKey: POINTS_META[key].labelKey,
      points: Math.round(values[key]),
      share: denominator > 0 ? (values[key] / denominator) * 100 : 0,
    }))
    .sort((a, b) => b.points - a.points);

  return { rows, total: denominator, estimated: examAttempts > 0 };
}

// ---------- §11 strengths & focus ----------

export interface Insight {
  source: AnalyticsSourceKey;
  color: string;
  labelKey: string;
  accuracy: number;
  route: string;
  /** Weight this source carries inside the overall percentage. */
  weight: number;
}

export interface Insights {
  /** Best-performing touched source, or null when nothing has been touched. */
  strength: Insight | null;
  /**
   * What to work on next. An untouched high-weight source outranks a weak one:
   * a source at zero because it was never opened is a bigger, easier win than a
   * source the user is already practising and getting 55% on.
   */
  focus: Insight | null;
  /** True when `focus` is untouched rather than merely weak. */
  focusUntouched: boolean;
}

/** Below this, an accuracy figure is noise rather than a verdict. */
const MEANINGFUL_SAMPLE = 5;

export function deriveInsights(stats: SourceStat[]): Insights {
  const toInsight = (stat: SourceStat): Insight => ({
    source: stat.key,
    color: stat.color,
    labelKey: SOURCE_META[stat.key].labelKey,
    accuracy: stat.accuracy,
    route: SOURCE_ROUTES[stat.key],
    weight: PERCENT_WEIGHTS[stat.key],
  });

  const touched = stats.filter((stat) => stat.touched);
  const strength = touched.length
    ? toInsight(
        touched.reduce((best, stat) =>
          stat.accuracy > best.accuracy ||
          (stat.accuracy === best.accuracy && PERCENT_WEIGHTS[stat.key] > PERCENT_WEIGHTS[best.key])
            ? stat
            : best,
        ),
      )
    : null;

  // Untouched first, heaviest weight wins — that is the largest movement in the
  // overall percentage available for the least work.
  const untouched = stats.filter((stat) => !stat.touched);
  if (untouched.length) {
    const pick = untouched.reduce((best, stat) =>
      PERCENT_WEIGHTS[stat.key] > PERCENT_WEIGHTS[best.key] ? stat : best,
    );
    return { strength, focus: toInsight(pick), focusUntouched: true };
  }

  // Otherwise the weakest source with enough attempts to mean something. Reading
  // is excluded: it is coverage, not accuracy, so "you are bad at reading" would
  // be a category error.
  const weak = stats.filter(
    (stat) => stat.key !== 'reading' && stat.lifetimeVolume >= MEANINGFUL_SAMPLE,
  );
  if (!weak.length) return { strength, focus: null, focusUntouched: false };

  const worst = weak.reduce((low, stat) => (stat.accuracy < low.accuracy ? stat : low));
  // Nothing to fix — do not manufacture a weakness out of a strong all-round run.
  if (strength && worst.key === strength.source) {
    return { strength, focus: null, focusUntouched: false };
  }
  return { strength, focus: toInsight(worst), focusUntouched: false };
}

// ---------- §12 consistency ----------

export interface WeekDot {
  key: string;
  weekday: number;
  activities: number;
  /** A snapshot exists for this day; false means we simply do not know. */
  recorded: boolean;
  today: boolean;
}

/** The trailing seven days ending today, oldest first. */
export function weekStrip(points: AnalyticsSeriesPoint[], todayKey: string): WeekDot[] {
  const byKey = new Map(points.map((point) => [point.key, point]));
  const dots: WeekDot[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const key = addDayKey(todayKey, -offset);
    const point = byKey.get(key);
    dots.push({
      key,
      weekday: weekdayOfKey(key),
      // A seeded day's delta is a backfill artefact, so it contributes nothing.
      activities: point && !point.seeded ? effortOf(point) : 0,
      recorded: !!point?.observed,
      today: offset === 0,
    });
  }
  return dots;
}

export interface WeekdayLoad {
  weekday: number;
  activities: number;
}

/**
 * The weekday the user actually gets work done on.
 *
 * Seeded days are skipped outright — the backfill dumps everything untimed onto
 * one reconstructed date, which would crown whichever weekday that happened to
 * fall on and be completely meaningless.
 */
export function bestWeekday(points: AnalyticsSeriesPoint[]): WeekdayLoad | null {
  const totals = [0, 0, 0, 0, 0, 0, 0];
  let any = false;

  for (const point of points) {
    if (point.seeded) continue;
    const effort = effortOf(point);
    if (effort <= 0) continue;
    totals[weekdayOfKey(point.key)] += effort;
    any = true;
  }
  if (!any) return null;

  let best = 0;
  for (let index = 1; index < 7; index += 1) {
    if (totals[index] > totals[best]) best = index;
  }
  return { weekday: best, activities: totals[best] };
}

// ---------- §13 cohort ----------

export interface CohortFacts {
  /** 1-based, or null when the user has no published row yet. */
  rank: number | null;
  /** How many people are in this subcourse's board. */
  size: number;
  /** "Top N%" — smaller is better. Null without a rank. */
  topPercent: number | null;
  medianPercent: number;
  medianPoints: number;
  /** The board leader's points — the axis every marker is placed against. */
  topPoints: number;
  /** Where the user sits, 0..100 across the board's points range. */
  position: number | null;
  myPoints: number;
  myPercent: number;
  /** Points needed to pass the person directly above; null at the top. */
  pointsToNext: number | null;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * The user's standing in their subcourse, from an already-sorted board.
 *
 * `fetchMainLeaderboard` returns rows in ranking order, so position is the index
 * — recomputing the comparison here would risk this section and the leaderboard
 * screen disagreeing about who is ahead.
 */
export function cohortFacts(rows: MainLeaderboardRow[], uid: string): CohortFacts {
  const size = rows.length;
  const index = uid ? rows.findIndex((row) => row.uid === uid) : -1;
  const me = index >= 0 ? rows[index] : null;

  const points = rows.map((row) => row.points);
  const best = points.length ? Math.max(...points) : 0;

  return {
    rank: index >= 0 ? index + 1 : null,
    size,
    topPercent: index >= 0 && size > 0 ? Math.max(1, Math.round(((index + 1) / size) * 100)) : null,
    medianPercent: median(rows.map((row) => row.percent)),
    medianPoints: median(points),
    topPoints: best,
    position: me && best > 0 ? clampPercent((me.points / best) * 100) : null,
    myPoints: me?.points ?? 0,
    myPercent: me?.percent ?? 0,
    pointsToNext: index > 0 ? Math.max(0, rows[index - 1].points - rows[index].points) : null,
  };
}

// ---------- §14 milestones ----------

export interface Milestone {
  key: string;
  icon: string;
  color: string;
  current: number;
  target: number;
  /** 0..100. */
  progress: number;
  done: boolean;
  /** Formatted for display; the raw numbers are rarely what should be shown. */
  currentLabel: string;
  targetLabel: string;
}

/** Round numbers a learner recognises, rather than an arbitrary curve. */
const POINTS_TIERS = [100, 250, 500, 1000, 2500, 5000, 10000, 25000];
const STREAK_TARGET = 7;
const ACCURACY_TARGET = 90;
const STUDY_HOURS_TARGET = 50;

function nextTier(value: number): number {
  for (const tier of POINTS_TIERS) if (value < tier) return tier;
  // Past the last named tier, keep going in 25k steps rather than showing a
  // permanently completed bar.
  return Math.ceil((value + 1) / 25000) * 25000;
}

export function buildMilestones(
  totalPoints: number,
  currentStreak: number,
  accuracy: number,
  totalSeconds: number,
  palette: { points: string; streak: string; accuracy: string; time: string },
): Milestone[] {
  const hours = Math.max(0, totalSeconds) / 3600;
  const tier = nextTier(totalPoints);

  const rows: Milestone[] = [
    {
      key: 'points',
      icon: 'trophy',
      color: palette.points,
      current: totalPoints,
      target: tier,
      progress: percentOf(totalPoints, tier),
      done: false,
      currentLabel: String(Math.round(totalPoints)),
      targetLabel: String(tier),
    },
    {
      key: 'streak',
      icon: 'flame',
      color: palette.streak,
      current: currentStreak,
      target: STREAK_TARGET,
      progress: percentOf(currentStreak, STREAK_TARGET),
      done: currentStreak >= STREAK_TARGET,
      currentLabel: String(currentStreak),
      targetLabel: String(STREAK_TARGET),
    },
    {
      key: 'accuracy',
      icon: 'ribbon',
      color: palette.accuracy,
      current: accuracy,
      target: ACCURACY_TARGET,
      progress: percentOf(accuracy, ACCURACY_TARGET),
      done: accuracy >= ACCURACY_TARGET,
      currentLabel: `${Math.round(accuracy)}%`,
      targetLabel: `${ACCURACY_TARGET}%`,
    },
    {
      key: 'hours',
      icon: 'hourglass',
      color: palette.time,
      current: hours,
      target: STUDY_HOURS_TARGET,
      progress: percentOf(hours, STUDY_HOURS_TARGET),
      done: hours >= STUDY_HOURS_TARGET,
      currentLabel: `${Math.floor(hours)}h`,
      targetLabel: `${STUDY_HOURS_TARGET}h`,
    },
  ];

  // Closest to done first: the one a user can actually finish this week is the
  // one worth putting at the top.
  return rows.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return b.progress - a.progress;
  });
}

// ---------- §15 method explainer ----------

export interface WeightRow {
  source: AnalyticsSourceKey;
  labelKey: string;
  color: string;
  weight: number;
  /** Share of the weighting, 0..100 — the number the user can actually act on. */
  share: number;
}

/**
 * The real `PERCENT_WEIGHTS`, rendered as shares.
 *
 * Read straight from the scoring module rather than restated, so the explainer
 * cannot drift away from the formula it claims to describe.
 */
export function weightRows(): WeightRow[] {
  const total = ANALYTICS_SOURCES.reduce((sum, key) => sum + PERCENT_WEIGHTS[key], 0);
  return ANALYTICS_SOURCES.map((key) => ({
    source: key,
    labelKey: SOURCE_META[key].labelKey,
    color: SOURCE_META[key].color,
    weight: PERCENT_WEIGHTS[key],
    share: total > 0 ? (PERCENT_WEIGHTS[key] / total) * 100 : 0,
  })).sort((a, b) => b.weight - a.weight);
}

/** Hours of study after which time stops paying, for the explainer's caveat. */
export const TIME_POINTS_CAP_HOURS = Math.round(TIME_POINTS_CAP / TIME_POINTS_PER_HOUR);

// ---------- time ----------

export interface TimeFacts {
  /** Lifetime foreground seconds. */
  totalSeconds: number;
  /** Lifetime seconds recorded against a tracked learning activity. */
  trackedSeconds: number;
  /** Sessions recorded, for the average-session figure. */
  sessions: number;
}

/**
 * The only time figures the app genuinely measures.
 *
 * There is no per-feature timing anywhere in the data model — `secondsSpent`
 * exists on activity progress records (read, theory, constitution, GK, PM, past
 * questions) and nowhere else, and exams, daily tests and practice record no time
 * at all. So this reports the two totals that are real and does not attempt a
 * per-feature breakdown that would have to be invented.
 */
export function timeFacts(
  breakdown: MainLeaderboardBreakdown | null,
  latest: DayBucket | null,
): TimeFacts {
  const totalSeconds = Math.max(
    latest ? latest.s : 0,
    Math.max(0, Number(breakdown?.usage?.foregroundSeconds) || 0),
  );
  const trackedSeconds = Math.min(
    totalSeconds,
    Math.max(0, Number(breakdown?.reading?.secondsSpent) || 0),
  );
  return {
    totalSeconds,
    trackedSeconds,
    sessions: Math.max(0, Number(breakdown?.usage?.sessionCount) || 0),
  };
}

// ---------- dates ----------

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_NE = ['जन', 'फेब', 'मार्च', 'अप्रिल', 'मे', 'जुन', 'जुलाई', 'अग', 'सेप', 'अक्टो', 'नोभे', 'डिसे'];
const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_NE = ['आइत', 'सोम', 'मंगल', 'बुध', 'बिहि', 'शुक्र', 'शनि'];

export type AnalyticsLanguage = 'en' | 'ne';

/**
 * Weekday of a `YYYY-MM-DD` key, read in UTC.
 *
 * The keys are already Kathmandu calendar days. Re-parsing them in the device's
 * zone would shift every one of them by a day for anyone behind UTC, which would
 * silently misalign the heatmap grid and the weekend tint.
 */
export function weekdayOfKey(key: string): number {
  const time = Date.parse(`${key}T00:00:00Z`);
  return Number.isNaN(time) ? 0 : new Date(time).getUTCDay();
}

function partsOf(key: string): { day: number; month: number; year: number } {
  return {
    year: Number(key.slice(0, 4)),
    month: Number(key.slice(5, 7)),
    day: Number(key.slice(8, 10)),
  };
}

/** Axis label — "14 Sep" / "१४ सेप" is too wide, so the numeral stays Arabic. */
export function dayLabel(key: string, language: AnalyticsLanguage): string {
  const { day, month } = partsOf(key);
  if (!month || month < 1 || month > 12) return key;
  const months = language === 'ne' ? MONTHS_NE : MONTHS_EN;
  return `${day} ${months[month - 1]}`;
}

/** Month name alone, for the heatmap's column headings. */
export function monthLabel(key: string, language: AnalyticsLanguage): string {
  const { month } = partsOf(key);
  if (!month || month < 1 || month > 12) return '';
  return (language === 'ne' ? MONTHS_NE : MONTHS_EN)[month - 1];
}

/** Full date with weekday, for the tapped-day detail pill. */
export function fullDateLabel(key: string, language: AnalyticsLanguage): string {
  const { day, month, year } = partsOf(key);
  if (!month || month < 1 || month > 12) return key;
  const months = language === 'ne' ? MONTHS_NE : MONTHS_EN;
  const weekdays = language === 'ne' ? WEEKDAYS_NE : WEEKDAYS_EN;
  return `${weekdays[weekdayOfKey(key)]}, ${day} ${months[month - 1]} ${year}`;
}

export function weekdayLabels(language: AnalyticsLanguage): string[] {
  return language === 'ne' ? [...WEEKDAYS_NE] : [...WEEKDAYS_EN];
}

export interface RelativeTime {
  /** i18n key under `analytics.footer` — `justNow`, `minutesAgo` or `hoursAgo`. */
  key: string;
  value: number;
}

/**
 * "Updated 2 minutes ago", as a key plus a number rather than a formatted string
 * — the two languages word it differently enough that building the sentence here
 * would mean embedding English grammar in a helper.
 */
export function relativeTime(fetchedAt: number, now: number): RelativeTime {
  const seconds = Math.max(0, Math.floor((now - fetchedAt) / 1000));
  if (seconds < 60) return { key: 'justNow', value: 0 };
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return { key: 'minutesAgo', value: minutes };
  return { key: 'hoursAgo', value: Math.floor(minutes / 60) };
}

// ---------- small shared helpers ----------

export function clampPercent(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, parsed));
}

/** The newest snapshot in the window, which carries the lifetime totals. */
export function latestBucket(points: AnalyticsSeriesPoint[]): DayBucket | null {
  return points.length ? points[points.length - 1].cumulative : null;
}

export function totalActivitiesOf(bucket: DayBucket): number {
  return bucket.qa + bucket.ea + bucket.da + bucket.ta + bucket.ga + bucket.rd;
}
