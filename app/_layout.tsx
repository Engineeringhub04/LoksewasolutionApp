import React, { useCallback, useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import * as Linking from 'expo-linking';
import * as NativeSplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { ThemeProvider, useTheme } from '@/src/core/theme';
import { I18nProvider, useTranslation } from '@/src/core/i18n';
import { ToastHost } from '@/src/components/feedback/ToastHost';
import { OfflineBanner } from '@/src/components/feedback/OfflineBanner';
import { DeviceEvictionDialog } from '@/src/components/auth/DeviceEvictionDialog';
import { initNetworkListener } from '@/src/core/store/networkStore';
import { initAuthListener, useAuthStore } from '@/src/core/store/authStore';
import { useProfileStore } from '@/src/core/store/profileStore';
import { hasActivePremium } from '@/src/core/firebase/services/profile';
import { useNotificationStore } from '@/src/core/store/notificationStore';
import { initNotifications } from '@/src/core/notifications/initNotifications';
import { useDeviceSessionGuard } from '@/src/core/hooks/useDeviceSessionGuard';
import { startAppUsageTracking, stopAppUsageTracking } from '@/src/core/services/appUsage';
import { ensureDailyAnalyticsSnapshot } from '@/src/core/services/mainLeaderboard';

export const unstable_settings = {
  anchor: 'index',
};

/**
 * Hold the native splash screen up until app/index.tsx explicitly hides it, once
 * its routing decision is made.
 *
 * MODULE SCOPE, NOT THE COMPONENT BODY — and that is the entire point.
 *
 * This used to sit inside RootLayout, so it re-ran on every single render of the
 * root. Most of the time that was merely wasteful; on iOS it was a crash report.
 * Once app/index.tsx has called hideAsync(), the splash is no longer registered
 * against the view controller, and asking to prevent the auto-hide of something
 * that is already gone rejects with:
 *
 *   No native splash screen registered for given view controller.
 *   Call 'SplashScreen.show' for given view controller first.
 *
 * The device-eviction path made that certain rather than occasional: signing out
 * on the splash screen empties the auth store, the root re-renders, and the call
 * fired again a moment after the splash had been hidden — which is exactly when
 * the user was seeing the red "Uncaught (in promise)" box behind the sign-out
 * notice. At module scope it runs once per bundle load, before the React tree
 * exists, which is what the intent always was.
 *
 * The .catch is the belt to that braces: a rejection here must never reach the
 * app as an unhandled promise, because failing to hold a splash screen is not a
 * failure worth showing anyone.
 */
NativeSplashScreen.preventAutoHideAsync().catch(() => undefined);

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function getResetLinkParams(url: string) {
  const outer = Linking.parse(url);
  const nestedLink = firstParam(outer.queryParams?.link);
  const actionUrl = nestedLink || url;
  const parsed = Linking.parse(actionUrl);
  const mode = firstParam(parsed.queryParams?.mode);
  const oobCode = firstParam(parsed.queryParams?.oobCode);

  if (mode !== 'resetPassword' || !oobCode) return null;
  return { mode, oobCode };
}

function RootStack() {
  const router = useRouter();
  const { colors, effective } = useTheme();
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const systemBottomInset = Platform.OS === 'android' ? Math.max(0, insets.bottom) : 0;
  const isTabRoute = segments.some((segment) => segment === '(tabs)');
  const isAuthRoute = segments.some((segment) => segment === '(auth)');
  const isSplashRoute = (segments as readonly string[])[0] === 'index';
  const showNonTabSystemBackdrop =
    Platform.OS === 'android' && !isTabRoute && !isSplashRoute && systemBottomInset > 0;
  const userUid = useAuthStore((s) => s.user?.uid ?? null);
  const courseInfo = useProfileStore((s) => s.courseInfo);
  const handledResetUrl = useRef<string | null>(null);
  const { language } = useTranslation();

  // Kill the white flash behind every page transition.
  //
  // THE PROBLEM: while a native push/pop animation plays, react-native-screens
  // momentarily exposes whatever sits UNDERNEATH the navigator — the app's root
  // view. That view's colour is not controlled by any screen's `contentStyle`
  // (those only paint the screen itself), so the OS default — white — peeks
  // through for a frame or two on Android, most visibly on dark mode and on
  // pop, where it reads as a hard white flicker instead of a smooth slide.
  //
  // THE FIX: paint the root view at the OS level. expo-system-ui's
  // setRootViewBackgroundColor targets the true root, beneath both the
  // navigator and the safe-area provider, so there is nothing left to flash.
  // It tracks the theme, so light and dark both stay correct — and because the
  // colour is applied imperatively the moment it changes, it is live from the
  // very first frame, before React has mounted anything.
  //
  // THE SPLASH EXCEPTION: the splash screen is a fixed navy gradient
  // (#03145C — see app/index.tsx styles.container), NOT the theme background.
  // Painting the root with the theme colour there would put a LIGHT root under
  // a DARK splash, so the splash → home push flashed white for a frame on
  // exactly the one transition every user sees on every launch. While the
  // splash route is active the root wears the splash's own navy instead.
  const rootPaint =
    isSplashRoute && Platform.OS === 'android' ? '#03145C' : colors.background;
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(rootPaint).catch(() => undefined);
  }, [rootPaint]);

  // Kept in a ref so the notification init (run once) always reads the CURRENT
  // language when it saves a token, without re-initializing on every switch.
  const languageRef = useRef(language);
  languageRef.current = language;

  const openResetLink = useCallback((url: string | null) => {
    if (!url || handledResetUrl.current === url) return;

    const resetParams = getResetLinkParams(url);
    if (!resetParams) return;

    handledResetUrl.current = url;
    router.replace({ pathname: '/reset-password', params: resetParams });
  }, [router]);

  useEffect(() => {
    let mounted = true;
    void Linking.getInitialURL()
      .then((url) => {
        if (mounted) openResetLink(url);
      })
      .catch(() => undefined);

    const subscription = Linking.addEventListener('url', ({ url }) => openResetLink(url));
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [openResetLink]);

  useEffect(() => {
    const unsubNetwork = initNetworkListener();
    const unsubAuth = initAuthListener();
    // Push notifications: registers this device's Expo token (login → user doc,
    // logout → anonymous device collection) and routes taps to their deep link.
    // No-op in Expo Go / on simulators; requires an EAS build to actually receive.
    const unsubNotifications = initNotifications({
      getLanguage: () => languageRef.current,
      onDeepLink: (deepLink) => router.push(deepLink as never),
      // A push arriving while the app is open bumps the Home bell instantly.
      // REST-only Firestore has no onSnapshot, so this listener is what keeps
      // the badge live without a manual refresh.
      onReceived: () => useNotificationStore.getState().increment(1),
    });
    return () => {
      unsubNetwork();
      unsubAuth();
      unsubNotifications();
    };
  }, [router]);

  // One account = one device. If this phone's claim was taken over elsewhere, the
  // guard raises `eviction` and the dialog below goes over the entire app until
  // its single button signs out — the session is deliberately left alive until
  // then, so nothing behind the dialog empties itself while the user is reading.
  //
  // Disabled on the splash screen and the auth stack because both run this check
  // themselves: splash decides a cold start, the login screen explains one that
  // already happened. Two checkers on one screen means two dialogs.
  const {
    eviction: deviceEviction,
    acknowledge: acknowledgeEviction,
    acknowledging: evictionBusy,
  } = useDeviceSessionGuard(userUid, { enabled: !isSplashRoute && !isAuthRoute });

  // Warm the profile cache in the BACKGROUND as soon as a session exists, so the
  // Profile tab renders real data immediately instead of showing a loader on
  // first open. Cleared on sign-out so the next account never sees stale data.
  //
  // App usage tracking rides along here: it needs exactly the same lifecycle
  // (start on session, stop on sign-out) and the same uid.
  useEffect(() => {
    if (userUid) {
      void useProfileStore.getState().load(userUid);
      startAppUsageTracking(userUid);
    } else {
      useProfileStore.getState().clear();
      void stopAppUsageTracking();
    }
  }, [userUid]);

  // One analytics snapshot per Kathmandu day the app is opened.
  //
  // The trend charts are built by differencing cumulative snapshots, so a day
  // with no snapshot is a hole in the history — and a user who studies without
  // ever visiting the Leaderboard or Analytics screens would leave nothing but
  // holes. Running it here, once the enrolled subcourse is known, is what keeps
  // the streak and the heatmap truthful.
  //
  // Deliberately NOT dependent on `profile`: the name and photo are only used to
  // label the public leaderboard row, and re-running this every time an
  // unrelated profile field changes would waste a full recompute. The
  // AsyncStorage day marker inside makes repeat calls almost free regardless.
  //
  // Whatever it publishes goes straight into the profile store. The store has
  // already read the stored copy by now, but a publish recomputes from scratch,
  // so its numbers are strictly newer — and handing them over costs nothing,
  // whereas re-reading them would cost another document.
  useEffect(() => {
    if (!userUid || !courseInfo?.subcourseId) return;
    const { profile } = useProfileStore.getState();
    void ensureDailyAnalyticsSnapshot(userUid, courseInfo.courseId ?? '', courseInfo.subcourseId, {
      name: profile?.name || '',
      photoURL: profile?.photoURL ?? null,
      isPro: hasActivePremium(profile),
    }).then((published) => {
      if (published) useProfileStore.getState().setScore(published);
    });
  }, [userUid, courseInfo?.courseId, courseInfo?.subcourseId]);

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
          // TRANSITION = the reference-project look (react-navigation-custom-
          // transition): a quick FADE with a barely-there drift — open 260ms,
          // close slightly quicker, a soft ease. That project achieves it with
          // @react-navigation/stack's cardStyleInterpolator (JS stack); our
          // expo-router runs the NATIVE stack, which has no interpolator hook —
          // but its `fade` animation is visually the same family (cross-fade,
          // no big slide), so we match the duration and keep the feel.
          //
          // WHY THE OLD WHITE-FLASH WORRY IS (MOSTLY) GONE: the fade alpha-
          // blends two screen layers, and whatever sits underneath shows
          // through mid-fade. That underneath colour is now painted at the OS
          // level via SystemUI.setBackgroundColorAsync (rootPaint below) and
          // via contentStyle, so mid-fade shows the app background, not white.
          // NOTE: this is only fully true in a REAL build — Expo Go's shared
          // shell can still flash. Test on the local release APK, not Expo Go.
          //
          // The perf discipline stays: freezeOnBlur + the JS-thread holds in
          // useAsyncData / Preloading keep the fade's frame budget free.
          animation: 'fade',
          // Reference project: OPEN_DURATION 260 / CLOSE_DURATION 240 with
          // Easing.bezier(0.2, 0, 0, 1). native-stack takes one number, so we
          // use 260 for both directions (close reads faster anyway because the
          // old screen is already familiar).
          animationDuration: 260,
          animationTypeForReplace: 'push',
          // Without this the screen you just pushed away stays fully mounted and
          // keeps re-rendering: zustand subscriptions, interval timers, AppState
          // listeners and Reanimated loops all stay live. For the ~300ms the
          // slide is playing the JS thread is doing TWO screens' work, which is
          // exactly when it can least afford to. Freezing the blurred screen is
          // what makes the animation's frame budget actually available.
          freezeOnBlur: true,
          // Reserve the Android system-navigation area for every regular route,
          // so scroll content cannot render underneath the system buttons/gesture
          // handle. Splash and the tab shell override this below because they
          // manage their own bottom layout.
          contentStyle: {
            backgroundColor: rootPaint,
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
            // The tab shell overrides only its INNER tab-switching animation
            // (a fade, in app/(tabs)/_layout.tsx). Entering or leaving the shell
            // itself is a normal page transition and matches the reference-
            // project fade (see the long note in screenOptions above).
            animation: 'fade',
            animationDuration: 260,
            animationTypeForReplace: 'push',
            contentStyle: { backgroundColor: colors.background },
          }}
        />
        <Stack.Screen
          name="course-setup"
          options={{
            // Reference-project look for this screen. NOTE: 'fade_from_right'
            // was tried here and CRASHED in Expo Go on Android (both push and
            // pop) — do not reintroduce it. Plain 'fade' is the safe value.
            animation: 'fade',
            animationDuration: 260,
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
      <DeviceEvictionDialog
        visible={deviceEviction !== null}
        mode="blocking"
        deviceName={deviceEviction?.deviceName}
        busy={evictionBusy}
        onConfirm={acknowledgeEviction}
      />
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
