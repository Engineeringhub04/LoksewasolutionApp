// Google Sign-In via expo-auth-session (Expo Go compatible — no native Google Sign-In module).
// Requires EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (Firebase Console → Authentication →
// Sign-in method → Google → Web SDK configuration → Web client ID).
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { firebaseEnv } from './env';

WebBrowser.maybeCompleteAuthSession();

/** Returns [request, response, promptAsync]. response.params.id_token feeds signInWithGoogleIdToken(). */
export function useGoogleAuthRequest() {
  return Google.useIdTokenAuthRequest({
    clientId: firebaseEnv.googleWebClientId,
  });
}
