// Auth session storage + token refresh, replacing firebase/auth's onAuthStateChanged.
// Tokens are persisted in AsyncStorage; getValidIdToken() refreshes via Google's
// Secure Token API when the cached idToken is near expiry.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebaseEnv } from './env';

const SESSION_KEY = 'loksewa:firebaseSession';
const REFRESH_MARGIN_MS = 5 * 60 * 1000; // refresh 5 min before actual expiry

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

interface StoredSession {
  idToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
  user: AppUser;
}

let cachedSession: StoredSession | null | undefined; // undefined = not yet loaded from storage
let listeners: ((user: AppUser | null) => void)[] = [];
let loadPromise: Promise<StoredSession | null> | null = null;

function notify(user: AppUser | null) {
  for (const listener of listeners) listener(user);
}

async function loadSession(): Promise<StoredSession | null> {
  if (cachedSession !== undefined) return cachedSession;
  if (!loadPromise) {
    loadPromise = AsyncStorage.getItem(SESSION_KEY).then((raw) => {
      cachedSession = raw ? (JSON.parse(raw) as StoredSession) : null;
      return cachedSession;
    });
  }
  return loadPromise;
}

async function persistSession(session: StoredSession | null): Promise<void> {
  cachedSession = session;
  if (session) {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    await AsyncStorage.removeItem(SESSION_KEY);
  }
}

/** Stores a fresh session (after signup/login/refresh) and notifies subscribers. */
export async function setSession(session: {
  idToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  user: AppUser;
}): Promise<void> {
  const stored: StoredSession = {
    idToken: session.idToken,
    refreshToken: session.refreshToken,
    expiresAt: Date.now() + session.expiresInSeconds * 1000,
    user: session.user,
  };
  await persistSession(stored);
  notify(stored.user);
}

/** Clears the session (logout / account deletion) and notifies subscribers. */
export async function clearSession(): Promise<void> {
  await persistSession(null);
  notify(null);
}

/** Updates the cached user profile fields without touching tokens (e.g. after a profile update). */
export async function updateSessionUser(patch: Partial<AppUser>): Promise<void> {
  const session = await loadSession();
  if (!session) return;
  const updated: StoredSession = { ...session, user: { ...session.user, ...patch } };
  await persistSession(updated);
  notify(updated.user);
}

async function refreshIdToken(session: StoredSession): Promise<StoredSession> {
  const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${firebaseEnv.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(session.refreshToken)}`,
  });
  if (!res.ok) {
    await persistSession(null);
    throw new Error('SESSION_EXPIRED');
  }
  const data = await res.json();
  const refreshed: StoredSession = {
    idToken: data.id_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + Number(data.expires_in) * 1000,
    user: session.user,
  };
  await persistSession(refreshed);
  return refreshed;
}

/** Returns a valid idToken for authenticated REST calls, refreshing it if near expiry. Returns null if signed out. */
export async function getValidIdToken(): Promise<string | null> {
  const session = await loadSession();
  if (!session) return null;
  if (session.expiresAt - Date.now() > REFRESH_MARGIN_MS) return session.idToken;
  const refreshed = await refreshIdToken(session);
  return refreshed.idToken;
}

/** Returns the current user's uid, or null if signed out. */
export async function getCurrentUid(): Promise<string | null> {
  const session = await loadSession();
  return session?.user.uid ?? null;
}

/** Returns the current cached user without touching the network. */
export async function getCurrentUser(): Promise<AppUser | null> {
  const session = await loadSession();
  return session?.user ?? null;
}

/**
 * Subscribes to auth state changes. Immediately invokes the callback with the
 * current session (rehydrated from storage), mirroring onAuthStateChanged's
 * initial-call behavior. Returns an unsubscribe function.
 */
export function subscribeToAuthChanges(callback: (user: AppUser | null) => void): () => void {
  listeners.push(callback);
  loadSession().then((session) => callback(session?.user ?? null));
  return () => {
    listeners = listeners.filter((l) => l !== callback);
  };
}
