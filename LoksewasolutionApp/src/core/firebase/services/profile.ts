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
// `stats` is written as zeroes for now — the real values need attempt
// aggregation that doesn't exist yet, so the UI shows 0 rather than inventing
// numbers. Wiring it up later only means updating this one file.
import { getDocument, setDocument, deleteDocument, serverTimestamp } from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';

export type Gender = 'male' | 'female' | 'other';

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
  courseId: string | null;
  subcourseId: string | null;
  stats: UserStats;
  /**
   * Read-only here — firebase.rules forbids a client from ever writing this
   * field (see users/{userId} create/update rules), so it can only be set by
   * an admin editing Firestore directly. Gates the Admin Answer Review desk.
   */
  isAdmin: boolean;
}

export const EMPTY_STATS: UserStats = { testsTaken: 0, streak: 0, rank: 0, points: 0 };

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

  return {
    uid,
    name,
    firstName: storedFirst || derived.firstName,
    lastName: storedLast || derived.lastName,
    email: (doc.email as string | undefined) ?? null,
    dob: (doc.dob as string | undefined) ?? null,
    gender: toGender(doc.gender),
    photoURL: (doc.photoURL as string | undefined) ?? null,
    courseId: (doc.courseId as string | undefined) ?? null,
    subcourseId: (doc.subcourseId as string | undefined) ?? null,
    stats: toStats(doc.stats),
    isAdmin: doc.role === 'admin',
  };
}

export interface UpdateUserProfileInput {
  firstName: string;
  lastName: string;
  dob: string | null;
  gender: Gender | null;
  photoURL: string | null;
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
