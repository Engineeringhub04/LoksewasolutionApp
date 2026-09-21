// One account = one device.
//
// A normal user's account may be signed in on exactly one phone at a time. The
// claim lives in a single document — users/{uid}/session/active — whose
// `deviceId` names the phone that currently holds the account. Logging in
// somewhere else overwrites that document, and the displaced phone signs itself
// out the next time it is opened (see useDeviceSessionGuard).
//
// WHY IT WORKS THIS WAY
//
// There are no Cloud Functions on this plan, so nothing on the server can push a
// phone out. The displaced device therefore has to notice on its own, and the
// only thing it can notice is that the claim document no longer names it. That is
// the whole mechanism: one document, one field that matters.
//
// What makes it feel instant anyway is that the NEW device does the server's job
// on its way in: the moment it takes the account over it sends a real push to
// every other device on the account (see notifyDisplacedDevices). Receiving that
// push is what turns "the next time it is opened" into "within a second", whether
// the displaced app is in the foreground, sitting in recents, or fully closed.
// The push is an accelerator, never the source of truth — the claim document is,
// and a device that never receives the push still finds out on its next
// foreground, its next pull-to-refresh, or its next cold start.
//
// It also means the check must happen AFTER authentication, not before — the
// rules only let the owner read their own session document, so we cannot know
// whether an account is taken until we are signed in as it. The login screen
// signs in, asks, and then either claims the account or signs straight back out
// if the user cancels.
//
// FAILING OPEN, ON PURPOSE
//
// Every function here swallows its errors and reports "nothing to do". Until the
// new rules block is deployed, every read of the session document is denied — and
// a denied read must never lock anyone out of the app. A user is only ever
// signed out on a POSITIVE read that names a different device; doubt of any kind
// (offline, permission denied, malformed document) leaves the session alone.
//
// ADMINS ARE EXEMPT
//
// An admin moves between a phone and a test device constantly, so their account
// is never claimed and never checked. The exemption is read once per app process
// per uid and cached, because the alternative is a user-document read on every
// single foreground.
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';

import { AppConfig } from '@/src/core/config/appConfig';
import { Collections } from '@/src/core/firebase/collections';
import { getDocument, setDocument, deleteDocument, serverTimestamp } from '@/src/core/firebase/firestoreRest';
import { getDeviceInstallationId } from '@/src/core/notifications/deviceId';
import { fetchPushTokensForUser, sendExpoPush } from '@/src/core/notifications/pushSender';

export type DevicePlatform = 'android' | 'ios';

/** The stored claim, as this module cares about it. */
interface ActiveSessionRecord {
  deviceId: string;
  deviceName: string;
  platform: DevicePlatform;
  lastActiveAt: unknown;
}

/** What the login dialog prints about the phone that currently holds the account. */
export interface DeviceSessionConflict {
  /** Model as the device reports it, e.g. "Samsung SM-G991B" or "iPhone 14". */
  deviceName: string;
  /** Ready-to-print platform, e.g. "Android". */
  platformLabel: string;
  /** Ready-to-print recency, e.g. "about 3 hours ago". */
  lastActiveLabel: string;
}

export type LoginSessionCheck =
  | { outcome: 'ok' }
  | { outcome: 'conflict'; existing: DeviceSessionConflict };

/**
 * How long a `lastActiveAt` value is allowed to go stale before the next
 * foreground refreshes it. Purely cosmetic — it feeds the "last active" line in
 * the takeover dialog — so it is throttled hard rather than written on every
 * foreground, and the labels below never claim more precision than this allows.
 */
const TOUCH_INTERVAL_MS = 15 * 60 * 1000;

/**
 * A conflict dialog holds the claim open while the user reads it. The deadline
 * makes that self-healing: if the screen is killed mid-decision the guard starts
 * working again by itself instead of staying off for the rest of the process.
 */
const CLAIM_WINDOW_MS = 2 * 60 * 1000;

