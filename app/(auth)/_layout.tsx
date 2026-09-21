import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // 'fade' + 260ms — same reference-project transition as the root
        // app/_layout.tsx (see the long note there for the white-flash caveat,
        // which the OS-level root paint already handles).
        animation: 'fade',
        animationDuration: 260,
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
