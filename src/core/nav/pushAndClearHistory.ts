/**
 * Navigate with the slide animation AND clear the back history.
 *
 * THE PROBLEM: `router.replace()` does not trigger the slide animation with
 * react-native-screen-transitions' BlankStack — the screen swaps instantly
 * with no animation, which also makes the button feel slow/unresponsive.
 * `router.push()` animates correctly, but leaves the old screen in the back
 * stack (pressing back would return to Splash/Login, which is wrong).
 *
 * THE FIX: push (which animates), then after the animation completes, reset
 * the navigation state so the old screens are removed from history. The reset
 * itself is instant, but the user is already on the new screen by then, so
 * they never see it. Back button then works correctly.
 *
 * NOTE: uses navigation.reset() directly — no @react-navigation/native
 * import, because expo-router SDK 56+ flags that import as incompatible
 * (EXPO_ROUTER_DISABLE_RN_NAVIGATION_CHECK).
 *
 * @param router - expo-router's router object (needs push)
 * @param navigation - navigation object from useNavigation() (needs reset)
 * @param path - the href to navigate to (e.g. '/(tabs)')
 * @param routeName - the route NAME for the reset (e.g. '(tabs)', NOT '/(tabs)')
 */
type PushOnly = {
  push: (path: string) => void;
};

type ResetOnly = {
  reset: (state: { index: number; routes: { name: string }[] }) => void;
};

export function pushAndClearHistory(
  router: PushOnly,
  navigation: ResetOnly,
  path: string,
  routeName: string,
): void {
  // Push animates with the slide transition.
  router.push(path);

  // After the animation fully completes, wipe the back stack. The user is
  // already on the new screen, so the instant reset is invisible.
  //
  // WHY 800ms AND NOT 400ms: on low-end devices (e.g. itel Vision 3) the
  // spring transition can still be running at 400ms because dropped frames
  // stretch its real-time duration. Resetting MID-transition tears the
  // transition state apart and leaves the new screen frozen part-way
  // translated (half the screen grey, content shifted sideways) — the
  // "chakurai" glitch. 800ms is safely past the spring's settle time even
  // with heavy jank.
  setTimeout(() => {
    navigation.reset({
      index: 0,
      routes: [{ name: routeName }],
    });
  }, 800);
}
