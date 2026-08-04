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
    useNetworkStore.getState().setStatus(Boolean(state.isConnected && state.isInternetReachable !== false));
  });
  return unsubscribe;
}

export function useIsOnline() {
  return useNetworkStore((s) => s.isConnected);
}
