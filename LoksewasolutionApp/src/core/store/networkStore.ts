// Global connectivity state (PRD §9.4, §45.2). Fed by NetInfo listener registered
// once in root layout via initNetworkListener(). Drives the Offline Banner and
// the No Internet blocking screen.
import { create } from 'zustand';
import NetInfo from '@react-native-community/netinfo';

interface NetworkState {
  isConnected: boolean;
  isChecked: boolean;
  setStatus: (isConnected: boolean) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isConnected: true,
  isChecked: false,
  setStatus: (isConnected) => set({ isConnected, isChecked: true }),
}));

let unsubscribe: (() => void) | null = null;

export function initNetworkListener() {
  if (unsubscribe) return unsubscribe;
  unsubscribe = NetInfo.addEventListener((state) => {
    // Only `isConnected` is trusted here. `isInternetReachable` is derived on Android
    // from an actual HTTP reachability probe, which routinely fails (returning false)
    // on perfectly working connections — behind ngrok/`--tunnel`, on slow mobile data,
    // or when the probe endpoint is unreachable. Previously this was ANDed in, so those
    // false negatives marked the app offline and Splash pushed users to the No Internet
    // blocking screen on Android while iOS (which resolves reachability differently)
    // worked fine. That was the real cause of the Android-only blocking-screen reports.
    useNetworkStore.getState().setStatus(Boolean(state.isConnected));
  });
  return unsubscribe;
}

export function useIsOnline() {
  return useNetworkStore((s) => s.isConnected);
}

/** True once NetInfo has delivered at least one real status update. */
export function useIsNetworkChecked() {
  return useNetworkStore((s) => s.isChecked);
}
