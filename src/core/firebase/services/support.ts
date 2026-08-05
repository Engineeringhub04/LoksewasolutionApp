// Support services (PRD §47.8): Contact Us + Report a Problem, with auto-attached
// device/app-version metadata.
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { createDocument, serverTimestamp } from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';
import { AppConfig } from '@/src/core/config/appConfig';

function deviceMetadata() {
  return {
    platform: Platform.OS,
    platformVersion: String(Platform.Version),
    appVersion: AppConfig.identity.version,
    expoSdk: Constants.expoConfig?.sdkVersion ?? 'unknown',
  };
}

export async function submitContactMessage(message: string): Promise<void> {
  await createDocument(Collections.contactMessages, {
    message,
    ...deviceMetadata(),
    createdAt: serverTimestamp(),
  });
}

export async function submitProblemReport(category: string, description: string, screenshotUri?: string | null): Promise<void> {
  await createDocument(Collections.reports, {
    targetType: 'app-problem',
    category,
    description,
    screenshotUri: screenshotUri ?? null,
    ...deviceMetadata(),
    createdAt: serverTimestamp(),
    status: 'open',
  });
}


/** App feedback with a 1–5 star rating (Profile → Support → Feedback). */
export async function submitFeedback(rating: number, message: string): Promise<void> {
  await createDocument(Collections.reports, {
    targetType: 'app-feedback',
    rating,
    description: message,
    ...deviceMetadata(),
    createdAt: serverTimestamp(),
    status: 'open',
  });
}

/**
 * Report an issue with a specific exam/quiz question (Profile → App Settings →
 * Report Question). `questionRef` is free text — the question number, exam name
 * or anything else that identifies it, since users rarely know the internal id.
 */
export async function submitQuestionReport(questionRef: string, issue: string, description: string): Promise<void> {
  await createDocument(Collections.reports, {
    targetType: 'question',
    questionRef,
    category: issue,
    description,
    ...deviceMetadata(),
    createdAt: serverTimestamp(),
    status: 'open',
  });
}
