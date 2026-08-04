// Google Sign-In via expo-auth-session.
// IMPORTANT: Expo Go cannot reliably complete Google OAuth (Expo's auth.expo.io
// proxy is deprecated). This requires a Development Build (EAS build or
// `npx expo run:android` / `run:ios`) with proper Android/iOS OAuth Client IDs
// configured in Google Cloud Console (see README "Google Sign-In Setup").
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import { firebaseEnv } from './env';

WebBrowser.maybeCompleteAuthSession();

/**
 * Returns [request, response, promptAsync]. response.params.id_token feeds
 * signInWithGoogleIdToken(). Uses the platform-specific client ID when available
 * (required for native redirect in a Development Build / standalone app), falling
 * back to the Web Client ID for Expo Go (limited reliability).
 */
export function useGoogleAuthRequest() {
  const redirectUri = makeRedirectUri({
    scheme: 'loksewasolutionapp',
  });

  return Google.useIdTokenAuthRequest({
    clientId: firebaseEnv.googleWebClientId,
    iosClientId: firebaseEnv.googleIosClientId || undefined,
    androidClientId: firebaseEnv.googleAndroidClientId || undefined,
    redirectUri,
  });
}
