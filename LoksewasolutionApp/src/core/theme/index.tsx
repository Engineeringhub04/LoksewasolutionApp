// Theme provider (PRD §7.6). Light/Dark/System, persisted, instant switch.
import React, { createContext, useContext, useMemo, useEffect, useState, useCallback } from 'react';
import { useColorScheme } from 'react-native';
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

  const value = useMemo<ThemeCtx>(() => {
    const effective: ColorMode = mode === 'system' ? (systemScheme ?? 'light') : mode;
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
  }, [mode, systemScheme, setMode]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
