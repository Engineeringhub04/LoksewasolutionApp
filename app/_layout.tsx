import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { ThemeProvider, useTheme } from '@/src/core/theme';
import { I18nProvider } from '@/src/core/i18n';
import { ToastHost } from '@/src/components/feedback/ToastHost';
import { OfflineBanner } from '@/src/components/feedback/OfflineBanner';
import { initNetworkListener } from '@/src/core/store/networkStore';
import { initAuthListener, useAuthStore } from '@/src/core/store/authStore';
import { useProfileStore } from '@/src/core/store/profileStore';

export const unstable_settings = {
  anchor: 'index',
};

function RootStack() {
  const { effective } = useTheme();
  const userUid = useAuthStore((s) => s.user?.uid ?? null);

  useEffect(() => {
    const unsubNetwork = initNetworkListener();
    const unsubAuth = initAuthListener();
    return () => {
      unsubNetwork();
      unsubAuth();
    };
  }, []);

  // Warm the profile cache in the BACKGROUND as soon as a session exists, so the
  // Profile tab renders real data immediately instead of showing a loader on
  // first open. Cleared on sign-out so the next account never sees stale data.
  useEffect(() => {
    if (userUid) {
      void useProfileStore.getState().load(userUid);
    } else {
      useProfileStore.getState().clear();
    }
  }, [userUid]);

  return (
    <>
      <OfflineBanner />
      {/*
        Global default: EVERY screen manages its own header (TopAppBar,
        SubpageHeader, or a custom hand-rolled header) — none of them should
        ever get Expo Router / React Navigation's native stack header on top
        of that. Previously only a handful of routes explicitly set
        headerShown:false, so every OTHER screen (notifications, downloads,
        achievements, analytics, notes, gorkhapatra, leaderboard, search,
        settings, subjects, quiz, mock-test, discussion, etc.) silently fell
        back to the native header, producing a double-header on top of our
        own custom header component. Setting headerShown:false as the Stack's
        default screenOptions fixes this for every current AND future route
        in one place, instead of needing to remember to list each one.
      */}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="blocking/no-internet" options={{ gestureEnabled: false }} />
        <Stack.Screen name="blocking/maintenance" options={{ gestureEnabled: false }} />
      </Stack>
      <ToastHost />
      <StatusBar style={effective === 'dark' ? 'light' : 'dark'} />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <I18nProvider>
            <RootStack />
          </I18nProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
