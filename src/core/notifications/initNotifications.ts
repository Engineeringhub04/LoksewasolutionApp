// Startup controller for push notifications. Kept out of pushNotifications.ts so
// that module stays a pure toolbox (permission/token/save) and this one owns the
// app-lifecycle wiring: register on launch, re-register when the signed-in uid
// changes (login moves the token to the user doc, logout back to anonymous), and
// route notification taps.
//
// Wired once from the root layout, exactly like initAuthListener/initNetworkListener.
import { subscribeToAuthChanges } from '@/src/core/firebase/session';
import {
  registerPushToken,
  removeTokenForUser,
  attachNotificationListeners,
} from '@/src/core/notifications/pushNotifications';
import { clearExamSetNotifications } from '@/src/core/notifications/examScheduler';
import { fetchUserProfile } from '@/src/core/firebase/services/profile';
import {
  EVICTION_PUSH_TYPE,
  requestDeviceSessionRecheck,
} from '@/src/core/firebase/services/deviceSession';
import {
  registerAdminAlertDevice,
  unregisterAdminAlertDevice,
} from '@/src/core/messaging/adminAlerts';

interface InitArgs {
  /** Current UI language, stored with the token so the admin can segment sends. */
  getLanguage: () => string | null;
  /** Navigate to a deep link when a notification is tapped. */
  onDeepLink: (deepLink: string) => void;
  /** Fired when a push arrives while the app is foregrounded — bumps the bell. */
  onReceived?: () => void;
}

let started = false;

/**
 * True once THIS device has handed its token to the admin-alert relay. Used only
 * to decide whether signing out needs to withdraw it, so a normal user's logout
 * does not POST to the relay at all. If the flag is lost (process killed between
 * sign-in and sign-out) the relay's own 120-day TTL and DeviceNotRegistered
 * cleanup remove the entry instead.
 */
let adminDeviceRegistered = false;

/**
 * Admins receive "a user filed a report" pushes through a small Apps Script relay
 * that holds the admin tokens (see src/core/messaging/adminAlerts.ts for why it
 * cannot be done directly). The relay only learns about a device when the device
 * itself checks in — which is what this does, right after the normal token save.
 *
 * Best-effort throughout: a non-admin, a missing profile, or an offline relay all
 * end as a silent no-op. Nothing here can block or break sign-in.
 */
async function syncAdminAlertDevice(uid: string, token: string | null): Promise<void> {
  if (!token) return;
  const profile = await fetchUserProfile(uid).catch(() => null);
  if (!profile?.isAdmin) return;
  await registerAdminAlertDevice({ token, uid, name: profile.name });
  adminDeviceRegistered = true;
}

/**
 * Initializes push notifications. Idempotent — safe to call once from the root
 * layout. Returns a disposer that tears down every subscription.
 */
export function initNotifications({ getLanguage, onDeepLink, onReceived }: InitArgs): () => void {
  if (started) return () => undefined;
  started = true;

  // One-time migration cleanup: old builds may have scheduled a local exam-live
  // notification. Central remote push now owns this event, so remove stale local
  // schedules at every app launch to prevent a duplicate at exam start.
  void clearExamSetNotifications();

  let currentUid: string | null | undefined; // undefined = first callback not seen yet

  // Register (or re-register) whenever the auth state settles or flips. On the
  // very first callback we always register; afterwards only when the uid actually
  // changes, so a token refresh from an unrelated auth event doesn't spam writes.
  const unsubAuth = subscribeToAuthChanges((user) => {
    const nextUid = user?.uid ?? null;
    const previousUid = currentUid;
    if (previousUid === nextUid) return;
    currentUid = nextUid;

    // Moving away from a signed-in account: drop that device's user-scoped token
    // so a broadcast to that user no longer reaches this device.
    if (previousUid) {
      void removeTokenForUser(previousUid);
      // Same reasoning for admin alerts — a handed-on or shared phone must stop
      // receiving other people's reports the moment the admin signs out.
      if (adminDeviceRegistered) {
        adminDeviceRegistered = false;
        void unregisterAdminAlertDevice();
      }
    }

    void registerPushToken(nextUid, getLanguage())
      .then((token) => {
        if (nextUid) return syncAdminAlertDevice(nextUid, token);
        return undefined;
      })
      .catch(() => undefined);
  });

  const detachListeners = attachNotificationListeners({
    onResponse: ({ deepLink, type }) => {
      // A tapped eviction notice opens the app and nothing else: the splash
      // screen is about to read the claim document and route to login, so there
      // is no screen worth navigating to. The recheck is still fired for the
      // case where the app was merely backgrounded and no splash will run.
      if (type === EVICTION_PUSH_TYPE) {
        requestDeviceSessionRecheck();
        return;
      }
      if (deepLink) onDeepLink(deepLink);
    },
    onReceived: ({ type }) => {
      // This is the path that makes eviction feel instant. The displaced app is
      // in the foreground (or in recents, where the OS still delivers to the
      // running process), so the guard can raise its blocking dialog the moment
      // the message lands — no refresh, no app switch, no waiting.
      if (type === EVICTION_PUSH_TYPE) {
        requestDeviceSessionRecheck();
        // Deliberately NOT counted on the bell: it is a control message, not an
        // inbox row, and there is nothing behind it to open.
        return;
      }
      onReceived?.();
    },
  });

  return () => {
    started = false;
    unsubAuth();
    detachListeners();
  };
}
