// Thin hook wrapper over the network store (PRD §9.4).
import { useIsOnline, useIsNetworkChecked } from '@/src/core/store/networkStore';

export function useNetworkStatus() {
  const isOnline = useIsOnline();
  // `isChecked` lets callers distinguish "NetInfo has actually reported a status" from
  // the optimistic `isConnected: true` default the store starts with. Anything that
  // BLOCKS the user for being offline must wait for this, so a not-yet-initialized
  // listener is never mistaken for a real offline state.
  const isChecked = useIsNetworkChecked();
  return { isOnline, isOffline: !isOnline, isChecked };
}
