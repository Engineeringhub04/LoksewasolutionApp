// SLIM version of the old gate (the full one was deleted 2026-09-21; this is
// only the entering-delay part, rebuilt because the zoom page transition and
// the screens' own FadeInDown entering animations were running at the same
// time and the text read as a slow, broken double-fade).
//
// Rule: the page transition is the animation. A screen's entering animations
// start AFTER it lands. MotionView adds the remaining transition time as a
// delay to each entering builder — content occupies its space immediately
// (opacity 0 / offset frame) and animates the instant the page settles.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'expo-router';
import Animated from 'react-native-reanimated';

/** The zoom/default transition is ~300ms; 400 gives a little settle room. */
const QUIET_MS = 400;

interface DelayApi {
  getEnterDelay: () => number;
}

const DelayContext = createContext<DelayApi | null>(null);

export function TransitionGateProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const startedAt = useRef(0);
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    startedAt.current = Date.now();
    const timer = setTimeout(() => {
      startedAt.current = 0;
    }, QUIET_MS);
    return () => clearTimeout(timer);
  }, [pathname]);

  const getEnterDelay = useCallback(() => {
    if (!startedAt.current) return 0;
    const left = QUIET_MS - (Date.now() - startedAt.current);
    return left > 0 ? left : 0;
  }, []);

  const delayApi = useMemo<DelayApi>(() => ({ getEnterDelay }), [getEnterDelay]);

  return <DelayContext.Provider value={delayApi}>{children}</DelayContext.Provider>;
}

export function useEnterDelay(): number {
  const api = useContext(DelayContext);
  const [delay] = useState(() => (api ? api.getEnterDelay() : 0));
  return delay;
}

type AnimatedViewProps = React.ComponentProps<typeof Animated.View>;

/**
 * Add `ms` to whatever delay the call site already asked for. Reanimated's
 * `.delay()` ASSIGNS rather than accumulates, so read `delayV` back and add —
 * this keeps every stagger (FadeInDown.delay(i*60)) intact.
 */
function withDelay(entering: AnimatedViewProps['entering'], ms: number): AnimatedViewProps['entering'] {
  if (!entering || ms <= 0) return entering;
  const builder = entering as unknown as {
    delay?: (value: number) => unknown;
    delayV?: number;
  };
  if (typeof builder.delay !== 'function') return entering;
  return builder.delay((builder.delayV ?? 0) + ms) as AnimatedViewProps['entering'];
}

/** Drop-in Animated.View replacement whose `entering` waits for the transition. */
export function MotionView({ entering, ...rest }: AnimatedViewProps) {
  const delay = useEnterDelay();
  const [resolved] = useState(() => withDelay(entering, delay));
  return <Animated.View entering={resolved} {...rest} />;
}
