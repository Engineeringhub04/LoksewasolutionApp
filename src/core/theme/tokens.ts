// Design tokens (PRD §7). Single source of truth for colors, typography, spacing, radius, shadows.
// Brand-level colors sourced from AppConfig; mode-dependent variants defined here.
import { AppConfig } from '@/src/core/config/appConfig';

export type ColorMode = 'light' | 'dark';

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  onPrimary: string;
  background: string;
  surface: string;
  surfaceAlt: string;
  card: string;
  textPrimary: string;
  textSecondary: string;
  textDisabled: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  border: string;
  divider: string;
  overlay: string;
}

const brand = AppConfig.branding;

export const lightColors: ThemeColors = {
  primary: brand.primary,
  secondary: brand.secondary,
  accent: brand.accent,
  onPrimary: '#FFFFFF',
  background: '#F5F6FA',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF1F6',
  card: '#FFFFFF',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textDisabled: '#94A3B8',
  success: brand.success,
  warning: brand.warning,
  error: brand.error,
  info: brand.info,
  border: '#E2E8F0',
  divider: '#E5EAF4',
  overlay: 'rgba(15,23,42,0.5)',
};

export const darkColors: ThemeColors = {
  primary: '#3B82F6',
  secondary: brand.secondary,
  accent: brand.accent,
  onPrimary: '#FFFFFF',
  background: '#0B1120',
  surface: '#151D2E',
  surfaceAlt: '#1E293B',
  card: '#151D2E',
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textDisabled: '#64748B',
  success: '#22C55E',
  warning: brand.warning,
  error: '#F87171',
  info: '#60A5FA',
  border: '#263349',
  divider: '#1F2937',
  overlay: 'rgba(0,0,0,0.6)',
};

// 4dp grid (PRD §7.4)
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  screenPadding: 16,
  cardPadding: 16,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34 },
  h1: { fontSize: 24, fontWeight: '700' as const, lineHeight: 30 },
  h2: { fontSize: 20, fontWeight: '600' as const, lineHeight: 26 },
  h3: { fontSize: 17, fontWeight: '600' as const, lineHeight: 22 },
  bodyLarge: { fontSize: 16, fontWeight: '400' as const, lineHeight: 22 },
  body: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  bodySmall: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  caption: { fontSize: 11, fontWeight: '500' as const, lineHeight: 14 },
  overline: { fontSize: 10, fontWeight: '600' as const, lineHeight: 12 },
} as const;

// Elevation levels 0-5 mapped to shadow definitions (PRD §7.5)
export const elevation = {
  0: {},
  1: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  2: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  3: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  4: { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 7 },
  5: { shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
} as const;

export const gradients = {
  primary: brand.gradient,
  premiumGold: ['#F59E0B', '#D97706'] as const,
  splash: brand.gradients.splash,
};

// Motion durations (PRD §10.1) — never hardcode animation durations elsewhere.
export const motion = {
  micro: 120,
  standard: 300,
  emphasis: 500,
};

export function colorsFor(mode: ColorMode): ThemeColors {
  return mode === 'dark' ? darkColors : lightColors;
}
