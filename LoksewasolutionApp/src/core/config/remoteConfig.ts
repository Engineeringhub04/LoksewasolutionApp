// Remote-configurable fields (PRD §5.3): Maintenance Mode, Force Update, Feature Toggles.
// Fetched from Firestore at app start (Splash, PRD §11); local AppConfig is the fallback
// if the fetch fails or Firebase isn't configured yet.
import { getDocument } from '@/src/core/firebase/firestoreRest';
import { isFirebaseConfigured } from '@/src/core/firebase/env';
import { AppConfig } from './appConfig';

export interface RemoteConfig {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  forceUpdate: boolean;
  minimumVersion: string;
  latestVersion: string;
  features: typeof AppConfig.behavior.features;
}

function localFallback(): RemoteConfig {
  return {
    maintenanceMode: AppConfig.behavior.maintenanceMode,
    maintenanceMessage: AppConfig.behavior.maintenanceMessage,
    forceUpdate: AppConfig.behavior.forceUpdate,
    minimumVersion: AppConfig.behavior.minimumVersion,
    latestVersion: AppConfig.behavior.latestVersion,
    features: AppConfig.behavior.features,
  };
}

/** Resolves during Splash before dependent screens render (PRD §5.3, §11). */
export async function fetchRemoteConfig(): Promise<RemoteConfig> {
  if (!isFirebaseConfigured) return localFallback();
  try {
    const data = (await getDocument('meta/appConfig')) as Partial<RemoteConfig> | null;
    if (!data) return localFallback();
    const fallback = localFallback();
    return {
      maintenanceMode: data.maintenanceMode ?? fallback.maintenanceMode,
      maintenanceMessage: data.maintenanceMessage ?? fallback.maintenanceMessage,
      forceUpdate: data.forceUpdate ?? fallback.forceUpdate,
      minimumVersion: data.minimumVersion ?? fallback.minimumVersion,
      latestVersion: data.latestVersion ?? fallback.latestVersion,
      features: { ...fallback.features, ...(data.features ?? {}) },
    };
  } catch {
    return localFallback();
  }
}

export function isVersionBelow(current: string, minimum: string): boolean {
  const a = current.split('.').map(Number);
  const b = minimum.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x < y) return true;
    if (x > y) return false;
  }
  return false;
}
