// Main leaderboard: one score per user per subcourse, aggregated from every
// scored and unscored activity in the app.
//
// ===== Why two documents =====
// Firestore cannot query across per-user subcollections, and the private
// aggregate below is owner-read-only, so a leaderboard can never be built by
// reading other users' data directly. Every publish therefore writes twice:
//
//   users/{uid}/app_mainleaderboard/{subcourseId}  — private, full breakdown
//   app_main_leaderboard/{uid}__{subcourseId}      — public, one ranking row
//
// This is the same pattern app_exam_rankings already uses. The public row is
// deliberately thin: only what the leaderboard list renders, plus the tiebreak
// fields. The public doc id is stable (not auto-generated) so republishing
// overwrites in place instead of piling up a row per refresh.
//
// ===== What a score is =====
// Two numbers, exactly as specified: a percentage and a points total.
//
//   percent — COVERAGE of the subcourse: how much of the content that exists
//             has actually been worked through, weighted across practice,
//             theory, exams, GK/PM, read mode, daily tests and the
//             constitution. It starts near zero, climbs only with real study,
//             and drops on its own when new content is published. It replaced a
//             weighted ACCURACY average, which saturated (ten questions, eight
//             right, 80% forever) and was completely blind to the theory PDFs —
//             reading has no right answer to score, so it contributed nothing.
//             The accuracy figure is still computed and kept as
//             `accuracyPercent`, because "how well am I doing" is a real
//             question, just not the one the ring answers.
//
//   points  — a cumulative EFFORT total. Unlike percent this only ever grows,
//             so consistent daily use is visibly rewarded. Correct answers pay
//             more than attempts; completing something pays a small bonus.
//
// Ranking is by points first, so switching percent's meaning does not reshuffle
// the board — percent only breaks ties between users on identical points.
//
// Study time contributes a small, hard-capped slice of points (see TIME_*),
// because the user asked for time-in-app to count — but capping it keeps the
// board a measure of study rather than of leaving the app open. Raw foreground
// time stays available as the tiebreak, which is where it was asked to matter.
import {
  getDocument,
  listDocuments,
  runQuery,
  serverTimestamp,
  setDocument,
} from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchActivityProgress, type ActivityProgress, type ActivitySource } from '@/src/core/services/activityProgress';
import { fetchAppUsage, flushAppUsage, EMPTY_USAGE, type AppUsageSummary } from '@/src/core/services/appUsage';
import { analyticsTodayKey, recordAnalyticsSnapshot } from '@/src/core/services/analyticsSnapshot';
import { fetchContentTotals } from '@/src/core/services/contentTotals';
import {
  EMPTY_COVERAGE,
  PERCENT_WEIGHTS,
  POINTS,
  READING_TARGET_UNITS,
  computeCoverage,
  percentOf,
  readingUnits,
  round2,
  safeNumber,
  timePoints,
  weightedPercent,
  type CoverageCounts,
  type CoverageDetail,
  type PercentPart,
} from '@/src/core/services/scoring';

export interface MainLeaderboardBreakdown {
  qotd: { attempts: number; correct: number; percent: number };
  exam: { attempts: number; bestPercent: number; averagePercent: number };
  dailyTest: { attempts: number; averagePercent: number };
  practice: { attempted: number; correct: number; percent: number; chaptersCompleted: number };
  gkPm: { attempted: number; correct: number; percent: number };
  reading: { questionsRead: number; theoryCompleted: number; constitutionParts: number; secondsSpent: number };
  usage: { foregroundSeconds: number; sessionCount: number; activityCount: number };
  /**
   * How much of the subcourse's content has been worked through — the source of
   * the headline `percent`. Absent on documents written before coverage
   * existed, so every reader must tolerate undefined.
   */
  coverage?: {
    percent: number;
    coveredItems: number;
    totalItems: number;
    details: CoverageDetail[];
  };
}

