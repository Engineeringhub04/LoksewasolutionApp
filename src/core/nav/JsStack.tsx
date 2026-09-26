// JS-stack navigator for Expo Router with a custom page transition.
//
// WHY THIS EXISTS: expo-router's default <Stack> is a NATIVE stack, which
// cannot run a custom `cardStyleInterpolator`. `@react-navigation/stack` is the
// JS stack that can; `withLayoutContext` is the official bridge that lets
// Expo Router use it as a layout.
//
// REQUIRES:  npm install @react-navigation/stack
import {
  createStackNavigator,
  type StackNavigationOptions,
  type StackCardInterpolationProps,
  type StackCardInterpolatedStyle,
} from '@react-navigation/stack';
import type { ParamListBase, StackNavigationState } from '@react-navigation/native';
import { withLayoutContext } from 'expo-router';
// NOTE: Easing must come from 'react-native', NOT 'react-native-reanimated'.
// @react-navigation/stack animates with React Native's core Animated API, and
// Reanimated's Easing.bezier() returns an object instead of a function, which
// crashes with "this._easing is not a function".
import { Easing } from 'react-native';

const { Navigator } = createStackNavigator();

export const JsStack = withLayoutContext<
  StackNavigationOptions,
  typeof Navigator,
  StackNavigationState<ParamListBase>,
  never
>(Navigator);

// ---- timing ------------------------------------------------------------------
// Change this one number to make the fade faster (250) or slower (450).
export const TRANSITION_DURATION = 350;

export function customCardStyleInterpolator({
  current,
}: StackCardInterpolationProps): StackCardInterpolatedStyle {
  // Pure fade, no movement.
  // Opening: the new page fades 0 -> 1.
  // Closing: the same progress runs in reverse, so the page fades 1 -> 0.
  const opacity = current.progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return {
    cardStyle: { opacity },
  };
}

/**
 * Screen options that give a route the transition. Spread onto
 * <JsStack screenOptions={...}> or a single <JsStack.Screen options={...}>.
 */
export const customTransitionOptions: StackNavigationOptions = {
  headerShown: false,
  cardOverlayEnabled: false,
  gestureEnabled: true,
  transitionSpec: {
    open: {
      animation: 'timing',
      config: {
        duration: TRANSITION_DURATION,
        easing: Easing.bezier(0.2, 0, 0, 1),
      },
    },
    close: {
      animation: 'timing',
      config: {
        duration: TRANSITION_DURATION,
        easing: Easing.bezier(0.2, 0, 0, 1),
      },
    },
  },
  cardStyleInterpolator: customCardStyleInterpolator,
};