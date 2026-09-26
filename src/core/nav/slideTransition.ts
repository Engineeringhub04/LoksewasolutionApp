import { interpolate } from 'react-native-reanimated';
import Transition, {
  type ScreenTransitionConfig,
} from 'react-native-screen-transitions';

// Rounded corner while the page is moving (same look as the tutorial video).
const SLIDE_BORDER_RADIUS = 60;

export const slideOptions: ScreenTransitionConfig = {
  gestureEnabled: true,
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
          borderRadius: active.settled ? 0 : SLIDE_BORDER_RADIUS,
          borderCurve: active.settled ? 'continuous' : 'circular',
          overflow: 'hidden',
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