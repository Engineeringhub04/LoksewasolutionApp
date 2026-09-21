// Single source of truth for pull-to-refresh across every screen.
//
// `tintColor` controls the native iOS indicator and `colors` controls the
// native Android indicator. The native RefreshControl itself owns the pull
// progress, threshold, release gesture, and refresh lifecycle.
//
// It also carries one piece of behaviour that has nothing to do with looks: a
// pull re-checks whether this device still holds the account. See below.
import { useCallback } from 'react';
import { RefreshControl, type RefreshControlProps } from 'react-native';
import { useTheme } from '@/src/core/theme';
import { requestDeviceSessionRecheck } from '@/src/core/firebase/services/deviceSession';

export type AppRefreshControlProps = Omit<
  RefreshControlProps,
  'tintColor' | 'colors' | 'progressBackgroundColor'
>;

/**
 * Home and Profile pass `progressViewOffset` because their existing headers
 * are fixed overlays. This keeps the platform-default indicator below those
 * headers without replacing the native pull-progress behavior.
 */
export function AppRefreshControl({ onRefresh, ...props }: AppRefreshControlProps) {
  const { colors } = useTheme();

  /**
   * Why a session check lives inside the refresh control.
   *
   * When another phone takes this account over, the displaced phone is told by
   * push — and that covers almost everything. Almost: notifications may be
   * switched off for the app, the token may have gone stale, or Expo may simply
   * be unreachable. In that case an open app would sit there believing it is
   * still signed in until the next time it is backgrounded.
   *
   * A pull-to-refresh is the user saying "show me the truth", and this is the
   * one component every pull in the app goes through — so it is the only place
   * the fix can be written once instead of on forty screens. The check is
   * fire-and-forget and adds nothing to the refresh the user is waiting on: with
   * no guard mounted (the auth screens) it does literally nothing, and a signed-in
   * app pays at most one document read for a gesture the user made deliberately.
   */
  const handleRefresh = useCallback(() => {
    requestDeviceSessionRecheck();
    onRefresh?.();
  }, [onRefresh]);

  // Colors come straight from the live theme. NOTE: deliberately NO `key` here —
  // remounting the platform control (tried earlier to fix a stale-colour report)
  // makes Android drop the `colors` palette on the new instance, leaving the
  // spinner its default WHITE on every screen. Android applies `colors` updates
  // on the mounted control just fine, so plain props are the correct fix.
  return (
    <RefreshControl
      {...props}
      onRefresh={handleRefresh}
      tintColor={colors.primary}
      colors={[colors.primary]}
      progressBackgroundColor={colors.surface}
    />
  );
}
