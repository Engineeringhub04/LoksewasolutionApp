// Scoring constants, shared by everything that turns activity into a number.
//
// These used to live inside services/mainLeaderboard. They moved here the moment
// a second consumer appeared (services/analyticsSnapshot, which reconstructs
// historical points from timestamped attempts): two modules each holding their
// own copy of the points table is exactly how two screens quietly start
// disagreeing about what a user's score is.
//
// It also breaks what would otherwise be a circular import — mainLeaderboard
// imports analyticsSnapshot to record a snapshot after publishing, so
// analyticsSnapshot must not import back into mainLeaderboard for values.
//
// Nothing here touches Firestore or React. Pure numbers and pure functions, so
// both consumers and any test can use them freely.

/** Points awarded per event. Correctness pays more than mere participation. */
export const POINTS = {
  qotdAttempt: 4,
  qotdCorrect: 10,
  examAttempt: 10,
  examPerScorePoint: 1, // × score% → a 70% exam pays 70
  dailyTestAttempt: 6,
  dailyTestPerScorePoint: 0.5,
  practiceAttempt: 2,
  practiceCorrect: 5,
  gkPmAttempt: 2,
  gkPmCorrect: 5,
  readViewed: 1,
  theoryCompleted: 6,
  constitutionRead: 4,
  completionBonus: 8,
} as const;

/**
 * Weight of each source inside the ACCURACY average (breakdown only — see
 * COVERAGE_WEIGHTS below for what the headline percentage now uses). Only
 * sources the user has actually touched are counted, so someone who has only
 * ever done QOTD is scored on their QOTD accuracy rather than diluted toward
 * zero by the six things they have not opened yet.
 */
export const PERCENT_WEIGHTS = {
  exam: 3,
  dailyTest: 2.5,
  practice: 2.5,
  qotd: 2,
  gkPm: 1.5,
  reading: 1, // read mode + theory + constitution: coverage, not accuracy
} as const;

export type PercentSource = keyof typeof PERCENT_WEIGHTS;

// ===========================================================================
// COVERAGE — what the profile ring actually shows
// ===========================================================================
//
// The headline percentage answers "how much of this subcourse's content have I
// worked through?", NOT "how accurate am I?". The two behave very differently
// and the difference is the entire point:
//
//   • Accuracy saturates. Answer ten questions, get eight right, and you sit at
//     80% forever — the number stops moving no matter how much you study, and
//     adding a thousand new questions to the app does not change it at all.
//
//   • Coverage is a fraction of the whole library, so it starts near zero,
//     climbs only as real material is consumed, and — critically — FALLS on its
//     own the moment new content is published, because the denominator grew
//     while the numerator did not. That is the behaviour that was asked for:
//     slow to rise, hard to max out, self-correcting as the app grows.
//
// Every category with content counts toward the average, including ones the
// user has never opened. That is deliberate and is what makes 100% genuinely
// hard: it requires finishing the practice bank AND the theory PDFs AND the
// exam sets AND the rest. A category the app has no content for yet is skipped
// entirely — you cannot have covered a fraction of nothing, and counting it as
// 0% would punish users for a gap in the catalog rather than a gap in effort.

/**
 * Relative importance of each content type inside the coverage average.
 *
 * These are NOT proportional to item counts — that is the whole reason they
 * exist. The practice bank holds thousands of questions while a subcourse may
 * have a few dozen exam sets, so pooling raw item counts would let the largest
 * collection silently become the only thing the ring measures. Weighting by
 * category instead keeps every kind of study visible: theory PDFs are ranked
 * just below practice because reading them is slow, deliberate work that the
 * old accuracy metric could not see at all (it had no right/wrong answer to
 * score, so it contributed nothing).
 */
export const COVERAGE_WEIGHTS = {
  practice: 3,
  theory: 2.5,
  exam: 2,
  gkPm: 1.5,
  read: 1.5,
  dailyTest: 1,
  constitution: 1,
} as const;

export type CoverageSource = keyof typeof COVERAGE_WEIGHTS;

/** How much of each content type exists. Zero/absent means "not counted". */
export type ContentTotals = Record<CoverageSource, number>;

/** How much of each content type this user has covered. */
export type CoverageCounts = Record<CoverageSource, number>;

export const EMPTY_COVERAGE: CoverageCounts = {
  practice: 0,
  theory: 0,
  exam: 0,
  gkPm: 0,
  read: 0,
  dailyTest: 0,
  constitution: 0,
};

/**
 * Stand-in library size used only until the admin site has published a real
 * totals document (see services/contentTotals).
 *
 * A missing denominator must not make the ring read 0% or 100% — both are lies,
 * and the second is unrecoverable. These are deliberately generous round
 * numbers: they keep the metric's shape and its slow-growth feel intact on a
 * fresh install, and the moment real totals arrive the percentage simply
 * re-derives itself against them.
 */
