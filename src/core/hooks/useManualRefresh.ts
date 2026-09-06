// Pull-to-refresh state for screens that aren't driven by useAsyncData.
//
// Some screens render content that comes from local state, route params or
// bundled data (Search, Notice detail, About, Course Setup...). They still need
// the pull-to-refresh gesture so the interaction is identical everywhere in the
// app, so this provides the `refreshing` flag and an `onRefresh` handler,
// optionally running a real re-fetch action.
import { useCallback, useEffect, useRef, useState } from 'react';

const MIN_SPINNER_MS = 600;

export function useManualRefresh(action?: () => void | Promise<void>) {
  const [refreshing, setRefreshing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await action?.();
    } finally {
      // Held briefly so the spinner is actually perceivable even when the work
      // finishes instantly (or there is no work at all).
      timerRef.current = setTimeout(() => {
        if (mountedRef.current) setRefreshing(false);
      }, MIN_SPINNER_MS);
    }
  }, [action]);

  return { refreshing, onRefresh };
}
