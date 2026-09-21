// Watches for this device losing its claim on the account (see
// core/firebase/services/deviceSession for the mechanism) and hands the root
// layout a blocking notice when it has.
//
// WHEN IT LOOKS
//
// Four moments, which together cover every way a displaced phone can come back to
// life: once when a session appears, again every time the app returns to the
// foreground, the instant an eviction push arrives, and on any pull-to-refresh
// the user performs.
//
// The push is the one that makes this feel immediate. The device that takes the
// account over sends it on its way in, so an old phone sitting open in someone's
// hand raises the dialog about a second later instead of minutes later — and a
// phone in recents raises it before the user has finished swiping back to the app.
// There used to be a five-minute timer doing that job badly; it is gone, and with
// it a document read every five minutes of every session for every user.
//
// The refresh hook is the safety net for the one case the push cannot cover: the
// notification never arrived — permission denied, a dead token, Expo unreachable —
// but the app is open and the user pulls to refresh. That gesture already means
// "get me the current truth", so the claim document is part of what gets re-read.
//
// WHY IT DOES NOT SIGN OUT BY ITSELF
//
// It used to: read the claim, sign out, toast, redirect. That is fine when the
// phone is idle, but the user is usually mid-sentence in a quiz when it happens,
// and a screen that empties itself under your thumb with a toast you might miss
// reads as the app breaking. So the guard now reports upwards and the root layout
// puts an unskippable dialog over the whole app. The session stays alive — and
// completely unusable — until the one button on that dialog is pressed, and that
// button is what signs out.
//
// If the app is closed before the button is pressed, nothing is lost: the splash
// screen runs the same check on the next cold start and handles it there.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useRouter } from 'expo-router';

import { logout } from '@/src/core/firebase/auth';
import {
  FOREGROUND_VERIFY_THROTTLE_MS,
  onDeviceSessionRecheck,
  verifyDeviceSession,
} from '@/src/core/firebase/services/deviceSession';

export interface DeviceEviction {
  /** The phone that took the account, when the claim document named one. */
  deviceName: string | null;
}

interface GuardOptions {
  /**
   * Set false on screens that run this check themselves — the splash screen and
   * everything under (auth). Two checkers on the same screen means the dialog can
   * appear on top of the login form it was supposed to send the user to.
   */
  enabled?: boolean;
}

export interface DeviceSessionGuard {
  /** Non-null once this device has provably lost the account. */
  eviction: DeviceEviction | null;
  /** Signs out and lands on the login screen. The dialog's only button. */
  acknowledge: () => void;
  /** True while `acknowledge` is in flight, so the button can show progress. */
  acknowledging: boolean;
}

export function useDeviceSessionGuard(uid: string | null, options: GuardOptions = {}): DeviceSessionGuard {
  const enabled = options.enabled ?? true;
  const router = useRouter();
  const [eviction, setEviction] = useState<DeviceEviction | null>(null);
  const [acknowledging, setAcknowledging] = useState(false);
  // Read inside the effect so a raised flag stops further reads without making
  // the effect itself depend on the flag and tear down its subscriptions.
  const evictedRef = useRef(false);

  // A new sign-in on this same phone clears a stale notice, so the dialog cannot
  // survive into a session it has nothing to do with.
  useEffect(() => {
    evictedRef.current = false;
    setEviction(null);
  }, [uid]);

  useEffect(() => {
    if (!uid || !enabled) return;

    let cancelled = false;
    // One check at a time: a foreground event can land while the first check is
    // still in flight, and both would raise the same dialog.
    let running = false;

    const check = async (throttleMs?: number) => {
      if (cancelled || running || evictedRef.current) return;
      running = true;
      try {
        const result = await verifyDeviceSession(uid, { throttleMs });
        if (cancelled || result.verdict !== 'evicted') return;
        evictedRef.current = true;
        setEviction({ deviceName: result.deviceName });
      } finally {
        running = false;
      }
    };

    // Mount: the default throttle, because on a cold start the splash screen has
    // just asked the same question.
    void check();
    const subscription = AppState.addEventListener('change', (state) => {
      // Coming back from recents is the user's own "is this still my session?"
      // moment, so it gets a much shorter window than the mount check.
      if (state === 'active') void check(FOREGROUND_VERIFY_THROTTLE_MS);
    });
    // Unthrottled: both callers know something the throttle cannot — a push
    // naming this very event, or a user asking outright for fresh data — and a
    // skipped check would waste the only signal we get.
    const unsubscribeRecheck = onDeviceSessionRecheck(() => {
      void check(0);
    });

    return () => {
      cancelled = true;
      subscription.remove();
      unsubscribeRecheck();
    };
  }, [uid, enabled]);

  const acknowledge = useCallback(() => {
    if (acknowledging) return;
    setAcknowledging(true);
    void (async () => {
      await logout().catch(() => undefined);
      setAcknowledging(false);
      setEviction(null);
      // Deliberately no parked notice here. The user has just read and dismissed
      // the explanation; repeating it on the login screen would make one takeover
      // produce two popups.
      router.replace('/(auth)/login');
    })();
  }, [acknowledging, router]);

  return { eviction, acknowledge, acknowledging };
}
