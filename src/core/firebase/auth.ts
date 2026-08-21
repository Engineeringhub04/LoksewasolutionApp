// Firebase Identity Toolkit REST API wrapper. Replaces firebase/auth SDK calls with
// hand-rolled fetch() requests. Exported function signatures match the original
// SDK-based auth.ts exactly, so no call site outside this file needs to change.
import { firebaseEnv } from './env';
import { signOutNativeGoogleIfAvailable } from './googleAuth';
import { setSession, clearSession, updateSessionUser, getValidIdToken, subscribeToAuthChanges as subscribeToSessionChanges, type AppUser } from './session';
import { getDocument, setDocument, serverTimestamp } from './firestoreRest';
import { Collections } from './collections';

const IDENTITY_URL = 'https://identitytoolkit.googleapis.com/v1/accounts';

// Identity Toolkit returns a message string (e.g. "EMAIL_EXISTS") instead of the SDK's
// `auth/*` error codes. This map keeps that `.code` shape so existing UI checks
// (e.g. signup.tsx's `code === 'auth/email-already-in-use'`) keep working unmodified.
const ERROR_CODE_MAP: Record<string, string> = {
  EMAIL_EXISTS: 'auth/email-already-in-use',
  EMAIL_NOT_FOUND: 'auth/invalid-credential',
  INVALID_PASSWORD: 'auth/invalid-credential',
  INVALID_LOGIN_CREDENTIALS: 'auth/invalid-credential',
  FEDERATED_USER_ID_ALREADY_LINKED: 'auth/account-exists-with-different-credential',
  USER_DISABLED: 'auth/user-disabled',
  WEAK_PASSWORD: 'auth/weak-password',
  TOO_MANY_ATTEMPTS_TRY_LATER: 'auth/too-many-requests',
  INVALID_EMAIL: 'auth/invalid-email',
};

class AuthError extends Error {
  code: string;
  constructor(rawMessage: string) {
    const code = ERROR_CODE_MAP[rawMessage] ?? 'auth/unknown-error';
    super(code);
    this.code = code;
  }
}

async function identityRequest<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${IDENTITY_URL}:${endpoint}?key=${firebaseEnv.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new AuthError(data?.error?.message ?? 'UNKNOWN_ERROR');
  return data as T;
}

interface IdentityAuthResponse {
  idToken: string;
  refreshToken: string;
  expiresIn: string;
  localId: string;
  email?: string;
  displayName?: string;
  photoUrl?: string;
  errorMessage?: string;
  pendingToken?: string;
  isNewUser?: boolean;
}

function toAppUser(res: IdentityAuthResponse): AppUser {
  return {
    uid: res.localId,
    email: res.email ?? null,
    displayName: res.displayName ?? null,
    photoURL: res.photoUrl ?? null,
  };
}

async function storeSession(res: IdentityAuthResponse, override?: Partial<AppUser>): Promise<AppUser> {
  const user = { ...toAppUser(res), ...override };
  await setSession({ idToken: res.idToken, refreshToken: res.refreshToken, expiresInSeconds: Number(res.expiresIn), user });
  return user;
}

async function ensureUserDoc(user: AppUser, extra?: Record<string, unknown>) {
  await setDocument(
    `${Collections.users}/${user.uid}`,
    {
      uid: user.uid,
      name: user.displayName ?? extra?.name ?? '',
      email: user.email,
      photoURL: user.photoURL ?? null,
      photoURLSource: extra?.photoURLSource ?? (user.photoURL ? 'google' : 'none'),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...extra,
    },
    { merge: true }
  );
}

export function subscribeToAuthChanges(callback: (user: AppUser | null) => void) {
  return subscribeToSessionChanges(callback);
}

export async function registerWithEmail(name: string, email: string, password: string): Promise<AppUser> {
  const res = await identityRequest<IdentityAuthResponse>('signUp', { email, password, returnSecureToken: true });
  await identityRequest('update', { idToken: res.idToken, displayName: name, returnSecureToken: false });
  const user = await storeSession({ ...res, displayName: name });
  await ensureUserDoc(user, { name });
  return user;
}

export async function loginWithEmail(email: string, password: string): Promise<AppUser> {
  const res = await identityRequest<IdentityAuthResponse>('signInWithPassword', { email, password, returnSecureToken: true });
  return storeSession(res);
}

export async function logout(): Promise<void> {
  await signOutNativeGoogleIfAvailable();
  await clearSession();
}

/**
 * Sends the password reset email. `canHandleCodeInApp` + the continue params make the
 * link open directly in this app (deep link to /reset-password) instead of a browser
 * page, PROVIDED that Firebase Console → Authentication → Templates → Password reset →
 * "Customize action URL" is NOT set, and "Handle these actions in my app" toggle in the
 * same template's Action mode is switched on with a valid Dynamic Link / App Link config.
 * Without that console configuration, the email link falls back to Firebase's hosted page.
 */
