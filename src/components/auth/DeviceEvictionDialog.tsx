// The other half of the single-device story: what the DISPLACED phone sees.
//
// DeviceTakeover (same folder) is the question asked on the phone that is taking
// an account over. This is the answer delivered to the phone that lost it, and it
// has two shapes because there are two ways to find out:
//
//   blocking — the app was open when it happened. The dialog goes over the whole
//              app from the root layout, nothing behind it can be tapped, and its
//              one button is the only way forward. The session is still alive
//              underneath, which is what keeps the app from flashing empty
//              screens behind the explanation; the button is what ends it.
//
//   notice   — the app was closed when it happened. The splash screen found out,
//              signed out quietly and routed to login, and this appears there to
//              explain a login screen the user did not ask for. Nothing is
//              blocked at this point: the sign-out has already happened.
//
// Deliberately English on both app languages, for the same reason as the takeover
// dialog: it is a security notice about a device the user may not be holding, and
// the device model printed inside it is an English string regardless.
import React from 'react';

import { ConfirmDialog } from '@/src/components/feedback/ConfirmDialog';

export type DeviceEvictionMode = 'blocking' | 'notice';

export interface DeviceEvictionDialogProps {
  visible: boolean;
  mode: DeviceEvictionMode;
  /** The phone that now holds the account, when the claim named one. */
  deviceName?: string | null;
  /** Spinner on the button while the sign-out runs. */
  busy?: boolean;
  onConfirm: () => void;
}

export function DeviceEvictionDialog({
  visible,
  mode,
  deviceName,
  busy,
  onConfirm,
}: DeviceEvictionDialogProps) {
  const blocking = mode === 'blocking';

  return (
    <ConfirmDialog
      visible={visible}
      tone="warning"
      icon="phone-portrait"
      title={blocking ? 'Your account moved to another device' : 'You were signed out'}
      subtitle={deviceName ? `Now signed in on ${deviceName}` : undefined}
      message={
        blocking
          ? 'This account can be used on one device at a time, and it was just opened somewhere else. This device will now be signed out.'
          : 'This account was opened on another device while this app was closed, and only one device can use an account at a time. Log in again to use it here — the other device will be signed out.'
      }
      confirmLabel={blocking ? 'OK, I understood — Log out' : 'I understood'}
      confirmIcon={blocking ? 'log-out-outline' : 'checkmark-circle-outline'}
      confirmLoading={busy}
      // The one button IS the dialog. There is no second choice to offer: the
      // account is already gone, so a Cancel would only pretend otherwise.
      singleButton
      onConfirm={onConfirm}
      // Swallows the Android back button while blocking. AppDialog's backdrop is
      // inert by design, so this is the only other way out of the dialog — and
      // there must not be one until the button is pressed.
      onCancel={blocking ? () => undefined : onConfirm}
    />
  );
}
