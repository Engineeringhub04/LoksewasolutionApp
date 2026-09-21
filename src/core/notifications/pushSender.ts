// Expo push SENDER for the app.
//
// The app was receive-only until now: tokens were saved to Firestore and the admin
// WEBSITE did all the sending. But reports are resolved from inside the app
// (app/admin/report-history/[id].tsx), and that path had no way to notify the
// reporter — which is exactly why resolving a report appeared to do nothing.
//
// This is safe to do from an admin's device: firebase.rules already grants
// `isAdmin()` read access to users/{uid}/push_tokens, and Expo's push endpoint
// needs no server key (the app does not use Expo's Enhanced Security option).
// A NON-admin device cannot use any of this, because the token read is denied.
//
// Nothing here throws for a delivery problem; failures come back in the result so
// the caller can tell the user the truth instead of guessing.
//
// One user can own several device rows — an admin signed in on a phone and a
// tablet, or anyone who reinstalled — so every send fans out across all of them.
// That is also why dead tokens have to be cleaned up here: nothing else ever
// removes a row belonging to a device that no longer exists, and left alone they
// accumulate and fail on every future send.
import { runQuery, deleteDocument } from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/** Expo rejects requests carrying more than 100 messages. */
const BATCH_SIZE = 100;

/**
 * Expo's way of saying "this device is gone" — the app was uninstalled, or the
 * OS reissued the token. The row will never deliver again, so it is deleted
 * rather than left to fail on every future send. Every OTHER error code is
 * transient or environmental (a missing FCM credential reports InvalidCredentials
 * for a token that is perfectly fine) and must NOT cost the user their device.
 */
const DEAD_DEVICE = 'DeviceNotRegistered';

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
}

export interface PushSendResult {
  ok: number;
  failed: number;
  errors: string[];
  /** Token rows deleted because Expo reported the device no longer exists. */
  pruned: number;
}

interface ExpoTicket {
  status?: string;
  message?: string;
  details?: { error?: string };
}

/** One registered device: the token to send to, and the row it came from. */
export interface DeviceToken {
  token: string;
  deviceId: string;
}

/**
 * Reads every device registered for one user. An admin may be signed in on
 * several devices at once (they are exempt from the single-device rule), so this
 * deliberately returns all of them rather than a first match.
 *
 * Requires the caller to be the owner or an admin — anyone else gets a permission
 * error, which is surfaced as an empty list rather than a crash.
 */
export async function fetchPushTokensForUser(uid: string): Promise<DeviceToken[]> {
  if (!uid) return [];
  try {
    const rows = await runQuery(Collections.userPushTokens(uid));
    return rows
      .map((row) => ({
        token: typeof row.token === 'string' ? row.token.trim() : '',
        // The document id IS the device id; carrying it is what lets a dead
        // token be deleted later instead of failing forever.
        deviceId: typeof row.id === 'string' ? row.id : '',
      }))
      .filter((device) => device.token.length > 0 && device.deviceId.length > 0);
  } catch {
    // Denied (not admin/owner), offline, or the subcollection does not exist.
    return [];
  }
}

/**
 * Sends messages through Expo's push service in batches.
 *
 * Expo answers 200 with a per-message ticket array, so a partial failure looks
 * like a success at the HTTP level — the tickets are what actually have to be
 * inspected, which is what this does.
 *
 * Pass `onDeadToken` to be told which tokens Expo has given up on; tickets come
 * back in the same order as the messages, which is the only thing that ties a
 * failure back to the device that caused it.
 */
export async function sendExpoPush(
  messages: ExpoPushMessage[],
  onDeadToken?: (token: string) => void,
): Promise<PushSendResult> {
  const result: PushSendResult = { ok: 0, failed: 0, errors: [], pruned: 0 };
  if (!messages.length) return result;

  for (let index = 0; index < messages.length; index += BATCH_SIZE) {
    const batch = messages.slice(index, index + BATCH_SIZE);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batch),
      });

      if (!res.ok) {
        result.failed += batch.length;
        result.errors.push(`EXPO_HTTP_${res.status}`);
        continue;
      }

      const payload = (await res.json().catch(() => null)) as { data?: ExpoTicket[] } | null;
      const tickets = payload?.data ?? [];
      batch.forEach((message, position) => {
        const ticket = tickets[position];
        if (ticket?.status === 'ok') {
          result.ok += 1;
          return;
        }
        result.failed += 1;
        const reason = ticket?.details?.error || ticket?.message || 'UNKNOWN_PUSH_ERROR';
        if (!result.errors.includes(reason)) result.errors.push(reason);
        if (ticket?.details?.error === DEAD_DEVICE) onDeadToken?.(message.to);
      });
    } catch (e) {
      result.failed += batch.length;
      const reason = e instanceof Error ? e.message : 'PUSH_REQUEST_FAILED';
      if (!result.errors.includes(reason)) result.errors.push(reason);
    }
  }

  return result;
}

/**
 * Convenience wrapper: one notification, every device a user owns.
 *
 * Devices Expo reports as gone are removed from the user's push_tokens as a side
 * effect. Without that, an uninstall leaves a row that fails on every future
 * send — and since these counts are shown to the admin who resolved the report,
 * the stale row would keep reporting a failure that nobody can act on.
 */
export async function pushToUser(
  uid: string,
  message: Omit<ExpoPushMessage, 'to'>,
): Promise<PushSendResult & { noDevice: boolean }> {
  const devices = await fetchPushTokensForUser(uid);
  if (!devices.length) {
    return { ok: 0, failed: 0, errors: [], pruned: 0, noDevice: true };
  }

  const deviceIdByToken = new Map(devices.map((device) => [device.token, device.deviceId]));
  const dead = new Set<string>();

  const sent = await sendExpoPush(
    devices.map(({ token }) => ({
      to: token,
      sound: 'default' as const,
      priority: 'high' as const,
      channelId: 'default',
      ...message,
    })),
    (token) => {
      const deviceId = deviceIdByToken.get(token);
      if (deviceId) dead.add(deviceId);
    },
  );

  // Best-effort cleanup, and deliberately after the send: a delete that fails
  // costs nothing but one wasted message next time, whereas letting it throw
  // here would turn a delivered notification into a reported failure.
  for (const deviceId of dead) {
    const removed = await deleteDocument(`${Collections.userPushTokens(uid)}/${deviceId}`)
      .then(() => true)
      .catch(() => false);
    if (removed) sent.pruned += 1;
  }

  return { ...sent, noDevice: false };
}
