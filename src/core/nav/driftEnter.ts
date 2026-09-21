// The reference-project entrance (react-navigation-custom-transition):
// the page content fades in while drifting ~12% of the screen width from the
// right, over ~260ms with a soft curve — exactly what that project's
// cardStyleInterpolator did. Native-stack has no interpolator hook (and its
// built-in 'fade_from_right' CRASHES on Android/Expo Go), so the drift is
// applied as an `entering` on the screen's root content instead. The native
// animation stays 'fade', which blends invisibly with this.
import { withTiming, Easing } from 'react-native-reanimated';

export const driftEnter = (values: { targetWidths: number }) => {
  'worklet';
  const animations = {
    opacity: withTiming(1, { duration: 260, easing: Easing.bezier(0.2, 0, 0, 1) }),
    transform: [
      { translateX: withTiming(0, { duration: 260, easing: Easing.bezier(0.2, 0, 0, 1) }) },
    ],
  };
  const initialValues = {
    opacity: 0,
    transform: [{ translateX: values.targetWidths * 0.12 }],
  };
  return { initialValues, animations };
};
