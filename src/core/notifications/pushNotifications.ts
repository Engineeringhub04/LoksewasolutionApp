// Push-notification setup for the app (Expo push, Spark-plan friendly — no Cloud
// Functions/Blaze needed; the admin website sends via the Expo Push API).
//
// TWO audiences, by design:
//   • Signed-IN users  → token saved to users/{uid}/push_tokens/{deviceId}. They
//     ALSO have an in-app inbox (users/{uid}/notifications) written by the admin.
//   • Signed-OUT users → cannot reach Home, so they have no inbox. Their token is
//     saved to app_device_push_tokens/{deviceId} and they receive TRAY push only.
// A device's token lives in exactly one place at a time: on sign-in we move it to
// the user doc and delete the anonymous row; on sign-out we do the reverse. This
// keeps a single source of truth per device and lets a broadcast hit everyone
// (all user tokens + all anonymous tokens) without double-sending.
//
// IMPORTANT: Expo push tokens require a real development/production build (EAS).
// Expo Go on SDK 54 does not support remote push, so registration is a no-op in
// that environment — nothing here throws, it just skips.
import { Platform } from 'react-native';
import type * as NotificationsModule from 'expo-notifications';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
const isExpoGo =
  Constants.appOwnership === 'expo' ||
  (Constants as unknown as { executionEnvironment?: string }).executionEnvironment === 'storeClient';

const Notifications: typeof NotificationsModule | null = isExpoGo
  ? null
  : require('expo-notifications');



import { AppConfig } from '@/src/core/config/appConfig';
import { Collections } from '@/src/core/firebase/collections';
import { setDocument, deleteDocument, serverTimestamp } from '@/src/core/firebase/firestoreRest';
import { getDeviceInstallationId } from '@/src/core/notifications/deviceId';

// Android requires an explicit channel for notifications to appear with the
// intended importance/sound. Created once at startup; safe to call repeatedly.
const ANDROID_CHANNEL_ID = 'default';

// Foreground presentation: when a push arrives while the app is open we still
// want the banner + list entry + a subtle badge/sound, matching user expectation
// on both platforms.
if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

let registered = false;

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android' || !Notifications) return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'General',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: AppConfig.branding.primary,
    sound: 'default',
  });
}

/** Resolves the EAS projectId needed by getExpoPushTokenAsync in a bare/dev build. */
function getProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId
  );
}

/**
 * Requests permission and returns this device's Expo push token, or null if the
 * user declined, we're on a simulator, or we're in an environment (Expo Go) that
 * cannot mint one. Never throws.
 */