export interface MainLeaderboardScore {
  courseId: string;
  subcourseId: string;
  /**
   * COVERAGE of the whole subcourse, 0..100 — how much of the available content
   * this user has actually worked through. Rises slowly, is hard to max out, and
   * falls by itself when new content is published (the denominator grew while
   * the numerator did not). See services/scoring for the reasoning.
   */
  percent: number;
  /**
   * Weighted ACCURACY across the sources the user has touched, 0..100. This is
   * what `percent` used to be; it stayed because it answers a genuinely
   * different question ("how well am I doing on what I have done") and the
   * analytics screen and stats card both surface it.
   */
  accuracyPercent: number;
  /** Cumulative effort points. */
  points: number;
  /** Tiebreak 1 — total foreground seconds. */
  usageSeconds: number;
  /** Tiebreak 2 — number of recorded activities. */
  activityCount: number;
  breakdown: MainLeaderboardBreakdown;
}

/** A row as rendered by the leaderboard screen. */
export interface MainLeaderboardRow {
  id: string;
  uid: string;
  name: string;
  photoURL: string | null;
  /**
   * This person was a premium member when their row was last published — which
   * is what puts the verified tick beside their name.
   *
   * It has to be stored ON the row rather than looked up, because a leaderboard
   * renders other people and nobody may read another user's profile document.
   * Slightly stale by design: it refreshes whenever they next open the app and
   * publish, which is soon enough for a badge.
   */
  isPro: boolean;
  percent: number;
  points: number;
  usageSeconds: number;
  activityCount: number;
}

/**
 * What a publish records about the person, as opposed to their score. Everything
 * here is public — this is exactly what other users will see on the row.
 */
