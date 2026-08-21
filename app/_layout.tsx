import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const { colors, effective } = useTheme();
  const insets = useSafeAreaInsets();
  const systemBottomInset = Platform.OS === 'android' ? Math.max(0, insets.bottom) : 0;
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
      <Stack
        screenOptions={{
          headerShown: false,
          // Use the native Android slide for regular pages. Splash and the tab
          // shell override this below so the existing white-flash fix remains
          // intact when the launch route is replaced by the app shell.
          animation: Platform.OS === 'android' ? 'slide_from_right' : undefined,
          // Reserve the Android system-navigation area for every regular route,
          // so scroll content cannot render underneath the system buttons/gesture
          // handle. Splash and the tab shell override this below because they
          // manage their own bottom layout.
          contentStyle: {
            backgroundColor: colors.background,
            paddingBottom: systemBottomInset,
          },
        }}
      >
        <Stack.Screen
          name="index"
          options={{ animation: 'none', contentStyle: { backgroundColor: colors.background } }}
        />
        <Stack.Screen
          name="(tabs)"
          options={{ animation: 'none', contentStyle: { backgroundColor: colors.background } }}
        />
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
