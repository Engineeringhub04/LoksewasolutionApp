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

interface InitArgs {
  /** Current UI language, stored with the token so the admin can segment sends. */
  getLanguage: () => string | null;
  /** Navigate to a deep link when a notification is tapped. */
  onDeepLink: (deepLink: string) => void;
}

let started = false;

/**
 * Initializes push notifications. Idempotent — safe to call once from the root
 * layout. Returns a disposer that tears down every subscription.
 */
export function initNotifications({ getLanguage, onDeepLink }: InitArgs): () => void {
  if (started) return () => undefined;
  started = true;

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
    }

    void registerPushToken(nextUid, getLanguage());
  });

  const detachListeners = attachNotificationListeners({
    onResponse: (deepLink) => {
      if (deepLink) onDeepLink(deepLink);
    },
  });

  return () => {
    started = false;
    unsubAuth();
    detachListeners();
  };
}
