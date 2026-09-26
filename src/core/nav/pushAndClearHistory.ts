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
 *
 * NOTE: uses navigation.reset() directly — no @react-navigation/native
 * import, because expo-router SDK 56+ flags that import as incompatible
 * (EXPO_ROUTER_DISABLE_RN_NAVIGATION_CHECK).
 *
 * @param router - expo-router's router object (needs push)
 * @param navigation - navigation object from useNavigation() (needs reset + addListener)
 * @param path - the href to navigate to (e.g. '/(tabs)')
 * @param routeName - the route NAME for the reset (e.g. '(tabs)', NOT '/(tabs)')
 */
type PushOnly = {
  push: (path: string) => void;
};

type ResetOnly = {
  reset: (state: { index: number; routes: { name: string }[] }) => void;
  addListener: (event: 'transitionEnd', callback: () => void) => () => void;
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
    navigation.reset({
      index: 0,
      routes: [{ name: routeName }],
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
  const unsubscribe = navigation.addListener('transitionEnd', () => {
    unsubscribe();
    doReset();
  });

  // Safety net: if the event never fires (interrupted transition, backgrounded
  // app), reset anyway well after any animation could still be running.
  setTimeout(() => {
    unsubscribe();
    doReset();
  }, 2500);
}
