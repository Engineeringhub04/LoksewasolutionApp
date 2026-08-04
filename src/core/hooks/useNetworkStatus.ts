// Thin hook wrapper over the network store (PRD §9.4).
import { useIsOnline } from '@/src/core/store/networkStore';

export function useNetworkStatus() {
  const isOnline = useIsOnline();
  return { isOnline, isOffline: !isOnline };
}
