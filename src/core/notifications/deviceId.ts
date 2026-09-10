// Stable per-installation id used to key a device's push-token document.
//
// Push tokens must overwrite in place (one row per device) instead of piling up
// a new row on every launch/permission-grant, so we need an id that survives
// app restarts but is unique to this install. We mint a random UUID once and
// persist it in AsyncStorage; it is NOT tied to the hardware (no IMEI/MAC) so it
// resets on reinstall — which is exactly what we want for an anonymous token.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const DEVICE_ID_KEY = 'loksewa:deviceInstallationId';

let cached: string | null = null;

/** Returns this installation's stable id, creating and persisting one on first use. */
export async function getDeviceInstallationId(): Promise<string> {
  if (cached) return cached;

  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) {
    cached = existing;
    return existing;
  }

  const fresh = Crypto.randomUUID();
  await AsyncStorage.setItem(DEVICE_ID_KEY, fresh);
  cached = fresh;
  return fresh;
}