/**
 * Where the "you were signed out" notice waits between the eviction and the
 * login screen that prints it.
 *
 * A displaced phone that was CLOSED during the takeover has nowhere to show a
 * dialog — the app is not running. It finds out at the next cold start, signs
 * itself out on the splash screen and lands on login, and the explanation has to
 * survive that navigation. AsyncStorage is the only thing that does, because the
 * sign-out wipes every in-memory store on its way through.
 */
const EVICTION_NOTICE_KEY = 'loksewa:deviceEviction:notice';

/**
 * How long a parked notice is still worth showing. Normally it is read seconds
 * after it is written — splash writes it, login reads it — but if the app is
 * killed in that gap it sits in storage until someone opens the login screen
 * again. Explaining a sign-out from three weeks ago would be worse than saying
 * nothing, so it expires.
 */
const EVICTION_NOTICE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * How long a clean verdict is reused instead of re-reading the claim document.
 *
 * Every cold start checks twice in a row — once on the splash screen, once again
 * the moment the root layout's guard becomes active on the first real route — and
 * those two reads are always the same answer a fraction of a second apart. This
 * collapses them into one. Every caller can widen or drop it — see VerifyOptions.
 */
const VERIFY_THROTTLE_MS = 60 * 1000;

/**
 * The notification the DISPLACED phone receives, worded by the user.
 *
 * It is a real, visible notification rather than a silent data push, and that is
 * deliberate: a silent push is delivered at the OS's convenience and is dropped
 * outright on a phone in low-power mode, which is exactly the phone we most need
 * to reach. A visible one is a high-priority alert the user sees even if the app
 * never gets to run — and tapping it opens the app, which runs the check anyway.
 */
const EVICTION_PUSH_TITLE = '🔐 New Sign-In Detected';

function evictionPushBody(name: string): string {
  const who = name.trim();
  return `👋 Hi ${who || 'there'}, you were signed in on another device. Open the app.`;
}

/**
 * Marks the payload as "not an inbox item". Every other push this app sends is a
 * notification row the bell should count; this one is a control message, so the
 * receiver uses this to bump the session check instead of the unread badge.
 */
export const EVICTION_PUSH_TYPE = 'session-evicted';

/** Cached per uid: the exemption verdict and the name the push greets them by. */
interface AccountFacts {
  exempt: boolean;
  name: string;
}

const accountFactsCache = new Map<string, AccountFacts>();
let claimDeadline = 0;
let lastTouchedAt = 0;
let lastVerifiedAt = 0;

/**
 * Listeners that want to be told "check the claim document RIGHT NOW".
 *
 * The guard is a React hook living in the root layout, but the things that know
 * a re-check is warranted are not: an arriving push handled by a module-level
 * notification listener, and a pull-to-refresh in a screen that has never heard
 * of the guard. A tiny module-level channel is the only thing both sides can
 * reach — no context, no prop drilling, no store.
 */
type RecheckListener = () => void;
const recheckListeners = new Set<RecheckListener>();

/**
 * Subscribes to forced re-check requests. Returns its own unsubscribe, so a hook
 * can hand it straight back from useEffect.
 */
export function onDeviceSessionRecheck(listener: RecheckListener): () => void {
  recheckListeners.add(listener);
  return () => {
    recheckListeners.delete(listener);
  };
}

/**
 * Asks the guard to verify the claim immediately, bypassing the throttle.
 *
 * Safe to call from anywhere and at any frequency: with no guard mounted it does
 * nothing at all, and the guard itself is idempotent — a second request while a
 * check is already running is dropped.
 */
export function requestDeviceSessionRecheck(): void {
  recheckListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* one bad listener must not stop the others */
    }
  });
}

function sessionPath(uid: string): string {
  return `${Collections.userSession(uid)}/${Collections.activeSessionId}`;
}

function thisPlatform(): DevicePlatform {
  return Platform.OS === 'ios' ? 'ios' : 'android';
}

/**
 * A human-readable name for this phone. Model first (neutral, and what a user
 * recognises on a box), falling back to the name they gave the device only when
 * the model is unavailable.
 */