export async function sendResetPasswordEmail(email: string): Promise<void> {
  await identityRequest('sendOobCode', {
    requestType: 'PASSWORD_RESET',
    email,
    canHandleCodeInApp: true,
    continueUrl: `https://${firebaseEnv.authDomain}/reset-password`,
    androidPackageName: 'com.loksewasolutionnp.hub',
    androidInstallApp: true,
    androidMinimumVersion: '1',
    iOSBundleId: 'com.loksewasolutionnp.hub',
  });
}

/** Completes a password reset using the oobCode from the email link. */
export async function confirmPasswordReset(oobCode: string, newPassword: string): Promise<void> {
  await identityRequest('resetPassword', { oobCode, newPassword });
}

export async function deleteCurrentAccount(): Promise<void> {
  const idToken = await getValidIdToken();
  if (!idToken) return;
  await identityRequest('delete', { idToken });
  await clearSession();
}

/** Result of exchanging a Google ID token for a Firebase session. */
export interface GoogleSignInResult {
  user: AppUser;
  /** True only when Firebase created this account during the current sign-in. */
  isNewUser: boolean;
}

/** Exchanges a Google ID token and returns account-creation metadata for routing. */
export async function signInWithGoogleIdTokenResult(idToken: string): Promise<GoogleSignInResult> {
  const res = await identityRequest<IdentityAuthResponse>('signInWithIdp', {
    // Keep Google OAuth tokens URL-safe when sending the REST postBody.
    postBody: `id_token=${encodeURIComponent(idToken)}&providerId=google.com`,
    requestUri: 'http://localhost',
    returnSecureToken: true,
    // This is a direct ID-token sign-in, not an account-linking attempt. If
    // the same Google account signs in again, Firebase should issue its
    // existing session instead of returning FEDERATED_USER_ID_ALREADY_LINKED.
    returnIdpCredential: false,
    autoCreate: true,
  });

  // With one-account-per-email enabled, Firebase can return a successful HTTP
  // response containing EMAIL_EXISTS instead of issuing a second account. A
  // Google credential cannot silently authenticate an email/password account;
  // the user must use that account's password to log in and link providers.
  if (res.errorMessage === 'EMAIL_EXISTS' || res.errorMessage === 'FEDERATED_USER_ID_ALREADY_LINKED') {
    const error = new Error('auth/account-exists-with-different-credential') as Error & { code: string };
    error.code = 'auth/account-exists-with-different-credential';
    throw error;
  }

  if (!res.idToken || !res.refreshToken || !res.localId) {
    throw new Error('auth/google-token-exchange-failed');
  }

  // Preserve a manually uploaded photo from the profile document. Older user
  // documents without photoURLSource are treated as manual when they already
  // contain a non-empty photoURL, so this remains backward compatible.
  const existingProfile = await getDocument(`${Collections.users}/${res.localId}`).catch(() => null);
  const existingPhoto = typeof existingProfile?.photoURL === 'string' ? existingProfile.photoURL : null;
  const existingPhotoSource = existingProfile?.photoURLSource;
  const hasManualPhoto = Boolean(
    existingPhoto && existingPhotoSource !== 'google' && existingPhotoSource !== 'none'
  );

  const user = await storeSession(res, hasManualPhoto ? { photoURL: existingPhoto } : undefined);
  // Firebase already returns the existing session for a repeated Google IdP
  // sign-in. Only create the Firestore profile document for a genuinely new
  // Google account; rewriting `createdAt` on every re-login can be rejected by
  // Firestore rules and incorrectly surface as a Google sign-in failure.
  if (res.isNewUser) {
    await ensureUserDoc(user, { photoURLSource: user.photoURL ? 'google' : 'none' });
  }
  return { user, isNewUser: res.isNewUser === true };
}

/** Backward-compatible Google sign-in helper for callers that only need the user. */
export async function signInWithGoogleIdToken(idToken: string): Promise<AppUser> {
  const { user } = await signInWithGoogleIdTokenResult(idToken);
  return user;
}

/** Updates the signed-in user's profile. Replaces firebase/auth's updateProfile(). */
export async function updateCurrentUserProfile(patch: { displayName?: string; photoURL?: string | null }): Promise<void> {
  const idToken = await getValidIdToken();
  if (!idToken) return;
  await identityRequest('update', {
    idToken,
    ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
    ...(patch.photoURL !== undefined ? { photoUrl: patch.photoURL } : {}),
    returnSecureToken: false,
  });
  await updateSessionUser({
    ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
    ...(patch.photoURL !== undefined ? { photoURL: patch.photoURL } : {}),
  });
}
