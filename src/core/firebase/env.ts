// Firebase project credentials — placeholders until the real project is created.
// See README.md "Firebase Setup" section for exact steps to obtain these values
// from the Firebase Console and replace them here (or via .env + EXPO_PUBLIC_* vars).
const PLACEHOLDER = 'REPLACE_WITH_REAL_VALUE';

export const firebaseEnv = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? PLACEHOLDER,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'REPLACE_WITH_PROJECT_ID.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? PLACEHOLDER,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'REPLACE_WITH_PROJECT_ID.appspot.com',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? PLACEHOLDER,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? PLACEHOLDER,
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? PLACEHOLDER,
};

export const isFirebaseConfigured = firebaseEnv.apiKey !== PLACEHOLDER && firebaseEnv.projectId !== PLACEHOLDER;

if (!isFirebaseConfigured && __DEV__) {
  console.warn(
    '[Firebase] Using placeholder config — real Firebase project not connected yet.\n' +
      'Set EXPO_PUBLIC_FIREBASE_* values in .env, see README.md "Firebase Setup".'
  );
}