function thisDeviceName(): string {
  const brand = Device.brand?.trim() ?? '';
  const model = Device.modelName?.trim() ?? '';
  if (model && brand && !model.toLowerCase().startsWith(brand.toLowerCase())) {
    return `${brand} ${model}`;
  }
  if (model) return model;
  return Device.deviceName?.trim() || 'Unknown device';
}

function platformLabel(platform: DevicePlatform): string {
  return platform === 'ios' ? 'iOS' : 'Android';
}

/** Firestore timestamps arrive as {toMillis}; anything else is treated as unknown. */
function toMillis(value: unknown): number | null {
  if (value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    const ms = (value as { toMillis: () => number }).toMillis();
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

/**
 * English relative time for the takeover dialog. Deliberately vague below the
 * heartbeat interval: the stored value can be up to TOUCH_INTERVAL_MS behind, so
 * printing "2 minutes ago" would be a precision we do not actually have.
 */
function formatLastActive(value: unknown): string {
  const ms = toMillis(value);
  if (ms === null) return 'recently';
  const diff = Date.now() - ms;
  if (diff < 20 * 60 * 1000) return 'a few minutes ago';
  const minutes = Math.round(diff / 60000);
  if (minutes < 60) return `about ${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `about ${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function toRecord(doc: Record<string, unknown> | null): ActiveSessionRecord | null {
  const deviceId = typeof doc?.deviceId === 'string' ? doc.deviceId : '';
  // A claim with no device id names nobody, so it cannot displace anybody.
  if (!deviceId) return null;
  return {
    deviceId,
    deviceName: typeof doc?.deviceName === 'string' && doc.deviceName ? doc.deviceName : 'Another device',
    platform: doc?.platform === 'ios' ? 'ios' : 'android',
    lastActiveAt: doc?.lastActiveAt,
  };
}

async function readActiveSession(uid: string): Promise<ActiveSessionRecord | null> {
  return toRecord(await getDocument(sessionPath(uid)));
}

/** True while a login screen is showing the takeover dialog for this process. */
export function isClaimInProgress(): boolean {
  return Date.now() < claimDeadline;
}

function holdClaim(): void {
  claimDeadline = Date.now() + CLAIM_WINDOW_MS;
}

/**
 * Mutes the guard for the length of a sign-in.
 *
 * A sign-in stores its session BEFORE anyone has asked whether this account is
 * free, and storing the session is what wakes the guard up. Left alone the guard
 * read the claim document, found the OTHER phone's id in it — perfectly true, the
 * takeover has not happened yet — and signed the brand-new session straight back
 * out while the takeover dialog was still on screen. The user then landed on a
 * blank, sessionless app that looked like a fresh account and was back at the
 * welcome screen on the next launch.
 *
 * So every sign-in path holds the guard off from the moment it persists a
 * session; the login screen's own check is the authority until it resolves.
 */
export function holdDeviceSessionClaim(): void {
  holdClaim();
}

/** Releases the hold above — call when the takeover dialog is dismissed either way. */
export function abandonDeviceSessionClaim(): void {
  claimDeadline = 0;
}

/** Details the login screen prints when it explains a sign-out that already happened. */
export interface EvictionNotice {
  /** The phone that took the account, when the claim document named one. */
  deviceName: string | null;
  /** Epoch ms the eviction was detected. */
  at: number;
}

/**
 * Parks the explanation for the login screen. Used ONLY by the cold-start path:
 * when the app was open we show the blocking dialog instead, and queueing a
 * notice as well would make the login screen repeat something the user just read
 * and dismissed.
 */
export async function markEvictionNotice(deviceName: string | null): Promise<void> {
  try {
    const notice: EvictionNotice = { deviceName, at: Date.now() };
    await AsyncStorage.setItem(EVICTION_NOTICE_KEY, JSON.stringify(notice));
  } catch {
    /* the sign-out still happened; only the explanation is lost */
  }
}

/**
 * Reads and REMOVES the parked notice. Removing it here is the whole reason the
 * popup shows exactly once: a second app open, or a second visit to the login
 * screen, finds nothing left to show.
 */
export async function consumeEvictionNotice(): Promise<EvictionNotice | null> {
  try {
    const raw = await AsyncStorage.getItem(EVICTION_NOTICE_KEY);
    if (!raw) return null;
    await AsyncStorage.removeItem(EVICTION_NOTICE_KEY);
    const parsed = JSON.parse(raw) as Partial<EvictionNotice>;
    const at = typeof parsed?.at === 'number' ? parsed.at : Date.now();
    if (Date.now() - at > EVICTION_NOTICE_MAX_AGE_MS) return null;
    return {
      deviceName: typeof parsed?.deviceName === 'string' ? parsed.deviceName : null,
      at,
    };
  } catch {
    return null;
  }
}

/** Drops any parked notice — a successful sign-in makes an old one meaningless. */
export async function clearEvictionNotice(): Promise<void> {
  await AsyncStorage.removeItem(EVICTION_NOTICE_KEY).catch(() => undefined);
}

/**
 * Reads the two things this module needs from the user document, in one go.
 * Cached per process: role changes are rare and an app restart re-reads it, which
 * is a far better trade than a user-document read on every foreground.
 */
async function readAccountFacts(uid: string): Promise<AccountFacts> {
  const cached = accountFactsCache.get(uid);
  if (cached !== undefined) return cached;
  const doc = await getDocument(`${Collections.users}/${uid}`);
  const facts: AccountFacts = {
    exempt: doc?.role === 'admin',
    name: typeof doc?.name === 'string' ? doc.name : '',
  };
  accountFactsCache.set(uid, facts);
  return facts;
}

/**
 * Whether this account skips the whole mechanism.
 */
async function isExemptAccount(uid: string): Promise<boolean> {
  return (await readAccountFacts(uid)).exempt;
}

/** Writes this device into the claim document, replacing whoever held it. */
async function writeClaim(uid: string): Promise<void> {
  const deviceId = await getDeviceInstallationId();
  await setDocument(
    sessionPath(uid),
    {
      deviceId,
      deviceName: thisDeviceName(),
      platform: thisPlatform(),
      osVersion: Device.osVersion ?? null,
      appVersion: AppConfig.identity.version,
      claimedAt: serverTimestamp(),
      lastActiveAt: serverTimestamp(),
    },
    { merge: true },
  );
  lastTouchedAt = Date.now();
  // Writing the claim IS a verification, and a stronger one than a read: this
  // device is now provably the holder. Recording it here is what stops the guard
  // from re-reading the document a second after a sign-in just wrote it.
  lastVerifiedAt = lastTouchedAt;
}

/**
 * Keeps `lastActiveAt` roughly current so the takeover dialog can say how long
 * the other phone has been idle. Throttled, and best-effort: the claim is still
 * valid whether or not this write lands.
 */
async function touchClaim(uid: string, deviceId: string): Promise<void> {
  if (Date.now() - lastTouchedAt < TOUCH_INTERVAL_MS) return;
  lastTouchedAt = Date.now();
  // deviceId is re-sent unchanged so the merge carries a plain field alongside
  // the timestamp transform, rather than an update with an empty field mask.
  await setDocument(sessionPath(uid), { deviceId, lastActiveAt: serverTimestamp() }, { merge: true });
}

/**
 * Runs right after a successful sign-in, before the app navigates.
 *
 * Returns `ok` — having claimed the account for this device — when the account
 * is free, already ours, or exempt. Returns `conflict` when another phone holds
 * it, in which case the caller MUST resolve it with either
 * `takeOverDeviceSession` or `abandonDeviceSessionClaim` + sign-out.
 */
export async function checkDeviceSessionForLogin(uid: string): Promise<LoginSessionCheck> {
  try {
    if (await isExemptAccount(uid)) {
      abandonDeviceSessionClaim();
      return { outcome: 'ok' };
    }

    const [record, deviceId] = await Promise.all([readActiveSession(uid), getDeviceInstallationId()]);
    if (!record || record.deviceId === deviceId) {
      await writeClaim(uid);
      // The claim now names this phone, so the guard can read it and agree. The
      // sign-in hold has done its job and must end here — leaving it up would
      // mute the guard for the next two minutes on a phone that is legitimately
      // signed in, which is exactly the window a takeover elsewhere would use.
      abandonDeviceSessionClaim();
      return { outcome: 'ok' };
    }

    // Hold the guard off while the dialog is on screen: the session already
    // exists at this point, so an unsuspended guard would sign the user out from
    // under the very question we are asking them.
    holdClaim();
    return {
      outcome: 'conflict',
      existing: {
        deviceName: record.deviceName,
        platformLabel: platformLabel(record.platform),
        lastActiveLabel: formatLastActive(record.lastActiveAt),
      },
    };
  } catch {
    // Rules not deployed yet, offline, or a transient failure. Logging in is far
    // more important than enforcing this, so we let it through — and we release
    // the sign-in hold, because a muted guard is a worse failure than a missing
    // check.
    abandonDeviceSessionClaim();
    return { outcome: 'ok' };
  }
}

/**
 * Tells the phone that just lost the account, right now, over Expo push.
 *
 * WHY THIS IS SENT FROM A PHONE AND NOT A SERVER
 *
 * There are no Cloud Functions on this plan, so there is no server to do it. The
 * NEW device can, though: firebase.rules already lets an owner read their own
 * users/{uid}/push_tokens (line 98), Expo's endpoint needs no secret, and the
 * device doing the sending is by definition signed in as the account being
 * taken over. No rules change, no new infrastructure.
 *
 * Every registered device EXCEPT this one is targeted, not just the one named in
 * the claim document. A claim that failed to write, or a reinstall that left a
 * second row behind, would otherwise leave a signed-in phone with no way to find
 * out — and a device that is already signed out simply ignores the message.
 *
 * Deliberately best-effort and never awaited by the caller's critical path: the
 * takeover is already committed by the time this runs, and a failed notification
 * must not turn a successful sign-in into an error. The displaced phone still
 * finds out on its next foreground, refresh or cold start.
 */
async function notifyDisplacedDevices(uid: string, selfDeviceId: string): Promise<void> {
  try {
    const [devices, facts] = await Promise.all([
      fetchPushTokensForUser(uid),
      readAccountFacts(uid).catch((): AccountFacts => ({ exempt: false, name: '' })),
    ]);
    const targets = devices.filter((device) => device.deviceId !== selfDeviceId);
    if (!targets.length) return;

    await sendExpoPush(
      targets.map(({ token }) => ({
        to: token,
        title: EVICTION_PUSH_TITLE,
        body: evictionPushBody(facts.name),
        // No deepLink on purpose. Tapping this must open the app normally so the
        // splash screen can run the check and sign the device out on its way to
        // login; a deep link would drop the user into a route mid-eviction.
        data: { type: EVICTION_PUSH_TYPE },
        sound: 'default' as const,
        priority: 'high' as const,
        channelId: 'default',
      })),
    );
  } catch {
    /* the takeover stands either way */
  }
}

/**
 * Confirms a takeover: this device becomes the claim holder, the displaced
 * device is told over push, and its push token is removed so notifications for
 * this account follow the account rather than staying on a phone that is about
 * to be signed out.
 *
 * Order matters — the notification goes out BEFORE the token row is deleted,
 * because deleting it first would throw away the only address we have for the
 * phone we are trying to reach.
 *
 * Returns false when the claim could not be written. That matters: without a
 * claim naming this phone the account still belongs to the other one, and the
 * guard would evict this session minutes later — so the caller must treat a
 * false as "the takeover did not happen" rather than letting the user in.
 */
export async function takeOverDeviceSession(uid: string): Promise<boolean> {
  try {
    const [previous, deviceId] = await Promise.all([
      readActiveSession(uid).catch(() => null),
      getDeviceInstallationId(),
    ]);
    await writeClaim(uid);
    await notifyDisplacedDevices(uid, deviceId);
    if (previous && previous.deviceId !== deviceId) {
      await deleteDocument(`${Collections.userPushTokens(uid)}/${previous.deviceId}`).catch(() => undefined);
    }
    // Only now: the document names this phone, so the guard reading it agrees.
    abandonDeviceSessionClaim();
    return true;
  } catch {
    // Hold stays up on purpose. It expires on its own (CLAIM_WINDOW_MS) and the
    // caller is signing back out anyway; releasing it here would let the guard
    // fire mid-sign-out and stack a second eviction on top.
    return false;
  }
}

export type SessionVerdict = 'ok' | 'evicted' | 'skipped';

export interface SessionCheck {
  verdict: SessionVerdict;
  /** The phone that now holds the account. Only meaningful on `evicted`. */
  deviceName: string | null;
}

export interface VerifyOptions {
  /**
   * How recent a previous check has to be for this one to be skipped. Defaults
   * to VERIFY_THROTTLE_MS.
   *
   * Three callers, three answers. The mount check takes the default, because on
   * a cold start it fires moments after the splash screen already asked. A
   * return to the foreground passes FOREGROUND_VERIFY_THROTTLE_MS — long enough
   * to still collapse a launch burst, short enough that a user who switched
   * apps for twenty seconds is not told "checked recently" about a takeover that
   * happened in those twenty seconds. An arriving push or a pull-to-refresh
   * passes 0: both are evidence that the answer has changed or that the user is
   * waiting on it, and a skip would throw away the only signal we get.
   */
  throttleMs?: number;
}

/**
 * The window used when the app comes back to the foreground. See VerifyOptions.
 */
export const FOREGROUND_VERIFY_THROTTLE_MS = 10 * 1000;

/**
 * The displaced device's half of the mechanism: called on app start, on every
 * return to the foreground, when an eviction push arrives, and on any
 * pull-to-refresh. `evicted` is returned ONLY when the claim document was read
 * successfully and names a different device — never on an error.
 */
export async function verifyDeviceSession(uid: string, options: VerifyOptions = {}): Promise<SessionCheck> {
  if (isClaimInProgress()) return { verdict: 'skipped', deviceName: null };
  const throttleMs = options.throttleMs ?? VERIFY_THROTTLE_MS;
  if (Date.now() - lastVerifiedAt < throttleMs) {
    return { verdict: 'skipped', deviceName: null };
  }
  try {
    if (await isExemptAccount(uid)) return { verdict: 'skipped', deviceName: null };

    const [record, deviceId] = await Promise.all([readActiveSession(uid), getDeviceInstallationId()]);
    if (!record) {
      // Nobody has claimed this account yet — an account that last signed in on a
      // build without this feature. First device to open the app takes it.
      await writeClaim(uid);
      return { verdict: 'ok', deviceName: null };
    }
    if (record.deviceId !== deviceId) {
      // Deliberately NOT recorded as a verification: the caller latches on this
      // and stops asking, and if anything did ask again it should get the same
      // answer from the document rather than a throttled 'skipped'.
      return { verdict: 'evicted', deviceName: record.deviceName };
    }

    await touchClaim(uid, deviceId).catch(() => undefined);
    lastVerifiedAt = Date.now();
    return { verdict: 'ok', deviceName: null };
  } catch {
    return { verdict: 'skipped', deviceName: null };
  }
}

/**
 * Drops this device's claim on a deliberate sign-out, so the next login anywhere
 * is clean. Only removes the document when it still names THIS device — a device
 * that was already displaced must not wipe the new holder's claim on its way out.
 */
export async function releaseDeviceSession(uid: string): Promise<void> {
  try {
    const [record, deviceId] = await Promise.all([readActiveSession(uid), getDeviceInstallationId()]);
    if (record?.deviceId !== deviceId) return;
    await deleteDocument(sessionPath(uid));
  } catch {
    /* best-effort — a stale claim is corrected by the next login anyway */
  }
}

/** Forgets the cached account facts. Called on sign-out so a shared phone re-reads them. */
export function resetDeviceSessionCache(): void {
  accountFactsCache.clear();
  lastTouchedAt = 0;
  lastVerifiedAt = 0;
  claimDeadline = 0;
}
