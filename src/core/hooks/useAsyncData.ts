// Generic data-fetching hook implementing the Loading/Empty/Error states (PRD §9.1-9.3)
// consistently across screens, with pull-to-refresh support (§9.6).
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseAsyncDataResult<T> {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: boolean;
  refetch: () => void;
  refresh: () => Promise<void>;
}

export function useAsyncData<T>(fetcher: () => Promise<T>, deps: unknown[] = []): UseAsyncDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(false);
    try {
      const result = await fetcherRef.current();
      setData(result);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return {
    data,
    loading,
    refreshing,
    error,
    refetch: () => load(false),
    refresh: () => load(true),
  };
}
