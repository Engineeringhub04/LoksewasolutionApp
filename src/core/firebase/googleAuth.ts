// Google Sign-In via expo-auth-session.
// Expo Go uses the legacy Expo AuthSession proxy as a compatibility fallback.
// Development/standalone builds use the app's own deep-link scheme and native
// Google client IDs. The same hook is used by Login and Sign Up.
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { getRedirectUrl, makeRedirectUri } from 'expo-auth-session';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { firebaseEnv } from './env';

WebBrowser.maybeCompleteAuthSession();

const APP_SCHEME = 'loksewasolutionapp';
const EXPO_PROJECT_FULL_NAME = '@mrchettry/LoksewasolutionApp';

function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

function getExpoProxyRedirectUri(): string {
  try {
    // Deprecated by Expo, but retained only for Expo Go compatibility testing.
    return getRedirectUrl();
  } catch {
    // The explicit fallback keeps the URI stable if Expo Go does not expose
    // originalFullName from the project manifest.
    return `https://auth.expo.io/${EXPO_PROJECT_FULL_NAME}`;
  }
}

/**
 * Returns [request, response, promptAsync]. The response contains an id_token
 * which feeds signInWithGoogleIdToken(). Expo Go uses the Web OAuth client and
 * the legacy Expo proxy; native builds use the platform-specific client IDs and
 * the app's custom scheme. No environment-specific source change is required.
 */
export function useGoogleAuthRequest() {
  const runningInExpoGo = isExpoGo();
  const expoProxyRedirectUri = runningInExpoGo ? getExpoProxyRedirectUri() : null;
  const redirectUri = runningInExpoGo
    ? expoProxyRedirectUri!
    : makeRedirectUri({ scheme: APP_SCHEME, path: 'oauthredirect' });

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(
    runningInExpoGo
      ? {
          // Expo Go must use the Web client because its temporary exp:// URI is
          // not a native Android/iOS redirect.
          clientId: firebaseEnv.googleWebClientId,
          redirectUri,
          selectAccount: true,
        }
      : {
          // Native builds select androidClientId or iosClientId based on the
          // platform. Web client remains as a safe fallback for development.
          clientId: firebaseEnv.googleWebClientId,
          iosClientId: firebaseEnv.googleIosClientId || undefined,
          androidClientId: firebaseEnv.googleAndroidClientId || undefined,
          redirectUri,
          selectAccount: true,
        }
  );

  const promptGoogleAuth = async () => {
    if (!runningInExpoGo) {
      return promptAsync();
    }

    if (!request) {
      throw new Error('Google authentication request is still loading.');
    }

    // The proxy /start endpoint remembers the Expo Go return URL, forwards the
    // user to Google, and then sends the OAuth result back to the running app.
    const authUrl = request.url ?? (await request.makeAuthUrlAsync(Google.discovery));
    const returnUrl = makeRedirectUri({ scheme: APP_SCHEME });
    const proxyStartUrl = `${expoProxyRedirectUri}/start?${new URLSearchParams({
      authUrl,
      returnUrl,
    }).toString()}`;

    return promptAsync({ url: proxyStartUrl });
  };

  return [request, response, promptGoogleAuth] as const;
}
