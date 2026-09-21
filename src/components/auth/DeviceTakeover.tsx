// The "this account is already open on another phone" gate.
//
// Both auth screens need it and both must behave identically, so the decision —
// check, ask, take over, or back out — lives here once rather than twice. The
// mechanism itself is in core/firebase/services/deviceSession; this file is only
// the part the user sees and the navigation that follows it.
//
// The awkward shape of the flow is forced by the rules: a user cannot read their
// own session document until they are authenticated, so by the time we can ask
// the question they are already signed in. That is why Cancel signs back out
// instead of simply closing a dialog — declining has to actually undo something.
import React, { useCallback, useRef, useState } from 'react';
import { useRouter } from 'expo-router';

import { logout } from '@/src/core/firebase/auth';
import {
  abandonDeviceSessionClaim,
  checkDeviceSessionForLogin,
  clearEvictionNotice,
  takeOverDeviceSession,
  type DeviceSessionConflict,
} from '@/src/core/firebase/services/deviceSession';
import { showToast } from '@/src/core/store/toastStore';
import { ConfirmDialog } from '@/src/components/feedback/ConfirmDialog';

/** Where a completed sign-in lands. A closed union, so no route cast is needed. */
export type LandingRoute = '/(tabs)' | '/course-setup';

interface PendingSignIn {
  uid: string;
  next: LandingRoute;
  successMessage: string;
}

export interface DeviceTakeoverDialogProps {
  /** Non-null while another device holds the account — this is the visibility. */
  conflict: DeviceSessionConflict | null;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export interface DeviceTakeover {
  /**
   * Call with the freshly signed-in uid instead of navigating directly.
   * Resolves true if it navigated, false if it stopped to ask about another
   * device — a caller with a full-screen spinner uses that to drop it.
   */
  finishSignIn: (uid: string, next: LandingRoute, successMessage: string) => Promise<boolean>;
  dialogProps: DeviceTakeoverDialogProps;
}

export function useDeviceTakeover(): DeviceTakeover {
  const router = useRouter();
  const [conflict, setConflict] = useState<DeviceSessionConflict | null>(null);
  const [busy, setBusy] = useState(false);
  const pendingRef = useRef<PendingSignIn | null>(null);

  const finishSignIn = useCallback(
    async (uid: string, next: LandingRoute, successMessage: string): Promise<boolean> => {
      const check = await checkDeviceSessionForLogin(uid);
      if (check.outcome === 'conflict') {
        pendingRef.current = { uid, next, successMessage };
        setConflict(check.existing);
        return false;
      }
      // A successful sign-in makes any parked "you were signed out" notice
      // meaningless, so it must not be waiting here the next time this screen
      // mounts. Fire-and-forget: it is hygiene, not part of the sign-in.
      void clearEvictionNotice();
      router.replace(next);
      showToast(successMessage, 'success');
      return true;
    },
    [router],
  );

  const onConfirm = useCallback(async () => {
    const pending = pendingRef.current;
    if (!pending || busy) return;
    setBusy(true);
    const claimed = await takeOverDeviceSession(pending.uid).catch(() => false);
    setBusy(false);
    setConflict(null);
    pendingRef.current = null;

    if (!claimed) {
      // The claim document still names the OTHER phone. Letting the user in now
      // would hand them a session the guard evicts a few minutes later — which is
      // exactly the "logged in, but it behaves like a new account" failure this
      // flow exists to prevent. Better to stop here and say so.
      await logout().catch(() => undefined);
      abandonDeviceSessionClaim();
      showToast('Could not switch devices. Check your connection and try again.', 'error');
      return;
    }

    void clearEvictionNotice();
    router.replace(pending.next);
    showToast(pending.successMessage, 'success');
  }, [busy, router]);

  const onCancel = useCallback(async () => {
    if (busy) return;
    setConflict(null);
    pendingRef.current = null;
    // A real sign-out, not just a dismissed dialog: reaching this question
    // required a live session, and leaving it in place would log the user in on a
    // second device — exactly what they just declined.
    await logout().catch(() => undefined);
    // Released only once the sign-out is done. logout() clears the hold itself
    // on its way through, so this is for the path where it throws first: without
    // it a failed sign-out would leave the guard muted for the whole claim
    // window on a phone that never took the account over.
    abandonDeviceSessionClaim();
    showToast('Cancelled. Your other device is still signed in.', 'warning');
  }, [busy]);

  return { finishSignIn, dialogProps: { conflict, busy, onConfirm, onCancel } };
}

/**
 * English on both app languages, deliberately: it is a security notice about a
 * device the user may not be holding, and the model and platform printed inside
 * it are English strings anyway.
 */
export function DeviceTakeoverDialog({ conflict, busy, onConfirm, onCancel }: DeviceTakeoverDialogProps) {
  return (
    <ConfirmDialog
      visible={conflict !== null}
      tone="warning"
      icon="phone-portrait"
      title="Already logged in on another device"
      subtitle={
        conflict
          ? `${conflict.deviceName} · ${conflict.platformLabel} · last active ${conflict.lastActiveLabel}`
          : undefined
      }
      message="This account can be used on one device at a time. Continuing here will sign that device out."
      confirmLabel="I understand, Go Login"
      confirmIcon="log-in-outline"
      cancelLabel="Cancel"
      confirmLoading={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
