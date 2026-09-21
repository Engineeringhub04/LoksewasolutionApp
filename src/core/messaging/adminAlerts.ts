// Admin alert relay client — "a user filed a report, wake the admins".
//
// WHY A RELAY AND NOT A DIRECT PUSH
// Sending an Expo push needs the recipient's push token. firebase.rules only lets
// an admin read `users/{uid}/push_tokens`, so the phone of the person filing the
// report can never see the admin tokens it would have to send to. Mirroring those
// tokens into a document normal users could read would hand anyone the ability to
// push arbitrary content at the admins, so instead the tokens live inside a small
// Apps Script web app (Script Properties) that the app cannot read from. The app
// only ever says "alert the admins"; the script picks the recipients.
//
// See docs/apps-script-admin-alerts.gs for the script and its setup steps.
//
// EVERY function here is best-effort and never throws. A report that reached
// Firestore and Discord has succeeded; failing to ring the admin's phone must
// never surface to the user as a failed report.
import { Platform } from 'react-native';
import { AppConfig } from '@/src/core/config/appConfig';
import { getDeviceInstallationId } from '@/src/core/notifications/deviceId';

/** Fixed deep link for the alert — the in-app admin report queue. */
const ADMIN_REPORT_QUEUE = '/admin/report-history';

interface RelayResponse {
  ok?: boolean;
  sent?: number;
  failed?: number;
  devices?: number;
  error?: string;
  note?: string;
}

/** True once appConfig holds a real deployment URL and secret. */
export function isAdminAlertConfigured(): boolean {
  const { appsScriptUrl, sharedSecret } = AppConfig.messaging.adminAlertWebhook;
  return (
    !!appsScriptUrl &&
    !appsScriptUrl.startsWith('REPLACE_WITH') &&
    !!sharedSecret &&
    !sharedSecret.startsWith('REPLACE_WITH')
  );
}

async function callRelay(action: string, body: Record<string, unknown>): Promise<RelayResponse | null> {
  if (!isAdminAlertConfigured()) {
    if (__DEV__) {
      console.warn(
        `[adminAlerts] skipped "${action}": appConfig.messaging.adminAlertWebhook is not filled in yet ` +
          '(see docs/apps-script-admin-alerts.gs).',
      );
    }
    return null;
  }

  const { appsScriptUrl, sharedSecret } = AppConfig.messaging.adminAlertWebhook;
  try {
    const res = await fetch(appsScriptUrl, {
      method: 'POST',
      // Apps Script answers a JSON POST with a 302 to a googleusercontent URL;
      // fetch follows it automatically, which is why no CORS/redirect handling
      // is needed here. text/plain avoids the CORS preflight Apps Script cannot
      // answer — the script parses the body itself either way.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, secret: sharedSecret, ...body }),
    });
    const parsed = (await res.json().catch(() => null)) as RelayResponse | null;
    if (__DEV__ && parsed && parsed.ok === false) {
      console.warn(`[adminAlerts] relay rejected "${action}":`, parsed.error ?? 'unknown');
    }
    return parsed;
  } catch (e) {
    if (__DEV__) console.warn(`[adminAlerts] "${action}" failed:`, e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Stores THIS device's push token with the relay so it starts receiving report
 * alerts. Call only for a signed-in admin. Safe to call repeatedly — the relay
 * keys devices by installation id and overwrites in place.
 */
export async function registerAdminAlertDevice(args: {
  token: string;
  uid: string;
  name?: string | null;
}): Promise<void> {
  if (!args.token) return;
  const deviceId = await getDeviceInstallationId().catch(() => null);
  if (!deviceId) return;
  await callRelay('admin_register', {
    deviceId,
    token: args.token,
    uid: args.uid,
    name: args.name ?? '',
    platform: Platform.OS,
    appVersion: AppConfig.identity.version,
  });
}

/**
 * Removes this device from the relay. Called when an admin signs out, so a shared
 * or handed-on phone stops receiving other people's reports.
 */
export async function unregisterAdminAlertDevice(): Promise<void> {
  const deviceId = await getDeviceInstallationId().catch(() => null);
  if (!deviceId) return;
  await callRelay('admin_unregister', { deviceId });
}

export interface AdminReportAlert {
  reportId: string;
  reporterName?: string | null;
  /** Origin badge, e.g. "Exam · Set 3" or "App · Report a Problem". */
  contextLabel?: string | null;
  /** The chosen category, or the user's own words for "Other". */
  reason?: string | null;
  /** Short title of the reported item. */
  targetTitle?: string | null;
  description?: string | null;
}

/**
 * Asks the relay to push "new report" to every registered admin device.
 *
 * Fire-and-forget by design: callers should NOT await this in a way that can
 * delay or fail the user's submission.
 */
export async function notifyAdminsOfReport(alert: AdminReportAlert): Promise<void> {
  await callRelay('report_created', {
    reportId: alert.reportId,
    reporterName: alert.reporterName ?? '',
    contextLabel: alert.contextLabel ?? '',
    reason: alert.reason ?? '',
    targetTitle: alert.targetTitle ?? '',
    description: alert.description ?? '',
    deepLink: `${ADMIN_REPORT_QUEUE}/${alert.reportId}`,
  });
}
