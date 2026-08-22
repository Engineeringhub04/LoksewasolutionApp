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

  // Keep Android's system navigation area pure black in both three-button and
  // gesture modes. The custom glass tab bar is positioned immediately above
  // this native area, so no device-default grey strip can appear below it.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    try {
      NavigationBar.setPositionAsync('relative').catch(() => {});
      NavigationBar.setVisibilityAsync('visible').catch(() => {});
      NavigationBar.setBackgroundColorAsync('#000000').catch(() => {});
      NavigationBar.setBorderColorAsync('#000000').catch(() => {});
      NavigationBar.setButtonStyleAsync('light').catch(() => {});
    } catch {
      // Expo Go and older Android versions may not expose all navigation APIs.
    }
  }, []);

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
