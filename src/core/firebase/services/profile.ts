// User profile service — the single place that reads/writes the extended
// profile fields on users/{uid}.
//
// Before this existed, the Profile screen rendered purely from the cached auth
// session (uid/email/displayName/photoURL) and nothing beyond name/photo was
// ever persisted. Date of birth, gender and the split first/last name had no
// storage at all. This service owns that schema so every screen reads the same
// shape.
//
// Full users/{uid} document shape:
//   uid, name, firstName, lastName, email, dob, gender, photoURL,
//   courseId, subcourseId, courseSetupComplete,
//   stats: { testsTaken, streak, rank, points },
//   createdAt, updatedAt
//
// `stats` holds the four headline numbers shown under the Profile header. They
// are NOT computed here — see `writeUserStats` at the bottom of this file for
// who fills them in and why they live on the user document at all.
import { getDocument, setDocument, deleteDocument, serverTimestamp } from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';

export type Gender = 'male' | 'female' | 'other';
export type PhotoURLSource = 'manual' | 'google' | 'none';

export interface UserStats {
  testsTaken: number;
  streak: number;
  rank: number;
  points: number;
}

export interface UserProfile {
  uid: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string | null;
  dob: string | null; // ISO calendar date, 'YYYY-MM-DD'
  gender: Gender | null;
  photoURL: string | null;
  photoURLSource: PhotoURLSource;
  courseId: string | null;
  subcourseId: string | null;
  stats: UserStats;
  /**
   * Read-only here — firebase.rules forbids a client from ever writing this
   * field (see users/{userId} create/update rules), so it can only be set by
   * an admin editing Firestore directly. Gates the Admin Answer Review desk.
   */
  isAdmin: boolean;
  /**
   * Read-only here too — only approveSubscription()/expireIfPastDue() in
   * subscription.ts ever write these fields, mirrored from the approved
   * app_subscriptions record so the Profile screen can show "Premium
   * Monthly" / "Premium Yearly" / "Free Plan" with a single document read
   * instead of querying subscriptions on every profile view.
   */
  isPremium: boolean;
  premiumPlanName: string | null;
  premiumBillingCycle: 'monthly' | 'yearly' | 'free' | null;
  premiumExpiryDate: string | null;
}

export const EMPTY_STATS: UserStats = { testsTaken: 0, streak: 0, rank: 0, points: 0 };

/** Returns true only while the user's mirrored premium entitlement is active. */
export function hasActivePremium(profile: Pick<UserProfile, 'isPremium' | 'premiumExpiryDate'> | null): boolean {
  if (!profile?.isPremium) return false;
  if (!profile.premiumExpiryDate) return true;
  const expiryTime = new Date(profile.premiumExpiryDate).getTime();
  return Number.isFinite(expiryTime) && expiryTime > Date.now();
}

function userPath(uid: string): string {
  return `${Collections.users}/${uid}`;
}

/** Splits a legacy single `name` field into first/last for the edit form. */
function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export function fullNameOf(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
}

function toGender(value: unknown): Gender | null {
  return value === 'male' || value === 'female' || value === 'other' ? value : null;
}

function toStats(value: unknown): UserStats {
  const raw = (value ?? {}) as Partial<Record<keyof UserStats, unknown>>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return {
    testsTaken: num(raw.testsTaken),
    streak: num(raw.streak),
    rank: num(raw.rank),
    points: num(raw.points),
  };
}

/**
 * Reads the profile document. Returns null only when the document doesn't
 * exist; otherwise every field is normalised so callers never deal with
 * undefined. `firstName`/`lastName` fall back to splitting the legacy `name`
 * field for accounts created before those fields existed.
 */
export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const doc = await getDocument(userPath(uid));
  if (!doc) return null;

  const name = (doc.name as string | undefined) ?? '';
  const storedFirst = (doc.firstName as string | undefined) ?? '';
  const storedLast = (doc.lastName as string | undefined) ?? '';
  const derived = splitName(name);

  // Backfill the stats map on the same read that fetched the profile, so
  // callers no longer need a separate getDocument() for ensureUserStats().
  if (!doc.stats) {
    await setDocument(userPath(uid), { stats: EMPTY_STATS, updatedAt: serverTimestamp() }, { merge: true }).catch(() => {
      // A failed backfill must never block profile loading.
    });
  }

  // Seed the baseline every writer composes its partial update against. This is
  // the read that makes `writeUserStats` free — see its comment block below.
  const stats = toStats(doc.stats);
  statsBaseline.set(uid, stats);

  return {
    uid,
    name,
    firstName: storedFirst || derived.firstName,
    lastName: storedLast || derived.lastName,
    email: (doc.email as string | undefined) ?? null,
    dob: (doc.dob as string | undefined) ?? null,
    gender: toGender(doc.gender),
    photoURL: (doc.photoURL as string | undefined) ?? null,
    photoURLSource:
      doc.photoURLSource === 'manual' || doc.photoURLSource === 'google' || doc.photoURLSource === 'none'
        ? doc.photoURLSource
        : ((doc.photoURL as string | undefined) ? 'manual' : 'none'),
    courseId: (doc.courseId as string | undefined) ?? null,
    subcourseId: (doc.subcourseId as string | undefined) ?? null,
    stats,
    isAdmin: doc.role === 'admin',
    isPremium: doc.isPremium === true,
    premiumPlanName: (doc.premiumPlanName as string | undefined) ?? null,
    premiumBillingCycle: (doc.premiumBillingCycle as 'monthly' | 'yearly' | 'free' | undefined) ?? null,
    premiumExpiryDate: (doc.premiumExpiryDate as string | undefined) ?? null,
  };
}