export interface PublicIdentity {
  name: string;
  photoURL: string | null;
  /** Pass `hasActivePremium(profile)`, never the raw `isPremium` flag. */
  isPro: boolean;
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Records written before course scoping existed carry no subcourseId. They are
 * counted toward the subcourse being scored, which is correct for every user
 * except one who has since switched course — a rare case whose only cost is a
 * slightly generous legacy score.
 */
function belongsToSubcourse(recordSubcourseId: string, subcourseId: string): boolean {
  return !recordSubcourseId || recordSubcourseId === subcourseId;
}

/**
 * Builds the score for one subcourse. Reads a lot, so it is NOT something to
 * call on every screen — publishing is throttled (see publishMainLeaderboardScore).
 */
export async function computeMainLeaderboardScore(
  uid: string,
  courseId: string,
  subcourseId: string,
): Promise<MainLeaderboardScore> {
  // Every read is independently catch-guarded: one unavailable source should
  // degrade the score, never fail the whole publish. The content totals are the
  // coverage denominator and come from a single aggregate document, so adding
  // them costs one read on top of the history this already loads.
  const [qotdDocs, examDocs, dailyDocs, practiceDocs, activityDocs, usage, contentTotals] = await Promise.all([
    listDocuments(`users/${uid}/questionofdata`).catch(() => [] as Record<string, unknown>[]),
    listDocuments(Collections.examAttempts(uid)).catch(() => [] as Record<string, unknown>[]),
    listDocuments(Collections.dailyTestResults(uid)).catch(() => [] as Record<string, unknown>[]),
    listDocuments(Collections.learningProgress(uid)).catch(() => [] as Record<string, unknown>[]),
    fetchActivityProgress(uid).catch(() => [] as ActivityProgress[]),
    fetchAppUsage(uid).catch(() => ({ ...EMPTY_USAGE }) as AppUsageSummary),
    fetchContentTotals(subcourseId),
  ]);

  const percentParts: PercentPart[] = [];
  // Distinct content items covered, per category. Everything below counts
  // DISTINCT ids rather than attempts — re-answering the same question is more
  // study, but it is not more coverage.
  const covered: CoverageCounts = { ...EMPTY_COVERAGE };
  let points = 0;

  // ===== Question of the Day =====
  // The same collection also holds the rolling 'summary' document, which is not
  // an attempt and must not be counted as one.
  let qotdAttempts = 0;
  let qotdCorrect = 0;
  for (const doc of qotdDocs) {
    if (str(doc.id) === 'summary') continue;
    if (!belongsToSubcourse(str(doc.subcourseId), subcourseId)) continue;
    qotdAttempts += 1;
    if (doc.isCorrect === true) qotdCorrect += 1;
  }
  const qotdPercent = percentOf(qotdCorrect, qotdAttempts);
  if (qotdAttempts > 0) {
    percentParts.push({ value: qotdPercent, weight: PERCENT_WEIGHTS.qotd });
    points += qotdAttempts * POINTS.qotdAttempt + qotdCorrect * POINTS.qotdCorrect;
  }

  // ===== Exams =====
  // Scored on the BEST attempt per set, matching how the per-exam ranking works,
  // so retrying to improve is not averaged away. Points still accrue per attempt.
  const bestByExamSet = new Map<string, number>();
  let examAttempts = 0;
  for (const doc of examDocs) {
    if (!belongsToSubcourse(str(doc.subcourseId), subcourseId)) continue;
    const setId = str(doc.examSetId);
    if (!setId) continue;
    const score = Math.max(0, Math.min(100, num(doc.score)));
    examAttempts += 1;
    points += POINTS.examAttempt + score * POINTS.examPerScorePoint;
    const previousBest = bestByExamSet.get(setId);
    if (previousBest === undefined || score > previousBest) bestByExamSet.set(setId, score);
  }
  const examBests = [...bestByExamSet.values()];
  const examAveragePercent = examBests.length
    ? examBests.reduce((sum, value) => sum + value, 0) / examBests.length
    : 0;
  const examBestPercent = examBests.length ? Math.max(...examBests) : 0;
  if (examAttempts > 0) {
    percentParts.push({ value: examAveragePercent, weight: PERCENT_WEIGHTS.exam });
  }
  // An exam set is "covered" once it has been sat at all — every attempt
  // document carries a score, so there are no half-finished sets to exclude.
  // Sitting the same set five times is one covered set, not five.
  covered.exam = bestByExamSet.size;

  // ===== Daily tests =====
  // Coverage counts DISTINCT models. Unlike the other categories the attempt
  // documents are one-per-attempt, so the model id has to be collected
  // explicitly rather than inferred from the document count.
  const dailyModelIds = new Set<string>();
  let dailyAttempts = 0;
  let dailyScoreSum = 0;
  for (const doc of dailyDocs) {
    if (!belongsToSubcourse(str(doc.subcourseId), subcourseId)) continue;
    const score = Math.max(0, Math.min(100, num(doc.score)));
    dailyAttempts += 1;
    dailyScoreSum += score;
    points += POINTS.dailyTestAttempt + score * POINTS.dailyTestPerScorePoint;
    const modelId = str(doc.modelId);
    if (modelId) dailyModelIds.add(modelId);
  }
  const dailyAveragePercent = dailyAttempts > 0 ? dailyScoreSum / dailyAttempts : 0;
  if (dailyAttempts > 0) {
    percentParts.push({ value: dailyAveragePercent, weight: PERCENT_WEIGHTS.dailyTest });
  }
  // Results written before modelId was recorded cannot be de-duplicated, so
  // they fall back to the attempt count — generous for a repeat-tester, but
  // never more than the number of models that exist (computeCoverage clamps).
  covered.dailyTest = dailyModelIds.size > 0 ? dailyModelIds.size : dailyAttempts;

  // ===== Practice mode (learning_progress) =====
  let practiceAttempted = 0;
  let practiceCorrect = 0;
  let chaptersCompleted = 0;
  for (const doc of practiceDocs) {
    if (!belongsToSubcourse(str(doc.subcourseId), subcourseId)) continue;
    const attempted = Array.isArray(doc.attemptedQuestionIds) ? doc.attemptedQuestionIds.length : 0;
    const correct = Array.isArray(doc.correctQuestionIds) ? doc.correctQuestionIds.length : 0;
    practiceAttempted += attempted;
    practiceCorrect += correct;
    if (doc.completed === true) {
      chaptersCompleted += 1;
      points += POINTS.completionBonus;
    }
  }
  const practicePercent = percentOf(practiceCorrect, practiceAttempted);
  if (practiceAttempted > 0) {
    percentParts.push({ value: practicePercent, weight: PERCENT_WEIGHTS.practice });
    points += practiceAttempted * POINTS.practiceAttempt + practiceCorrect * POINTS.practiceCorrect;
  }
  // attemptedQuestionIds is already a distinct set per chapter document (the
  // writer unions on every save), and a question belongs to exactly one
  // chapter, so summing their lengths is a distinct question count.
  covered.practice = practiceAttempted;

  // ===== Everything in app_activity_progress =====
  // GK/PM are scored (they have questions); read/theory/constitution are
  // coverage only, so they feed the 'reading' weight rather than an accuracy one.
  let gkPmAttempted = 0;
  let gkPmCorrect = 0;
  let gkPmCovered = 0;
  let questionsRead = 0;
  let theoryCompleted = 0;
  let constitutionParts = 0;
  let readingSeconds = 0;

  const scoredSources = new Set<ActivitySource>(['gk', 'pm', 'pastqns']);
  for (const record of activityDocs) {
    if (!belongsToSubcourse(record.subcourseId, subcourseId)) continue;
    readingSeconds += Math.max(0, record.secondsSpent);

    if (scoredSources.has(record.source)) {
      gkPmAttempted += record.attemptedQuestionIds.length;
      gkPmCorrect += record.correctQuestionIds.length;
      // Coverage is broader than scoring here: revealing a GK answer without
      // committing to an option is still consuming that question. The union
      // de-duplicates the overlap between the two lists.
      gkPmCovered += new Set([...record.attemptedQuestionIds, ...record.viewedItemIds]).size;
      continue;
    }

    if (record.source === 'read') {
      questionsRead += record.viewedItemIds.length;
      points += record.viewedItemIds.length * POINTS.readViewed;
      if (record.completed) points += POINTS.completionBonus;
      continue;
    }
    if (record.source === 'theory' && record.completed) {
      theoryCompleted += 1;
      points += POINTS.theoryCompleted;
      continue;
    }
    if (record.source === 'constitution') {
      constitutionParts += 1;
      points += POINTS.constitutionRead;
    }
  }

  // The three coverage categories that come out of activity progress. Theory is
  // the one the previous accuracy metric could not see at all: a PDF has no
  // right answer, so reading every chapter moved the old ring by nothing.
  covered.gkPm = gkPmCovered;
  covered.read = questionsRead;
  covered.theory = theoryCompleted;
  covered.constitution = constitutionParts;

  const gkPmPercent = percentOf(gkPmCorrect, gkPmAttempted);
  if (gkPmAttempted > 0) {
    percentParts.push({ value: gkPmPercent, weight: PERCENT_WEIGHTS.gkPm });
    points += gkPmAttempted * POINTS.gkPmAttempt + gkPmCorrect * POINTS.gkPmCorrect;
  }

  // Reading has no right or wrong answer, so its "accuracy" is how much material
  // was covered, normalised against a nominal target (see scoring.ts).
  const readingCoverage = readingUnits(questionsRead, theoryCompleted, constitutionParts);
  if (readingCoverage > 0) {
    percentParts.push({
      value: percentOf(readingCoverage, READING_TARGET_UNITS),
      weight: PERCENT_WEIGHTS.reading,
    });
  }

  // ===== Time in app → capped points =====
  points += timePoints(usage.foregroundSeconds);

  // Accuracy is no longer the headline, but it is still worth knowing and the
  // stats card and analytics screen both read it.
  const accuracyPercent = weightedPercent(percentParts);
  // The headline: coverage of everything this subcourse contains.
  const coverage = computeCoverage(covered, contentTotals);

  return {
    courseId,
    subcourseId,
    percent: round2(Math.max(0, Math.min(100, coverage.percent))),
    accuracyPercent: round2(Math.max(0, Math.min(100, accuracyPercent))),
    points: Math.max(0, Math.round(safeNumber(points))),
    usageSeconds: Math.max(0, Math.round(usage.foregroundSeconds)),
    activityCount: Math.max(0, Math.round(usage.activityCount)),
    breakdown: {
      qotd: { attempts: qotdAttempts, correct: qotdCorrect, percent: round2(qotdPercent) },
      exam: {
        attempts: examAttempts,
        bestPercent: round2(examBestPercent),
        averagePercent: round2(examAveragePercent),
      },
      dailyTest: { attempts: dailyAttempts, averagePercent: round2(dailyAveragePercent) },
      practice: {
        attempted: practiceAttempted,
        correct: practiceCorrect,
        percent: round2(practicePercent),
        chaptersCompleted,
      },
      gkPm: { attempted: gkPmAttempted, correct: gkPmCorrect, percent: round2(gkPmPercent) },
      reading: {
        questionsRead,
        theoryCompleted,
        constitutionParts,
        secondsSpent: Math.round(readingSeconds),
      },
      usage: {
        foregroundSeconds: Math.max(0, Math.round(usage.foregroundSeconds)),
        sessionCount: Math.max(0, Math.round(usage.sessionCount)),
        activityCount: Math.max(0, Math.round(usage.activityCount)),
      },
      coverage: {
        percent: round2(coverage.percent),
        coveredItems: coverage.coveredItems,
        totalItems: coverage.totalItems,
        details: coverage.details,
      },
    },
  };
}

export function publicRowId(uid: string, subcourseId: string): string {
  return `${uid}__${subcourseId}`.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 128);
}

