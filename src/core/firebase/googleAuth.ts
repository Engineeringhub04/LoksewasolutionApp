// Google Sign-In via expo-auth-session.
// Expo Go uses the legacy Expo AuthSession proxy as a compatibility fallback.
// Development/standalone builds use the app's own deep-link scheme and native
// Google client IDs. The same hook is used by Login and Sign Up.
import { useEffect, useRef } from 'react';
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
type GoogleSuccessResponse = {
  type: 'success';
  params: Record<string, string>;
  errorCode: string | null;
  error?: unknown;
  authentication: unknown;
  url: string;
};

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

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * Returns [request, response, promptAsync]. The request explicitly uses the
 * OAuth implicit ID-token response so Expo Go never calls Google's token
 * endpoint and never needs a client_secret. The native build uses its native
 * client ID but the same public response flow, so no environment code switch
 * is required.
 */
export function useGoogleAuthRequest() {
  const runningInExpoGo = isExpoGo();
  const expoProxyRedirectUri = runningInExpoGo ? getExpoProxyRedirectUri() : null;
  const redirectUri = runningInExpoGo
    ? expoProxyRedirectUri!
    : makeRedirectUri({ scheme: APP_SCHEME, path: 'oauthredirect' });
  const responseRef = useRef<unknown>(null);

  const [request, response, promptAsync] = Google.useAuthRequest(
    runningInExpoGo
      ? {
          // Expo Go must use the Web client because its temporary exp:// URI is
          // not a native Android/iOS redirect.
          clientId: firebaseEnv.googleWebClientId,
          redirectUri,
          responseType: ResponseType.IdToken,
          selectAccount: true,
        }
      : {
          // Native builds select androidClientId or iosClientId based on the
          // platform. Web client remains as a safe fallback for development.
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

  const promptGoogleAuth = async () => {
    responseRef.current = null;

    let promptResult: AuthSessionResult;
    if (!runningInExpoGo) {
      promptResult = await promptAsync();
    } else {
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
      promptResult = await promptAsync({ url: proxyStartUrl });
    }

    // The implicit response should contain the ID token directly. Keep a short
    // response-state wait for browsers/proxies that complete the redirect one
    // render after promptAsync resolves.
    if (promptResult.type !== 'success' || promptResult.params?.id_token) {
      return promptResult;
    }

    const deadline = Date.now() + TOKEN_WAIT_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const processedResponse = responseRef.current as GoogleSuccessResponse | null;
      if (processedResponse && processedResponse.params.id_token) {
        return processedResponse;
      }
      await wait(TOKEN_WAIT_INTERVAL_MS);
    }

    // Return the latest result so the auth screen can show its normal error
    // message instead of silently remaining on the login page.
    return (responseRef.current as GoogleSuccessResponse | null) ?? promptResult;
  };

  return [request, response, promptGoogleAuth] as const;
}
