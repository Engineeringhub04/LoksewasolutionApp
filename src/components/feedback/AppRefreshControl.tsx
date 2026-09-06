// Single source of truth for pull-to-refresh across every screen.
//
// `tintColor` controls the native iOS indicator and `colors` controls the
// native Android indicator. The native RefreshControl itself owns the pull
// progress, threshold, release gesture, and refresh lifecycle.
import { RefreshControl, type RefreshControlProps } from 'react-native';
import { useTheme } from '@/src/core/theme';

export type AppRefreshControlProps = Omit<
  RefreshControlProps,
  'tintColor' | 'colors' | 'progressBackgroundColor'
>;

/**
 * Home and Profile pass `progressViewOffset` because their existing headers
 * are fixed overlays. This keeps the platform-default indicator below those
 * headers without replacing the native pull-progress behavior.
 */
export function AppRefreshControl(props: AppRefreshControlProps) {
  const { colors } = useTheme();
  return (
    <RefreshControl
      {...props}
      tintColor={colors.primary}
      colors={[colors.primary]}
      progressBackgroundColor={colors.surface}
    />
  );
}