/**
 * Recomputing a score reads a user's entire history, so publishing is throttled
 * to once every five minutes per user+subcourse.
 *
 * This lives here rather than in a screen because more than one screen publishes
 * now — the leaderboard, the analytics page, and the once-a-day trigger on app
 * open. When each screen kept its own Map they did not see each other's writes
 * and the effective recompute rate multiplied by the number of screens visited.
 */
const PUBLISH_INTERVAL_MS = 5 * 60 * 1000;
const lastPublishedAt = new Map<string, number>();

function throttleKey(uid: string, subcourseId: string): string {
  return `${uid}__${subcourseId}`;
}

/** True when enough time has passed to justify another full recompute. */
export function shouldPublishMainLeaderboardScore(uid: string, subcourseId: string): boolean {
  if (!uid || !subcourseId) return false;
  const previous = lastPublishedAt.get(throttleKey(uid, subcourseId));
  return previous === undefined || Date.now() - previous > PUBLISH_INTERVAL_MS;
}

/**
 * Forces the next publish through — used by pull-to-refresh, where the user has
 * explicitly asked for fresh numbers and waiting out the throttle would look
 * like the refresh did nothing.
 */
export function resetMainLeaderboardThrottle(uid: string, subcourseId: string): void {
  lastPublishedAt.delete(throttleKey(uid, subcourseId));
}

