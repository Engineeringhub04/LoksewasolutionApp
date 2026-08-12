// Re-runs a fetch every time the screen comes back into focus.
//
// Without this, returning from a nested screen (summary -> exam list, upload ->
// details) showed stale data until the user pulled to refresh. Navigating back
// does NOT remount a screen, so a mount-time effect never re-runs.
//
// The first focus is skipped, because the screen's own initial load has already
// fetched at that point and firing again would double every request.
//
// The callback is held in a ref and the focus effect depends on NOTHING. This is
// deliberate: callers pass things like `refresh` from useAsyncData, which is a
// fresh closure on every render. If the effect depended on the callback it would
// re-run on each render, refresh, cause a re-render, and loop forever.
import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from 'expo-router';

export function useRefreshOnFocus(refresh: () => void) {
  const isFirstFocus = useRef(true);
  const refreshRef = useRef(refresh);

  // Keep the ref pointing at the newest closure so it always sees fresh state.
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      refreshRef.current();
    }, [])
  );
}
