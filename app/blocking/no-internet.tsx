// §45.2 No Internet — auto-transitions away the moment connection is restored.
import React, { useEffect } from 'react';
import { useRouter, useRootNavigationState } from 'expo-router';
import { useTranslation } from '@/src/core/i18n';
import { useNetworkStatus } from '@/src/core/hooks/useNetworkStatus';
import { BlockingScreen } from '@/src/components/feedback/BlockingScreen';

export default function NoInternetScreen() {
  const { t } = useTranslation();
  const { isOnline } = useNetworkStatus();
  const router = useRouter();
  // Guards against "Attempted to navigate before mounting the Root Layout component" —
  // this screen can be the one Expo Router lands on immediately after a stale/resumed
  // navigation state (e.g. dev Fast Refresh, or the same kind of stale-session behavior
  // investigated in PRs #17-#19), so its effect can fire before the root Stack/Slot has
  // actually finished mounting. Waiting for a navigation state key means the navigator
  // is ready before we ever call replace()/back().
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    if (!rootNavigationState?.key) return;
    if (isOnline && router.canDismiss?.()) {
      router.back();
    } else if (isOnline) {
      router.replace('/');
    }
  }, [isOnline, router, rootNavigationState]);

  return (
    <BlockingScreen
      icon="wifi-outline"
      title={t('blocking.noInternetTitle')}
      description={t('blocking.noInternetDesc')}
      actionLabel={t('common.retry')}
      onAction={() => router.replace('/')}
    />
  );
}