/**
 * Computes and publishes the score. The private document carries the whole
 * breakdown; the public row carries only what the list renders plus the
 * tiebreak fields. A daily analytics snapshot is recorded from the same
 * computation, so the trend history cannot drift from the score it came from.
 *
 * Never throws — the leaderboard is a read-only view of the user's own work, so
 * a failed publish must not interrupt whatever they were doing.
 */
export async function publishMainLeaderboardScore(
  uid: string,
  courseId: string,
  subcourseId: string,
  identity: PublicIdentity,
): Promise<MainLeaderboardScore | null> {
  if (!uid || !subcourseId) return null;

  try {
    // Bank any buffered usage first, so the score reflects the session that is
    // happening right now rather than the last flush five minutes ago.
    await flushAppUsage(uid).catch(() => {});

    const score = await computeMainLeaderboardScore(uid, courseId, subcourseId);
    lastPublishedAt.set(throttleKey(uid, subcourseId), Date.now());

    await setDocument(
      `${Collections.mainLeaderboard(uid)}/${subcourseId}`,
      {
        courseId,
        subcourseId,
        percent: score.percent,
        accuracyPercent: score.accuracyPercent,
        points: score.points,
        usageSeconds: score.usageSeconds,
        activityCount: score.activityCount,
        breakdown: score.breakdown,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    // Best-effort: losing the public row costs a leaderboard position, not data.
    await setDocument(
      `${Collections.mainLeaderboardPublic}/${publicRowId(uid, subcourseId)}`,
      {
        uid,
        courseId,
        subcourseId,
        name: identity.name || 'Anonymous',
        photoURL: identity.photoURL,
        // Stored so other users' devices can draw the verified tick without
        // reading this person's profile — which the rules would not allow.
        isPro: identity.isPro,
        percent: score.percent,
        points: score.points,
        usageSeconds: score.usageSeconds,
        activityCount: score.activityCount,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ).catch(() => {});

    // Also best-effort, and deliberately last: the analytics history is a
    // derived convenience, so it must never be the reason a score fails to
    // publish. It already swallows its own errors; the catch is belt and braces.
    await recordAnalyticsSnapshot(uid, score).catch(() => {});

    return score;
  } catch {
    return null;
  }
}

/**
 * Guarantees at least one snapshot per Kathmandu day the app is opened.
 *
 * Without this, the trend history would only record days on which the user
 * happened to visit the Leaderboard or Analytics screen, so a streak and a
 * heatmap would both under-report study that definitely happened. The cost is
 * one recompute per active day, which was judged worth paying for honest
 * history.
 *
 * The marker is stored per user+subcourse rather than globally so switching
 * course still produces a snapshot for the newly selected one.
 */
function dailySnapshotKey(uid: string, subcourseId: string): string {
  return `@loksewa/analytics/last-day/${uid}__${subcourseId}`;
}

/**
 * Returns the score it published, or null when it did not publish one (already
 * snapshotted today, inside the throttle window, offline, or not enrolled).
 *
 * The return value exists so the caller can hand a freshly computed score to the
 * profile store instead of reading the same numbers back out of Firestore a
 * moment later — this function has already paid for the recompute.
 */
export async function ensureDailyAnalyticsSnapshot(
  uid: string,
  courseId: string,
  subcourseId: string,
  identity: PublicIdentity,
): Promise<MainLeaderboardScore | null> {
  if (!uid || !subcourseId) return null;

  try {
    const storageKey = dailySnapshotKey(uid, subcourseId);
    const today = analyticsTodayKey();
    if ((await AsyncStorage.getItem(storageKey)) === today) return null;

    // A publish inside the throttle window has already snapshotted today, so
    // the day is done without spending a second recompute on it.
    if (!shouldPublishMainLeaderboardScore(uid, subcourseId)) {
      await AsyncStorage.setItem(storageKey, today);
      return null;
    }

    // The marker is only written on success: an offline launch should retry on
    // the next open rather than silently forfeit the day.
    const score = await publishMainLeaderboardScore(uid, courseId, subcourseId, identity);
    if (score) await AsyncStorage.setItem(storageKey, today);
    return score;
  } catch {
    // Never surfaces — this runs unattended at app start.
    return null;
  }
}

/** Reads back the stored private aggregate without recomputing it. */
export async function fetchMyMainLeaderboardScore(
  uid: string,
  subcourseId: string,
): Promise<MainLeaderboardScore | null> {
  if (!uid || !subcourseId) return null;
  try {
    const doc = await getDocument(`${Collections.mainLeaderboard(uid)}/${subcourseId}`);
    if (!doc) return null;
    const breakdown = (doc.breakdown ?? {}) as MainLeaderboardBreakdown;
    return {
      courseId: str(doc.courseId),
      subcourseId: str(doc.subcourseId, subcourseId),
      percent: num(doc.percent),
      // Documents written before coverage existed have no accuracyPercent, and
      // back then `percent` WAS the accuracy — so falling back to it keeps those
      // users' stats card honest until their next publish.
      accuracyPercent: doc.accuracyPercent === undefined ? num(doc.percent) : num(doc.accuracyPercent),
      points: num(doc.points),
      usageSeconds: num(doc.usageSeconds),
      activityCount: num(doc.activityCount),
      breakdown,
    };
  } catch {
    return null;
  }
}

/**
 * Ranking order, exactly as specified: points, then percent, then who uses the
 * app more — first by foreground time, then by number of recorded activities.
 */
export function compareMainLeaderboardRows(a: MainLeaderboardRow, b: MainLeaderboardRow): number {
  if (b.points !== a.points) return b.points - a.points;
  if (b.percent !== a.percent) return b.percent - a.percent;
  if (b.usageSeconds !== a.usageSeconds) return b.usageSeconds - a.usageSeconds;
  if (b.activityCount !== a.activityCount) return b.activityCount - a.activityCount;
  // Final fallback keeps the order stable across refetches instead of letting
  // two identical users swap places on every load.
  return a.uid.localeCompare(b.uid);
}

/**
 * The leaderboard itself. Filtered on subcourseId ONLY and sorted client-side:
 * a server-side orderBy on a different field would require a composite index,
 * which cannot be created from the app. The limit keeps one screen's worth of
 * reads bounded.
 */
export async function fetchMainLeaderboard(
  subcourseId: string,
  max = 300,
): Promise<MainLeaderboardRow[]> {
  if (!subcourseId) return [];
  try {
    const docs = await runQuery(Collections.mainLeaderboardPublic, {
      where: [{ field: 'subcourseId', op: '==', value: subcourseId }],
      limit: max,
    });

    // One row per uid: a stale duplicate from an older id scheme must not let
    // the same person occupy two positions.
    const bestByUid = new Map<string, MainLeaderboardRow>();
    for (const doc of docs) {
      const uid = str(doc.uid);
      if (!uid) continue;
      const row: MainLeaderboardRow = {
        id: str(doc.id, publicRowId(uid, subcourseId)),
        uid,
        name: str(doc.name, 'Anonymous'),
        photoURL: str(doc.photoURL) || null,
        // Absent on rows published before the badge existed, so anything that
        // is not an explicit true reads as a free account.
        isPro: doc.isPro === true,
        percent: num(doc.percent),
        points: num(doc.points),
        usageSeconds: num(doc.usageSeconds),
        activityCount: num(doc.activityCount),
      };
      const existing = bestByUid.get(uid);
      if (!existing || compareMainLeaderboardRows(row, existing) < 0) bestByUid.set(uid, row);
    }

    return [...bestByUid.values()].sort(compareMainLeaderboardRows);
  } catch {
    return [];
  }
}

// ---------- shared board cache ----------
//
// One board read is up to 300 documents. The leaderboard screen and the
// analytics cohort section both want the same rows, and the analytics screen
// refetches on every focus — without this, opening analytics, tapping through to
// the leaderboard and coming back would cost three full reads inside a minute
// for a board that changes on the order of hours.
//
// In-memory on purpose: a cache that outlives the process would show yesterday's
// standings on a cold start, which is worse than paying for the read.

const BOARD_CACHE_MS = 10 * 60 * 1000;

interface CachedBoard {
  rows: MainLeaderboardRow[];
  at: number;
}

const boardCache = new Map<string, CachedBoard>();

/** Board rows, reusing a read from the last ten minutes when one exists. */
export async function fetchMainLeaderboardCached(
  subcourseId: string,
  max = 300,
): Promise<MainLeaderboardRow[]> {
  if (!subcourseId) return [];

  const cached = boardCache.get(subcourseId);
  if (cached && Date.now() - cached.at < BOARD_CACHE_MS) return cached.rows;

  const rows = await fetchMainLeaderboard(subcourseId, max);
  // An empty result is not cached: it is far more likely to be a failed read
  // than a genuinely empty board, and caching it would leave the user staring at
  // "no one here yet" for ten minutes.
  if (rows.length) boardCache.set(subcourseId, { rows, at: Date.now() });
  return rows;
}

/** Drops a cached board so the next read is fresh. Call on pull-to-refresh. */
export function invalidateMainLeaderboardCache(subcourseId?: string): void {
  if (subcourseId) boardCache.delete(subcourseId);
  else boardCache.clear();
}
