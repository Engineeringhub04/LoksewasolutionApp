// Google Sign-In adapter.
// Expo Go keeps the browser/proxy fallback. Android Development/Production builds
// use the native Google account chooser so the user does not leave the app.
// iOS keeps the existing browser-based AuthSession flow because its system Google
// authentication window is the supported native experience for this project.
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { getRedirectUrl, makeRedirectUri, ResponseType } from 'expo-auth-session';
import type { AuthSessionResult } from 'expo-auth-session';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { firebaseEnv } from './env';

WebBrowser.maybeCompleteAuthSession();

const APP_SCHEME = 'loksewasolutionapp';
const EXPO_PROJECT_FULL_NAME = '@mrchettry/LoksewasolutionApp';
const TOKEN_WAIT_TIMEOUT_MS = 10000;
const TOKEN_WAIT_INTERVAL_MS = 100;
function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

function isNativeAndroid(): boolean {
  return Platform.OS === 'android' && !isExpoGo();
}

function getExpoProxyRedirectUri(): string {
  try {
    // Deprecated by Expo, but retained only for Expo Go compatibility testing.
    return getRedirectUrl();
  } catch {
    return `https://auth.expo.io/${EXPO_PROJECT_FULL_NAME}`;
  }
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function makeIdTokenResult(idToken: string): AuthSessionResult {
  return {
    type: 'success',
    params: { id_token: idToken },
    authentication: null,
    errorCode: null,
    error: null,
    url: '',
  } as AuthSessionResult;
}

function makeCancelledResult(): AuthSessionResult {
  return { type: 'cancel' } as AuthSessionResult;
}

/**
 * The native package is loaded only in a native Android build. Keeping this as a
 * dynamic import is important: Expo Go does not contain the native module and
 * must continue using the AuthSession browser fallback.
 */
async function signInWithNativeAndroid(): Promise<AuthSessionResult> {
  const { GoogleSignin, statusCodes } = await import('@react-native-google-signin/google-signin');

  try {
    GoogleSignin.configure({
      webClientId: firebaseEnv.googleWebClientId,
      offlineAccess: false,
    });
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    const signInResult = await GoogleSignin.signIn();
    if (signInResult.type !== 'success') {
      return makeCancelledResult();
    }

    // getTokens() is used instead of trusting the profile payload because the
    // Firebase REST signInWithIdp endpoint requires the Google ID token itself.
    const idToken = signInResult.data.idToken ?? (await GoogleSignin.getTokens()).idToken;
    if (!idToken) {
      throw new Error('auth/google-id-token-missing');
    }
    return makeIdTokenResult(idToken);
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code;
    if (code === statusCodes.SIGN_IN_CANCELLED) {
      return makeCancelledResult();
    }
    throw error;
  }
}

/**
 * Returns [request, response, promptAsync]. Android native builds use the
 * in-app Google account chooser. Expo Go and iOS use the browser AuthSession
 * flow, preserving the existing testing and iOS behavior.
 */
export function useGoogleAuthRequest() {
  const runningInExpoGo = isExpoGo();
  const nativeAndroid = isNativeAndroid();
  const expoProxyRedirectUri = runningInExpoGo ? getExpoProxyRedirectUri() : null;
  const redirectUri = runningInExpoGo
    ? expoProxyRedirectUri!
    : makeRedirectUri({ scheme: APP_SCHEME, path: 'oauthredirect' });
  const responseRef = useRef<AuthSessionResult | null>(null);

  const [request, response, promptAsync] = Google.useAuthRequest(
    runningInExpoGo
      ? {
          clientId: firebaseEnv.googleWebClientId,
          redirectUri,
          responseType: ResponseType.IdToken,
          selectAccount: true,
        }
      : {
          clientId: firebaseEnv.googleWebClientId,
          iosClientId: firebaseEnv.googleIosClientId || undefined,
          androidClientId: firebaseEnv.googleAndroidClientId || undefined,
          redirectUri,
          responseType: ResponseType.IdToken,
          selectAccount: true,
        }
  );

  useEffect(() => {
    if (response?.type === 'success') {
      responseRef.current = response;
    }
  }, [response]);

  const promptGoogleAuth = async (): Promise<AuthSessionResult> => {
    if (nativeAndroid) {
      return signInWithNativeAndroid();
    }

    responseRef.current = null;

    let promptResult: AuthSessionResult;
    if (!runningInExpoGo) {
      promptResult = await promptAsync();
    } else {
      if (!request) {
        throw new Error('Google authentication request is still loading.');
      }

      const authUrl = request.url ?? (await request.makeAuthUrlAsync(Google.discovery));
      const returnUrl = makeRedirectUri({ scheme: APP_SCHEME });
      const proxyStartUrl = `${expoProxyRedirectUri}/start?${new URLSearchParams({
        authUrl,
        returnUrl,
      }).toString()}`;
      promptResult = await promptAsync({ url: proxyStartUrl });
    }

    if (promptResult.type !== 'success' || promptResult.params?.id_token) {
      return promptResult;
    }

    const deadline = Date.now() + TOKEN_WAIT_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const processedResponse = responseRef.current as unknown as {
        type?: string;
        params?: Record<string, string>;
      } | null;
      if (processedResponse?.type === 'success' && processedResponse.params?.id_token) {
        return processedResponse as AuthSessionResult;
      }
      await wait(TOKEN_WAIT_INTERVAL_MS);
    }

    return responseRef.current ?? promptResult;
  };

  return [request, response, promptGoogleAuth] as const;
}

/**
 * Clears the native Android Google account session when the app logs out. The
 * dynamic import keeps Expo Go and iOS browser flows unaffected.
 */
export async function signOutNativeGoogleIfAvailable(): Promise<void> {
  if (!isNativeAndroid()) return;
  try {
    const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
    await GoogleSignin.signOut();
  } catch {
    // Firebase/local session logout must still complete if Google sign-out fails.
  }
}