export interface UpdateUserProfileInput {
  firstName: string;
  lastName: string;
  dob: string | null;
  gender: Gender | null;
  photoURL: string | null;
  photoURLSource?: PhotoURLSource;
}

/**
 * Merges the editable profile fields into users/{uid}. `name` is kept in sync
 * with first+last so existing readers (Home header, leaderboard, auth session)
 * keep working unchanged.
 */
export async function updateUserProfile(uid: string, input: UpdateUserProfileInput): Promise<void> {
  await setDocument(
    userPath(uid),
    {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      name: fullNameOf(input.firstName, input.lastName),
      dob: input.dob,
      gender: input.gender,
      photoURL: input.photoURL,
      ...(input.photoURLSource !== undefined ? { photoURLSource: input.photoURLSource } : {}),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Ensures the stats map exists on the document so the Profile screen has
 * something to render and later aggregation jobs have a target to increment.
 * Safe to call repeatedly — merge only fills in what's missing.
 */
export async function ensureUserStats(uid: string): Promise<void> {
  const doc = await getDocument(userPath(uid));
  if (doc?.stats) return;
  await setDocument(userPath(uid), { stats: EMPTY_STATS, updatedAt: serverTimestamp() }, { merge: true });
}

// ---------- keeping `stats` honest ----------
//
// The four numbers are produced by jobs that already have them in hand, so this
// costs no extra reads anywhere:
//
//   points, testsTaken, streak → recordAnalyticsSnapshot(), which runs on every
//                                published score and has just computed all three
//   rank                       → the Leaderboard screen, which has the sorted
//                                board in memory and therefore knows the position
//
// They are mirrored here rather than read live because the alternatives are
// expensive: the streak lives inside a 180-day analytics document, and a rank
// means reading the whole board — up to 300 documents — every time the Profile
// tab is opened. Mirroring turns both into fields of a document the app already
// loads at start.
//
// IMPORTANT: `stats` is a MAP, and the REST client derives updateMask.fieldPaths
// from the top-level keys it is handed, so a merge write containing `stats`
// REPLACES the whole map. Every write therefore has to send all four numbers,
// which means knowing the ones it is not changing — hence the baseline cache
// below, seeded by the profile read the app already performs at launch.

const statsBaseline = new Map<string, UserStats>();

/** Last known stats map for a user, or null when none has been read yet. */
export function peekUserStats(uid: string): UserStats | null {
  return statsBaseline.get(uid) ?? null;
}

/** Drops the cached baseline. Call with no argument on sign-out. */
export function forgetUserStats(uid?: string): void {
  if (uid) statsBaseline.delete(uid);
  else statsBaseline.clear();
}

function sameStats(a: UserStats, b: UserStats): boolean {
  return (
    a.testsTaken === b.testsTaken &&
    a.streak === b.streak &&
    a.rank === b.rank &&
    a.points === b.points
  );
}

/** A supplied number wins; anything absent or nonsensical keeps the old value. */
function pickStat(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : fallback;
}

/**
 * Merges real numbers into users/{uid}.stats and returns the resulting map.
 *
 * Never throws — every caller is a background job finishing work whose result
 * the user has already seen, so a failed mirror must stay invisible. Returns
 * null only when it could not write, so callers can tell "unchanged" (a map)
 * from "did not happen" (null).
 *
 * A write is skipped entirely when nothing moved. These jobs fire on every
 * publish and every Leaderboard open, and most of the time the numbers are
 * identical to what is already stored.
 */
export async function writeUserStats(
  uid: string,
  patch: Partial<UserStats>,
): Promise<UserStats | null> {
  if (!uid) return null;
  try {
    let baseline = statsBaseline.get(uid);
    if (!baseline) {
      // Only reached when a writer runs before any profile load, which the
      // launch sequence normally prevents. One read, once, per session.
      const doc = await getDocument(userPath(uid)).catch(() => null);
      baseline = toStats(doc?.stats);
    }

    const next: UserStats = {
      testsTaken: pickStat(patch.testsTaken, baseline.testsTaken),
      streak: pickStat(patch.streak, baseline.streak),
      rank: pickStat(patch.rank, baseline.rank),
      points: pickStat(patch.points, baseline.points),
    };

    // Remember the baseline even when we are about to skip, so the one-off read
    // above happens at most once per session.
    statsBaseline.set(uid, baseline);
    if (sameStats(next, baseline)) return next;

    await setDocument(userPath(uid), { stats: next, updatedAt: serverTimestamp() }, { merge: true });
    // Promoted only after the write lands. Caching it up front would make a
    // failed write look identical to a successful one, and every later call
    // would then skip itself as "unchanged" — the numbers would never recover.
    statsBaseline.set(uid, next);
    return next;
  } catch {
    return null;
  }
}

/** 'YYYY-MM-DD' -> a human-friendly label; returns null for missing/invalid input. */
export function formatDob(dob: string | null): string | null {
  if (!dob) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!match) return dob;
  const date = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dob;
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Validates a 'YYYY-MM-DD' string as a real, sensible date of birth. */
export function isValidDob(dob: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!match) return false;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const date = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  // Rejects impossible calendar dates like 2001-02-30, which Date would roll over.
  if (date.getMonth() + 1 !== month || date.getDate() !== day) return false;

  const now = new Date();
  if (date > now) return false;
  return year >= 1900;
}

/** Formats raw digits typed by the user into a 'YYYY-MM-DD' mask. */
export function maskDobInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}


/**
 * Deletes the user's Firestore profile document. Called alongside
 * deleteCurrentAccount() (which only removes the auth identity) so "delete my
 * account" actually removes the stored profile data too, as the privacy policy
 * promises.
 */
export async function deleteUserProfileDoc(uid: string): Promise<void> {
  await deleteDocument(userPath(uid));
}