export async function getExpoPushToken(): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      if (__DEV__) console.warn('[push] No token: not a physical device — emulators/simulators cannot receive push.');
      return null; // simulators/emulators can't receive push
    }

    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== 'granted') {
      if (__DEV__) console.warn('[push] No token: notification permission was not granted.');
      return null;
    }

    const projectId = getProjectId();
    if (!projectId && __DEV__) {
      // This is the usual reason users/{uid}/push_tokens stays empty: with no
      // EAS projectId, getExpoPushTokenAsync throws below and we return null, so
      // nothing is ever written. Run `eas init` to add expo.extra.eas.projectId
      // to app.json, then use an EAS dev/prod build (Expo Go on SDK 54 cannot
      // mint remote push tokens even with a projectId).
      console.warn(
        '[push] No EAS projectId found (app.json → expo.extra.eas.projectId is missing). ' +
          'Push token cannot be minted. Run `eas init`, then rebuild with an EAS build.',
      );
    }
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    if (__DEV__) console.log('[push] Expo push token acquired:', tokenResponse.data);
    return tokenResponse.data ?? null;
  } catch (e) {
    // Expo Go on SDK 54, missing projectId in a bare build, or transient failure —
    // registration is best-effort and must never break app startup.
    if (__DEV__) console.warn('[push] getExpoPushTokenAsync failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

interface SaveTokenArgs {
  token: string;
  language?: string | null;
}

function tokenPayload(deviceId: string, token: string, language?: string | null) {
  return {
    deviceId,
    token,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    language: language ?? null,
    appVersion: AppConfig.identity.version,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

/**
 * Persists this device's push token for a SIGNED-IN user and removes any
 * leftover anonymous row for the same device (so a broadcast never double-hits).
 */
export async function saveTokenForUser(uid: string, { token, language }: SaveTokenArgs): Promise<void> {
  const deviceId = await getDeviceInstallationId();
  await setDocument(
    `${Collections.userPushTokens(uid)}/${deviceId}`,
    tokenPayload(deviceId, token, language),
    { merge: true }
  );
  // Best-effort cleanup of the anonymous row this device may have written while
  // signed out. A failure here is harmless (worst case: one extra broadcast row).
  try {
    await deleteDocument(`${Collections.devicePushTokens}/${deviceId}`);
  } catch {
    /* ignore */
  }
}

/**
 * Persists this device's push token anonymously (SIGNED-OUT). Keyed by the stable
 * installation id so re-registration overwrites in place.
 */
export async function saveTokenForAnonymous({ token, language }: SaveTokenArgs): Promise<void> {
  const deviceId = await getDeviceInstallationId();
  await setDocument(
    `${Collections.devicePushTokens}/${deviceId}`,
    tokenPayload(deviceId, token, language),
    { merge: true }
  );
}

/** Removes this device's token from a user's subcollection (call on sign-out). */
export async function removeTokenForUser(uid: string): Promise<void> {
  try {
    const deviceId = await getDeviceInstallationId();
    await deleteDocument(`${Collections.userPushTokens(uid)}/${deviceId}`);
  } catch {
    /* ignore — token will simply expire on Expo's side */
  }
}

/**
 * Registers this device for push and stores the token in the right place for the
 * current auth state. Call on startup and again whenever the signed-in uid
 * changes. `uid` null → anonymous. Returns the token (or null if unavailable).
 */
export async function registerPushToken(uid: string | null, language?: string | null): Promise<string | null> {
  const token = await getExpoPushToken();
  if (!token) return null;
  try {
    if (uid) {
      await saveTokenForUser(uid, { token, language });
    } else {
      await saveTokenForAnonymous({ token, language });
    }
    registered = true;
    if (__DEV__) console.log(`[push] token saved for ${uid ? `user ${uid}` : 'anonymous device'}.`);
  } catch (e) {
    /* best-effort: a write failure must not break startup */
    if (__DEV__) console.warn('[push] token write failed:', e instanceof Error ? e.message : e);
  }
  return token;
}

export function hasRegistered(): boolean {
  return registered;
}

/**
 * The `data` object an Expo push carries, reduced to the two fields this app
 * actually acts on.
 *
 * Almost every push is an inbox item: it has a `deepLink` and no `type`, and
 * tapping it opens a screen. A `type` marks the exception — a control message
 * that exists to make the app DO something rather than to be read. Keeping both
 * on one object means a listener can tell those apart without re-parsing the
 * raw notification.
 */
export interface PushPayload {
  /** In-app route to open on tap. Null on control messages. */
  deepLink: string | null;
  /** Control-message kind, e.g. 'session-evicted'. Null on ordinary pushes. */
  type: string | null;
}

export interface NotificationListeners {
  /** Fired when a notification is tapped (foreground, background, or cold start). */
  onResponse: (payload: PushPayload) => void;
  /** Fired when a push ARRIVES while the app is foregrounded (not tapped). Used to
   *  bump the Home bell in real time, since Firestore here is REST-only (no
   *  onSnapshot) and nothing else would update the count until a manual refresh. */
  onReceived?: (payload: PushPayload) => void;
}

/**
 * Wires the received + tapped listeners and handles a cold-start tap (app opened
 * from a killed state by tapping a push). Returns a disposer that removes both
 * subscriptions. The deep link, if any, is read from the notification's
 * `data.deepLink` — the same field the in-app inbox uses — so tapping a tray push
 * lands on the same screen as tapping the inbox row.
 */
export function attachNotificationListeners({ onResponse, onReceived }: NotificationListeners): () => void {
  if (!Notifications) {
    if (__DEV__) {
      console.log('[push] Expo Go — notification listeners skipped.');
    }
    return () => {};
  }

  const readPayload = (data: unknown): PushPayload => {


    
    const fields = (data ?? {}) as { deepLink?: unknown; type?: unknown };
    return {
      deepLink: typeof fields.deepLink === 'string' ? fields.deepLink : null,
      type: typeof fields.type === 'string' ? fields.type : null,
    };
  };

  const fromResponse = (response: Notifications.NotificationResponse | null): PushPayload =>
    readPayload(response?.notification.request.content.data);

  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    onResponse(fromResponse(response));
  });

  // Foreground arrival (push received, NOT tapped) → bump the bell live.
  const receivedSub = onReceived
    ? Notifications.addNotificationReceivedListener((notification) => {
        onReceived(readPayload(notification.request.content.data));
      })
    : null;

  // Cold start: the app was launched by tapping a notification.
  void Notifications.getLastNotificationResponseAsync().then((response) => {
    if (!response) return;
    onResponse(fromResponse(response));
  });

  return () => {
    responseSub.remove();
    receivedSub?.remove();
  };
}
