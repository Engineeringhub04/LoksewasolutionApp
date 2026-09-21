// Generic data-fetching hook implementing the Loading/Empty/Error states (PRD §9.1-9.3)
// consistently across screens, with pull-to-refresh support (§9.6).
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Minimum quiet window (ms) the preloader gets BEFORE the first fetch begins.
 *
 * WHY THIS EXISTS — the biggest cause of the "page opens, white/frozen frame,
 * then it appears" jank on low-end Android. A screen's first render fires its
 * data fetch immediately, and that Firestore read + JSON parse lands on the JS
 * thread during the exact ~260ms the page transition needs. The transition
 * can't composite, so Android shows a frozen frame mid-transition.
 *
 * The fix: hold the FIRST fetch by this floor so the loader is never a
 * single-frame flash and the transition plays clean. Only the initial mount
 * fetch is held. Pull-to-refresh and param-change refetches run immediately —
 * the user is already looking at the page then.
 *
 * Want a longer clean-animation window (a deliberate 2s preloader)? Raise this
 * to 2000. It only delays the first paint of data; cached pages will show the
 * loader for that whole time, so keep it modest unless that is the intent.
 */
const FIRST_LOAD_HOLD_MS = 120;

interface UseAsyncDataResult<T> {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: boolean;
  /**
   * True once the FIRST fetch has settled at least once. The empty-state
   * guards use this instead of eyeballing `data`: a null `data` also means
   * "still loading", and trusting it flashed empty/demo content behind the
   * loader before the real rows arrived.
   */
  settled: boolean;
  refetch: () => void;
  refresh: () => Promise<void>;
}

interface UseAsyncDataOptions {
  /** Prevents a request until prerequisites such as auth/session hydration are ready. */
  enabled?: boolean;
}

export function useAsyncData<T>(
  fetcher: (isRefresh?: boolean) => Promise<T>,
  deps: unknown[] = [],
  options: UseAsyncDataOptions = {},
): UseAsyncDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [settled, setSettled] = useState(false);
  const enabled = options.enabled ?? true;
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const didFirstLoad = useRef(false);

  const load = useCallback(async (isRefresh: boolean) => {
    if (!enabled) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(false);
    try {
      const result = await fetcherRef.current(isRefresh);
      setData(result);
    } catch {
      setError(true);
    } finally {
      setSettled(true);
      setLoading(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled]);

  useEffect(() => {
    if (!enabled) return;

    // FIRST mount fetch: hold it by the small floor so the preloader is never
    // a single-frame flash. Every LATER fetch (a deps change, a param change)
    // runs immediately — the page is already on screen.
    if (!didFirstLoad.current) {
      didFirstLoad.current = true;
      if (FIRST_LOAD_HOLD_MS > 0) {
        const timer = setTimeout(() => load(false), FIRST_LOAD_HOLD_MS);
        return () => clearTimeout(timer);
      }
    }
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled]);

  // Stable identities: these get passed into effects and memo deps by callers
  // (e.g. useRefreshOnFocus). Re-creating them each render made any effect keyed
  // on them re-run on every render.
  const refetch = useCallback(() => {
    load(false);
  }, [load]);
  const refresh = useCallback(() => load(true), [load]);

  return {
    data,
    loading,
    refreshing,
    error,
    settled,
    refetch,
    refresh,
  };
}
