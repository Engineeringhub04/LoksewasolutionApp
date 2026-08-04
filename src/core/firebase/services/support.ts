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
