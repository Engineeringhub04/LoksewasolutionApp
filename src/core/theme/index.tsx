// Theme provider (PRD §7.6). Light/Dark/System, persisted, instant switch.
import React, { createContext, useContext, useMemo, useEffect, useState, useCallback } from 'react';
import { Platform, useColorScheme } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colorsFor, spacing, radius, typography, elevation, gradients, motion, type ThemeColors, type ColorMode } from './tokens';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'loksewa:themeMode';

interface ThemeCtx {
  mode: ThemeMode;
  effective: ColorMode;
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  elevation: typeof elevation;
  gradients: typeof gradients;
  motion: typeof motion;
  setMode: (mode: ThemeMode) => void;
}

const Ctx = createContext<ThemeCtx | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') setModeState(stored);
    });
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const effective: ColorMode = mode === 'system' ? (systemScheme ?? 'light') : mode;

  // Keep Android's three-button/gesture navigation area visually continuous with
  // the app instead of allowing a device-default grey strip to appear below the
  // floating tab bar. The calls are guarded and best-effort because Expo Go and
  // older Android versions expose different subsets of the navigation-bar API.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    // With edge-to-edge enabled, Android draws the system navigation area over
    // the app. setStyle is the supported API for three-button navigation; the
    // native config disables forced contrast so the app background is not
    // replaced by a device-generated grey scrim.
    try {
      NavigationBar.setStyle(effective === 'dark' ? 'light' : 'dark');
    } catch {
      // Expo Go and older Android versions may not expose edge-to-edge styling.
    }
  }, [effective]);

  const value = useMemo<ThemeCtx>(() => {
    return {
      mode,
      effective,
      colors: colorsFor(effective),
      spacing,
      radius,
      typography,
      elevation,
      gradients,
      motion,
      setMode,
    };
  }, [mode, effective, setMode]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
