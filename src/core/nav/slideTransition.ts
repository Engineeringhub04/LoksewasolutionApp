import { Platform } from 'react-native';
import { interpolate } from 'react-native-reanimated';
import Transition, {
  type ScreenTransitionConfig,
} from 'react-native-screen-transitions';

// Clean full-screen slide (Exametix-style): no rounded corners, no scale —
// the page slides in from the right at full bleed, exactly like the native
// iOS push. The screen underneath drifts left slightly (parallax), matching
// the platform convention.
export const slideOptions: ScreenTransitionConfig = {
  // Swipe-to-go-back is an iOS convention. On Android it feels wrong and can
  // conflict with the system back gesture, so it's iOS-only.
  gestureEnabled: Platform.OS === 'ios',
  gestureDirection: 'horizontal',

  transitionSpec: {
    open: Transition.Specs.DefaultSpec,
    close: Transition.Specs.DefaultSpec,
  },

  screenStyleInterpolator: ({
    layouts: {
      screen: { width },
    },
    progress,
    active,
  }) => {
    'worklet';

    // progress 0 -> 1 : the new page slides in from the RIGHT (width -> 0)
    // progress 1 -> 2 : the page underneath drifts LEFT (0 -> -30% of width)
    const translateX = interpolate(
      progress,
      [0, 1, 2],
      [width, 0, -width * 0.3],
      'clamp'
    );

    return {
      content: {
        style: {
          transform: [{ translateX }],
        },
      },
      backdrop: {
        style: {
          backgroundColor: 'rgba(0,0,0,1)',
          opacity: interpolate(active.progress, [0, 1], [0, 0.1], 'clamp'),
        },
      },
    };
  },
};