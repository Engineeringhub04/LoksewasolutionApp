/**
 * Navigate with the slide animation AND clear the back history.
 *
 * THE PROBLEM: `router.replace()` does not trigger the slide animation with
 * react-native-screen-transitions' BlankStack — the screen swaps instantly
 * with no animation, which also makes the button feel slow/unresponsive.
 * `router.push()` animates correctly, but leaves the old screen in the back
 * stack (pressing back would return to Splash/Login, which is wrong).
 *
 * THE FIX: push (which animates), then once the transition has FULLY
 * completed, reset the navigation state so the old screens are removed from
 * history. The reset itself is instant, but the user is already on the new
 * screen by then, so they never see it. Back button then works correctly.
 * NO REMOUNT: the reset reuses the pushed route's key (not a fresh route
 * object). A fresh key would unmount/remount the page — the 2s preloader
 * would restart from zero (double loading), and on low-end devices the
 * transition interpolator could get stuck on a stale progress value, leaving
 * the screen shifted with a grey strip (the frozen-transition glitch).
 * Same key = same screen instance = invisible reset.
 *
 * NOTE: uses navigation.reset() directly — no @react-navigation/native
 * import, because expo-router SDK 56+ flags that import as incompatible
 * (EXPO_ROUTER_DISABLE_RN_NAVIGATION_CHECK).
 *
 * @param router - expo-router's router object (needs push)
 * @param navigation - navigation object from useNavigation() (needs reset + addListener + getState)
 * @param path - the href to navigate to (e.g. '/(tabs)')
 * @param routeName - the route NAME for the reset (e.g. '(tabs)', NOT '/(tabs)')
 */
type PushOnly = {
  push: (path: string) => void;
};

type ResetOnly = {
  reset: (state: { index: number; routes: { name: string; key?: string }[] }) => void;
  addListener: (event: 'transitionEnd', callback: () => void) => () => void;
  getState: () => {
    index: number;
    routes: { name: string; key: string }[];
  };
};

export function pushAndClearHistory(
  router: PushOnly,
  navigation: ResetOnly,
  path: string,
  routeName: string,
): void {
  // Push animates with the slide transition.
  router.push(path);

  let settled = false;
  const doReset = () => {
    if (settled) return;
    settled = true;
    // Reuse the pushed route's key so React Navigation keeps the SAME screen
    // instance — no unmount/remount, no preloader restart, no stuck offset.
    // If the current route is NOT the target (user navigated away, or the
    // state is unexpected), do NOT reset at all — a reset with a fresh key
    // would unmount the live screen and leave a white flash/blank page.
    // Leaving the back history intact is far better than a white screen.
    let keepKey: string | undefined;
    try {
      const state = navigation.getState();
      const current = state.routes[state.index];
      if (!current || current.name !== routeName) return;
      keepKey = current.key;
    } catch {
      // getState unavailable — skip the reset rather than risk a blank page.
      return;
    }
    navigation.reset({
      index: 0,
      routes: [{ name: routeName, key: keepKey }],
    });
  };

  // Reset the instant the slide transition TRULY finishes — never mid-flight.
  //
  // WHY NOT A FIXED TIMEOUT: a timeout can only guess when the spring
  // settles. On a slow device (e.g. itel Vision 3) dropped frames stretch the
  // animation's real-time duration past any guess — 400ms froze the screen
  // mid-transition ("chakurai"), and even 800ms lands inside the tail on a
  // bad frame day, visibly pausing the animation a beat right before it
  // closes ("rokinxa ani closed hunx"). The `transitionEnd` event fires
  // exactly once when the animation completes, so the reset always lands
  // after the last frame, on every device, at every frame rate.
  //
  // NO SAFETY-NET TIMER: an earlier version had a 2.5s setTimeout fallback.
  // On some devices the timer fired while the home screen's 2s preloader was
  // still up, and the reset — even with the same key — interrupted the
  // preloader-to-content swap, leaving a permanent white screen. If
  // `transitionEnd` ever fails to fire, the back history simply isn't cleared
  // (pressing back returns to Splash, which forwards again) — far better
  // than a white screen.
  const unsubscribe = navigation.addListener('transitionEnd', () => {
    unsubscribe();
    doReset();
  });
}
