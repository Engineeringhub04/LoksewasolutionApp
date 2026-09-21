// Progress for everything that previously persisted nothing.
//
// Practice mode already writes users/{uid}/learning_progress, exams write
// exam_attempts, daily tests write daily_test_results. But read mode, theory
// mode, GK, PM and the Constitution reader recorded NOTHING to Firestore — GK/PM
// kept a local AsyncStorage record that is wiped every calendar day and isn't
// even keyed by uid, so two accounts on one phone shared it.
//
// Since the main leaderboard has to score all of them, they all write here now.
// One collection with a `source` field rather than six collections, because each
// new collection costs another security rule and they share a shape.
//
// Everything here is cumulative and monotonic — a chapter you have read stays
// read. Question ids are stored as arrays (not counts) so re-reading the same
// chapter can't inflate the score.
import { getDocument, listDocuments, serverTimestamp, setDocument } from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';

/** Which part of the app produced this record. */
export type ActivitySource = 'read' | 'theory' | 'gk' | 'pm' | 'constitution' | 'pastqns';

export interface ActivityProgress {
  id: string;
  source: ActivitySource;
  refId: string;
  courseId: string;
  subcourseId: string;
  /** Distinct question ids attempted (scored sources only). */
  attemptedQuestionIds: string[];
  /** Distinct question ids answered correctly (scored sources only). */
  correctQuestionIds: string[];
  /** Items viewed — questions revealed in read mode, sections opened in the constitution. */
  viewedItemIds: string[];
  /** Denominator when the source knows it. */
  totalItems: number;
  /** Time spent inside this activity. */
  secondsSpent: number;
  /** How many times the user opened this activity. */
  visits: number;
  completed: boolean;
}

function docId(source: ActivitySource, refId: string): string {
  return `${source}__${refId}`.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 128);
}

function progressPath(uid: string, source: ActivitySource, refId: string): string {
  return `${Collections.activityProgress(uid)}/${docId(source, refId)}`;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function fromDocument(raw: Record<string, unknown>): ActivityProgress {
  return {
    id: String(raw.id ?? ''),
    source: (['read', 'theory', 'gk', 'pm', 'constitution', 'pastqns'].includes(String(raw.source))
      ? String(raw.source)
      : 'read') as ActivitySource,
    refId: String(raw.refId ?? ''),
    courseId: String(raw.courseId ?? ''),
    subcourseId: String(raw.subcourseId ?? ''),
    attemptedQuestionIds: stringList(raw.attemptedQuestionIds),
    correctQuestionIds: stringList(raw.correctQuestionIds),
    viewedItemIds: stringList(raw.viewedItemIds),
    totalItems: Number(raw.totalItems ?? 0),
    secondsSpent: Number(raw.secondsSpent ?? 0),
    visits: Number(raw.visits ?? 0),
    completed: raw.completed === true,
  };
}

/** Union that also caps length, so one runaway activity can't bloat a document. */
function mergeIds(existing: string[], incoming: string[] | undefined, cap = 1000): string[] {
  if (!incoming?.length) return existing;
  return Array.from(new Set([...existing, ...incoming])).slice(0, cap);
}

export interface RecordActivityInput {
  source: ActivitySource;
  /** Stable id for this activity — a chapterId, topicId or constitution sectionId. */
  refId: string;
  courseId: string;
  subcourseId: string;
  attemptedQuestionIds?: string[];
  correctQuestionIds?: string[];
  viewedItemIds?: string[];
  totalItems?: number;
  /** Added to the running total. */
  secondsSpent?: number;
  /** Counts one more visit when true. */
  countVisit?: boolean;
  completed?: boolean;
}

/**
 * Read-modify-write rather than blind increments: the id arrays have to be
 * unioned, and a merge write cannot do that server-side. One extra read per
 * activity is acceptable — these fire when a screen closes, not in a loop.
 *
 * Never throws. Losing a progress record must not break the screen the user is
 * actually looking at.
 */
export async function recordActivityProgress(uid: string, input: RecordActivityInput): Promise<void> {
  if (!uid || !input.refId || !input.subcourseId) return;

  try {
    const path = progressPath(uid, input.source, input.refId);
    const existingDoc = await getDocument(path).catch(() => null);
    const existing = existingDoc ? fromDocument(existingDoc) : null;

    const attempted = mergeIds(existing?.attemptedQuestionIds ?? [], input.attemptedQuestionIds);
    const correct = mergeIds(existing?.correctQuestionIds ?? [], input.correctQuestionIds);
    const viewed = mergeIds(existing?.viewedItemIds ?? [], input.viewedItemIds);
    const seconds = (existing?.secondsSpent ?? 0) + Math.max(0, Math.round(input.secondsSpent ?? 0));
    const visits = (existing?.visits ?? 0) + (input.countVisit ? 1 : 0);
    const totalItems = input.totalItems !== undefined
      ? Math.max(0, input.totalItems)
      : existing?.totalItems ?? 0;

    await setDocument(
      path,
      {
        source: input.source,
        refId: input.refId,
        courseId: input.courseId,
        subcourseId: input.subcourseId,
        attemptedQuestionIds: attempted,
        correctQuestionIds: correct,
        viewedItemIds: viewed,
        totalItems,
        secondsSpent: seconds,
        visits,
        // Completion is sticky — once finished, always finished.
        completed: input.completed === true || existing?.completed === true,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch {
    // Silent by design (see doc comment).
  }
}

/** Every activity record for this user. Scoped to a subcourse by the caller. */
export async function fetchActivityProgress(uid: string): Promise<ActivityProgress[]> {
  if (!uid) return [];
  try {
    const docs = await listDocuments(Collections.activityProgress(uid));
    return docs.map(fromDocument);
  } catch {
    return [];
  }
}
