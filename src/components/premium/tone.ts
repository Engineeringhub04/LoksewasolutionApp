// Tone system for tinted surfaces — the fix for "light theme ma text dekhindaina".
//
// The old detail screens hardcoded panel colours (#1E2A5A, #8A3F0A, #EEF2FF …)
// and then paired them with theme text. That can only be right in one mode: a
// fixed dark panel with light text turns unreadable the moment the surrounding
// text colour flips, and a fixed light panel keeps light-mode text in dark mode.
//
// A tone instead DERIVES everything from the active theme's own semantic colour,
// so the foreground is always the saturated colour and the background is that
// same colour at low alpha over the current surface. Contrast therefore holds in
// both modes by construction, not by being checked by eye.
import type { ThemeColors } from '@/src/core/theme/tokens';
import { useMemo } from 'react';
import { useTheme } from '@/src/core/theme';

export type Tone = 'neutral' | 'primary' | 'info' | 'success' | 'warning' | 'danger' | 'accent';

export interface ToneStyle {
  /** Text and icon colour. Saturated, sits on `bg`. */
  fg: string;
  /** Tinted fill. Low alpha so the page surface still shows through. */
  bg: string;
  /** Hairline border, stronger than `bg` but weaker than `fg`. */
  border: string;
  /** Solid fill for a filled pill/button, with `onSolid` text over it. */
  solid: string;
  onSolid: string;
}

/**
 * Alpha suffixes differ per mode on purpose: a 8% tint that reads as a gentle
 * wash on a white surface almost disappears on #0B1120, so dark mode gets a
 * heavier fill and a brighter border.
 */
export function toneStyle(colors: ThemeColors, tone: Tone, isDark: boolean): ToneStyle {
  const base = baseColor(colors, tone);
  return {
    fg: tone === 'neutral' ? colors.textSecondary : base,
    bg: `${base}${isDark ? '26' : '14'}`,
    border: `${base}${isDark ? '55' : '33'}`,
    solid: base,
    onSolid: colors.onPrimary,
  };
}

function baseColor(colors: ThemeColors, tone: Tone): string {
  switch (tone) {
    case 'primary': return colors.primary;
    case 'info': return colors.info;
    case 'success': return colors.success;
    case 'warning': return colors.warning;
    case 'danger': return colors.error;
    case 'accent': return colors.accent;
    default: return colors.textSecondary;
  }
}

const ALL_TONES: Tone[] = ['neutral', 'primary', 'info', 'success', 'warning', 'danger', 'accent'];

/**
 * Every tone for the active theme, as `tones.success.fg` etc. Memoised on the
 * theme so a screen can read tones inline in its JSX without rebuilding the map
 * on each render.
 */
export function useTones(): Record<Tone, ToneStyle> {
  const { colors, effective } = useTheme();
  return useMemo(() => {
    const isDark = effective === 'dark';
    return ALL_TONES.reduce((acc, tone) => {
      acc[tone] = toneStyle(colors, tone, isDark);
      return acc;
    }, {} as Record<Tone, ToneStyle>);
  }, [colors, effective]);
}
