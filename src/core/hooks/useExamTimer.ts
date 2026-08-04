// Real-elapsed-time exam timer (PRD §25 Critical: timer survives backgrounding).
// Computes remaining time from a fixed end timestamp rather than counting down
// ticks, so brief connectivity loss or app backgrounding never loses time.
import { useEffect, useRef, useState } from 'react';

export function useExamTimer(durationMinutes: number, onExpire: () => void) {
  const endAtRef = useRef<number>(Date.now() + durationMinutes * 60 * 1000);
  const [remainingSeconds, setRemainingSeconds] = useState(durationMinutes * 60);
  const expiredRef = useRef(false);

  useEffect(() => {
    const tick = () => {
      const remaining = Math.max(0, Math.round((endAtRef.current - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      if (remaining <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpire();
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const isWarning = remainingSeconds <= durationMinutes * 60 * 0.2;
  const isCritical = remainingSeconds <= 60;

  return { remainingSeconds, formatted, isWarning, isCritical };
}
