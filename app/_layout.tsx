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
import { initAuthListener } from '@/src/core/store/authStore';

export const unstable_settings = {
  anchor: 'index',
};

function RootStack() {
  const { effective } = useTheme();

  useEffect(() => {
    const unsubNetwork = initNetworkListener();
    const unsubAuth = initAuthListener();
    return () => {
      unsubNetwork();
      unsubAuth();
    };
  }, []);

  return (
    <>
      <OfflineBanner />
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="blocking/update-required" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="blocking/no-internet" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="blocking/maintenance" options={{ headerShown: false, gestureEnabled: false }} />
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
