import { BlankStack } from 'react-native-screen-transitions/expo-router';
import { slideOptions } from '@/src/core/nav/slideTransition';

// Static screen options — hoisted to module scope so the object identity is
// stable across renders. An inline object here would be a NEW reference on
// every render, which makes BlankStack do a state update during the render
// phase ("Can't perform a React state update on a component that hasn't
// mounted yet").
const AUTH_SCREEN_OPTIONS = {
  // Same app-wide Exametix-style slide as the root layout.
  // (BlankStack has no header by default, so headerShown is unnecessary.)
  ...slideOptions,
};

export default function AuthLayout() {
  return (
    <BlankStack screenOptions={AUTH_SCREEN_OPTIONS}>
      <BlankStack.Screen name="login" />
      <BlankStack.Screen name="signup" />
      <BlankStack.Screen name="forgot-password" />
    </BlankStack>
  );
}
