// Keeps a screen aware of which calendar day it is, so date-scheduled content
// (the Daily Test release date) flips over on its own at 12:00 AM instead of
// waiting for the user to pull-to-refresh or relaunch the app.
//
// Design notes:
//   • A CHAINED setTimeout, never setInterval. The wait is recomputed from the
//     clock after every tick, so a DST change, a timezone change or the user
//     editing the system clock cannot make the schedule drift — the next fire is
//     always "however long is left until the next midnight, right now".
//   • A small pad past midnight, because a timer that fires at 23:59:59.998 would
//     compute yesterday's key and then sleep for a whole day.
//   • AppState: JS timers do not run reliably while the app is backgrounded, so
//     the day is also re-checked every time the app becomes active. In practice
//     this is the path that fires for most users (phone asleep overnight).
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { msUntilNextLocalMidnight, todayDateKey } from '@/src/core/firebase/services/dailyTest';

/** Fired a moment AFTER midnight so the new key is unambiguous. */
const MIDNIGHT_PAD_MS = 2_000;

interface UseLocalDayKeyOptions {
  /**
   * Called once when the day actually changes — not on mount. The landing screen
   * uses it to refetch, so models added to Firestore during the night appear
   * without the user doing anything.
   */
  onDayChange?: (dayKey: string) => void;
}

/**
 * Returns today's date key ("YYYY-MM-DD") and re-renders when it changes. Cheap:
 * no polling, no network, one timer.
 */
export function useLocalDayKey(options: UseLocalDayKeyOptions = {}): string {
  const [dayKey, setDayKey] = useState(() => todayDateKey());
  const dayKeyRef = useRef(dayKey);
  dayKeyRef.current = dayKey;

  // Held in a ref so a caller passing an inline arrow does not restart the timer
  // on every render.
  const onDayChangeRef = useRef(options.onDayChange);
  onDayChangeRef.current = options.onDayChange;

  const syncDay = useCallback(() => {
    const next = todayDateKey();
    if (next === dayKeyRef.current) return;
    dayKeyRef.current = next;
    setDayKey(next);
    onDayChangeRef.current?.(next);
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      const wait = Math.max(1_000, msUntilNextLocalMidnight() + MIDNIGHT_PAD_MS);
      timer = setTimeout(() => {
        syncDay();
        // Re-arm from the clock as it is NOW, rather than assuming 24h.
        schedule();
      }, wait);
    };
    schedule();

    const onAppState = (status: AppStateStatus) => {
      if (status !== 'active') return;
      // Coming back from the background: the timer may never have fired, so check
      // the date directly and rebuild the schedule around the current time.
      syncDay();
      if (timer) clearTimeout(timer);
      schedule();
    };
    const sub = AppState.addEventListener('change', onAppState);

    return () => {
      if (timer) clearTimeout(timer);
      sub.remove();
    };
  }, [syncDay]);

  return dayKey;
}
