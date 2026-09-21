// How much content this subcourse contains — the denominator behind the
// profile progress ring.
//
// ===== Why a stored document instead of counting =====
// The ring shows coverage ("how much of the app have I worked through"), so it
// needs to know how much there is. Counting that on the client is not an
// option here:
//
//   • this app talks to Firestore over the REST API and does not implement
//     runAggregationQuery, so there is no count() to call;
//   • most question banks are ARRAYS nested inside a parent document
//     (app_exam_sets.questions, app_subject_cucqdata_Allmode.questions, ...),
//     and a nested array cannot be counted by any server-side query even if
//     aggregation existed — you have to download the documents;
//   • so a live count means listing six catalog collections in full, on every
//     score publish, for every user. That is hundreds of reads per user per day
//     to learn a number that changes only when an admin publishes content.
//
// The admin site therefore maintains one small aggregate document per subcourse
// and the app reads it. Because the admin's write ships the counter update as an
// atomic `increment()` transform inside the same commit as the content itself,
// the totals cannot drift from a half-finished save.
//
// ===== Constitution is the exception =====
// Constitution content is not in Firestore at all — it is served from an
// external CDN whose index already carries `totalContentFiles`, and that index
// is cached on device. So that one total is read locally for free and stays
// correct automatically whenever the constitution is republished, without the
// admin site knowing anything about it.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDocument } from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';
import { fetchConstitutionIndex } from '@/src/core/services/constitution';
import {
  FALLBACK_CONTENT_TOTALS,
  type ContentTotals,
  type CoverageSource,
} from '@/src/core/services/scoring';

/**
 * Field names on `app_content_totals/{subcourseId}`. They are spelled out here
 * rather than derived from CoverageSource so that renaming a coverage category
 * in the app can never silently stop matching what the admin site writes.
 */
const TOTAL_FIELDS: Record<Exclude<CoverageSource, 'constitution'>, string> = {
  practice: 'practiceQuestions',
  theory: 'theoryItems',
  exam: 'examSets',
  gkPm: 'gkPmQuestions',
  read: 'readQuestions',
  dailyTest: 'dailyTestModels',
};

const CACHE_PREFIX = '@loksewa/content-totals/';
/**
 * Content is published by hand and the score itself only republishes every five
 * minutes, so an hour-old denominator is indistinguishable from a fresh one —
 * and re-reading it more often would spend reads to learn nothing.
 */
const MEMORY_TTL_MS = 60 * 60 * 1000;

interface CachedTotals {
  totals: ContentTotals;
  at: number;
}

const memoryCache = new Map<string, CachedTotals>();

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

/**
 * The constitution part count, straight from the cached CDN index.
 *
 * Never throws and never blocks: if the index has not been downloaded yet this
 * returns the fallback, which only means the constitution slice of the ring is
 * approximate until the user first opens that section.
 */
async function fetchConstitutionTotal(): Promise<number> {
  try {
    const index = await fetchConstitutionIndex();
    const fromIndex = num(index.totalContentFiles);
    if (fromIndex > 0) return fromIndex;
    // Older index files omitted the count but still listed every file.
    return Array.isArray(index.files) ? index.files.length : 0;
  } catch {
    return 0;
  }
}

/**
 * Reads the stored totals for a subcourse, falling back field-by-field.
 *
 * The fallback is per-field on purpose: a totals document that has been written
 * for practice questions but not yet for theory should contribute its real
 * practice number and only approximate the rest, rather than being thrown away
 * wholesale because one counter is missing.
 */
export async function fetchContentTotals(subcourseId: string): Promise<ContentTotals> {
  if (!subcourseId) return { ...FALLBACK_CONTENT_TOTALS };

  const cached = memoryCache.get(subcourseId);
  if (cached && Date.now() - cached.at < MEMORY_TTL_MS) return cached.totals;

  const storageKey = `${CACHE_PREFIX}${subcourseId}`;

  // Both sources are independently guarded: the constitution CDN being
  // unreachable must not cost us the Firestore totals, and vice versa.
  const [doc, constitutionTotal] = await Promise.all([
    getDocument(`${Collections.contentTotals}/${subcourseId}`).catch(() => null),
    fetchConstitutionTotal(),
  ]);

  if (!doc) {
    // Offline or not seeded yet. A previously cached copy is far better than
    // the generic fallback, because it was real at some point.
    try {
      const stored = await AsyncStorage.getItem(storageKey);
      if (stored) {
        const totals = JSON.parse(stored) as ContentTotals;
        if (constitutionTotal > 0) totals.constitution = constitutionTotal;
        memoryCache.set(subcourseId, { totals, at: Date.now() });
        return totals;
      }
    } catch {
      // Corrupt cache entry — fall through to the defaults below.
    }

    const totals: ContentTotals = {
      ...FALLBACK_CONTENT_TOTALS,
      constitution: constitutionTotal || FALLBACK_CONTENT_TOTALS.constitution,
    };
    // Deliberately NOT persisted: these are guesses, and writing them would make
    // them indistinguishable from real totals on the next cold start.
    memoryCache.set(subcourseId, { totals, at: Date.now() });
    return totals;
  }

  const totals = { ...FALLBACK_CONTENT_TOTALS };
  for (const [source, field] of Object.entries(TOTAL_FIELDS) as [
    Exclude<CoverageSource, 'constitution'>,
    string,
  ][]) {
    const value = num(doc[field]);
    // A zero here is meaningful — it means the admin has published none of this
    // content type yet, and computeCoverage will correctly skip the category
    // rather than scoring the user 0% on material that does not exist.
    if (doc[field] !== undefined && doc[field] !== null) totals[source] = value;
  }
  totals.constitution = constitutionTotal || num(doc.constitutionSections);

  memoryCache.set(subcourseId, { totals, at: Date.now() });
  // Persisted so a cold, offline start still shows a truthful percentage.
  AsyncStorage.setItem(storageKey, JSON.stringify(totals)).catch(() => {});
  return totals;
}

/** Drops the cached denominator so the next score publish re-reads it. */
export function invalidateContentTotals(subcourseId?: string): void {
  if (subcourseId) memoryCache.delete(subcourseId);
  else memoryCache.clear();
}
