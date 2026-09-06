// Low-level Google Form submitter.
//
// Google Forms accepts a plain application/x-www-form-urlencoded POST to
// /formResponse, which is what lets the app submit without any backend, SDK or
// API key. The form must have "Collect email addresses", "Limit to 1 response"
// and any org restriction turned OFF, otherwise Google requires a signed-in
// Google account and rejects the request.
//
// The body is assembled by hand rather than with URLSearchParams because React
// Native's URLSearchParams polyfill is incomplete across platforms.
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { AppConfig } from '@/src/core/config/appConfig';
import { getCurrentUser } from '@/src/core/firebase/session';

export type MessageType = 'contact' | 'feedback' | 'report';

export interface FormSubmission {
  type: MessageType;
  message: string;
  /** Feedback only — 1..5 */
  rating?: number;
  /** Report only — which question/exam the user is referring to. */
  questionReference?: string;
  /** Report only — bug / typo / wrong-answer / etc. */
  issueCategory?: string;
}

function buildBody(fields: Record<string, string | undefined>): string {
  return Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
}

/**
 * Submits one message to the Google Form. Resolves on success and throws on
 * failure so screens can show an error toast and let the user retry.
 *
 * Identity (name/email/uid) is attached automatically from the cached session so
 * replies are possible without asking the user to retype anything.
 */
export async function submitToGoogleForm(submission: FormSubmission): Promise<void> {
  const { formId, entries } = AppConfig.messaging.googleForm;
  const user = await getCurrentUser().catch(() => null);

  // Name + uid together, e.g. "Kishan Raut (Xy2f...)", so the inbox shows at a
  // glance WHO sent it without having to cross-reference the uid in Firestore.
  const displayName = user?.displayName?.trim();
  const uid = user?.uid ?? 'guest';
  const userIdField = displayName ? `${displayName} (${uid})` : uid;

  const body = buildBody({
    [entries.type]: submission.type,
    [entries.name]: user?.displayName ?? '',
    [entries.email]: user?.email ?? '',
    [entries.message]: submission.message,
    [entries.rating]: submission.rating !== undefined ? String(submission.rating) : '',
    [entries.questionReference]: submission.questionReference ?? '',
    [entries.issueCategory]: submission.issueCategory ?? '',
    [entries.appVersion]: AppConfig.identity.version,
    // Expo SDK is folded into the platform string rather than taking its own
    // field, so the form stays at the ten fields that were set up.
    [entries.platform]: `${Platform.OS} ${String(Platform.Version)} · Expo ${Constants.expoConfig?.sdkVersion ?? '?'}`,
    [entries.userId]: userIdField,
  });

  const res = await fetch(`https://docs.google.com/forms/d/e/${formId}/formResponse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  // Google answers a successful submission with the confirmation page (200).
  // Anything else means the form rejected it — most commonly because a sign-in
  // requirement is still enabled on the form.
  if (!res.ok) {
    throw new Error(`GOOGLE_FORM_SUBMIT_FAILED_${res.status}`);
  }
}
