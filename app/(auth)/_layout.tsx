import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Same app-wide transition as the root layout (see note there).
        animation: 'ios_from_right',
        animationTypeForReplace: 'push',
        // The screen behind a push keeps re-rendering otherwise — stores, timers
        // and Reanimated loops all stay live and compete with the slide for the
        // JS thread.
        freezeOnBlur: true,
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
