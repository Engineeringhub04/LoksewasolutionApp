// Static-page preloader: gives content-only pages (no database fetch) the same
// 2s preloading window that data pages get from useAsyncData's FIRST_LOAD_HOLD.
// The page transition plays clean, the glow-ring paints instantly, and only
// then does the static content swap in — so every page in the app feels the
// same when it opens.
import { useEffect, useState } from 'react';

/** How long a static page shows the preloader before revealing content. */
export const STATIC_PRELOAD_MS = 2000;

/**
 * Returns false for STATIC_PRELOAD_MS after mount, then true. Render the
 * preloader while false, the real content when true.
 */
export function usePagePreloader(delayMs: number = STATIC_PRELOAD_MS): boolean {
  const [ready, setReady] = useState(delayMs <= 0);
  useEffect(() => {
    if (delayMs <= 0) return;
    const timer = setTimeout(() => setReady(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);
  return ready;
}