export const FALLBACK_CONTENT_TOTALS: ContentTotals = {
  practice: 4000,
  theory: 150,
  exam: 60,
  gkPm: 1200,
  read: 4000,
  dailyTest: 120,
  constitution: 35,
};

/** Study time → points, capped so presence can never outrank performance. */
export const TIME_POINTS_PER_HOUR = 12;
export const TIME_POINTS_CAP = 240; // ≈20 hours; beyond this, time stops paying

/**
 * Reading has no right or wrong answer, so its "accuracy" is how much material
 * was covered, normalised against this nominal target rather than a real
 * denominator — the total volume of readable content is unknown on the client
 * and querying it would cost more reads than the signal is worth.
 */
export const READING_TARGET_UNITS = 200;

/** Theory chapters and constitution parts are worth more than one revealed question. */
export const READING_UNIT_WEIGHTS = { question: 1, theory: 5, constitution: 5 } as const;

/** Firestore rejects NaN/Infinity, and a corrupt score is worse than a zero. */
export function safeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function round2(value: number): number {
  return Math.round(safeNumber(value) * 100) / 100;
}

/** Clamped 0..100, and 0 rather than NaN when the denominator is empty. */
export function percentOf(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.max(0, Math.min(100, (part / whole) * 100));
}

/** One source's contribution to the weighted percentage. */
export interface PercentPart {
  /** Accuracy or coverage, 0..100. */
  value: number;
  weight: number;
}

/** Weighted mean over only the parts supplied. Empty → 0. */
export function weightedPercent(parts: PercentPart[]): number {
  const totalWeight = parts.reduce((sum, part) => sum + part.weight, 0);
  if (totalWeight <= 0) return 0;
  const weighted = parts.reduce((sum, part) => sum + part.value * part.weight, 0);
  return Math.max(0, Math.min(100, weighted / totalWeight));
}

/** Per-category coverage, for the breakdown and the analytics screen. */
export interface CoverageDetail {
  source: CoverageSource;
  covered: number;
  total: number;
  percent: number;
  weight: number;
}

export interface CoverageResult {
  /** The headline number: weighted coverage of the whole subcourse, 0..100. */
  percent: number;
  /** Every category that had content, so the UI can explain the number. */
  details: CoverageDetail[];
  /** Items covered / items that exist, summed raw across categories. */
  coveredItems: number;
  totalItems: number;
}

/**
 * Coverage of the whole subcourse: a weighted mean of "how much of this content
 * type have you done", across every type the app actually has content for.
 *
 * Categories with a total of zero are skipped rather than scored as 0% — see
 * the COVERAGE_WEIGHTS note above. Each category is individually clamped to
 * 100% first, so a legacy record that somehow counts more items than currently
 * exist (content was deleted after the user studied it) cannot push the overall
 * figure past 100 or drown out the categories around it.
 */
export function computeCoverage(covered: CoverageCounts, totals: ContentTotals): CoverageResult {
  const details: CoverageDetail[] = [];
  let coveredItems = 0;
  let totalItems = 0;

  for (const source of Object.keys(COVERAGE_WEIGHTS) as CoverageSource[]) {
    const total = Math.max(0, Math.floor(safeNumber(totals[source])));
    if (total <= 0) continue; // no content of this kind yet — not the user's gap

    const done = Math.max(0, Math.min(total, Math.floor(safeNumber(covered[source]))));
    coveredItems += done;
    totalItems += total;
    details.push({
      source,
      covered: done,
      total,
      percent: round2(percentOf(done, total)),
      weight: COVERAGE_WEIGHTS[source],
    });
  }

  const percent = weightedPercent(details.map((d) => ({ value: d.percent, weight: d.weight })));
  return { percent, details, coveredItems, totalItems };
}

/**
 * Rounds the ring's number without ever rounding real progress away.
 *
 * Coverage of a large library starts very small, and `Math.round` would show a
 * flat "0%" for the first few hundred questions — the exact moment a learner
 * most needs to see that the number moves. Below 10% this keeps one decimal,
 * and any non-zero progress is floored at 0.1 rather than displayed as nothing.
 */
export function displayCoveragePercent(percent: number): number {
  const value = Math.max(0, Math.min(100, safeNumber(percent)));
  if (value === 0) return 0;
  if (value < 0.1) return 0.1;
  if (value < 10) return Math.round(value * 10) / 10;
  return Math.round(value);
}

/** Reading coverage in the units the percentage is measured in. */
export function readingUnits(questionsRead: number, theoryCompleted: number, constitutionParts: number): number {
  return (
    Math.max(0, questionsRead) * READING_UNIT_WEIGHTS.question +
    Math.max(0, theoryCompleted) * READING_UNIT_WEIGHTS.theory +
    Math.max(0, constitutionParts) * READING_UNIT_WEIGHTS.constitution
  );
}

/** Foreground seconds → the capped points they are worth. */
export function timePoints(foregroundSeconds: number): number {
  return Math.min(TIME_POINTS_CAP, (Math.max(0, foregroundSeconds) / 3600) * TIME_POINTS_PER_HOUR);
}
