import React, { useEffect } from 'react';
import { Stack, useSegments } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
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
  const segments = useSegments();
  const systemBottomInset = Platform.OS === 'android' ? Math.max(0, insets.bottom) : 0;
  const isTabRoute = segments.some((segment) => segment === '(tabs)');
  const isSplashRoute = (segments as readonly string[])[0] === 'index';
  const showNonTabSystemBackdrop =
    Platform.OS === 'android' && !isTabRoute && !isSplashRoute && systemBottomInset > 0;
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
    <View style={[styles.root, { backgroundColor: colors.background }]}>
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
          // Use the native push/pop slide for every stack route. The tab shell
          // overrides only its inner tab switching animation; entering or leaving
          // the shell itself should still use the native page transition.
          animation: 'slide_from_right',
          animationTypeForReplace: 'push',
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
          options={{ contentStyle: { backgroundColor: colors.background } }}
        />
        <Stack.Screen
          name="(tabs)"
          options={{
            animation: 'slide_from_right',
            animationTypeForReplace: 'push',
            contentStyle: { backgroundColor: colors.background },
          }}
        />
        <Stack.Screen name="blocking/no-internet" options={{ gestureEnabled: false }} />
        <Stack.Screen name="blocking/maintenance" options={{ gestureEnabled: false }} />
      </Stack>
      {showNonTabSystemBackdrop ? (
        <View
          pointerEvents="none"
          style={[styles.nonTabSystemNavigationBackdrop, { height: systemBottomInset }]}
        />
      ) : null}
      <ToastHost />
      <StatusBar style={effective === 'dark' ? 'light' : 'dark'} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  nonTabSystemNavigationBackdrop: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#000000',
  },
});

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
