// §45.2 No Internet — auto-transitions away the moment connection is restored.
import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from '@/src/core/i18n';
import { useNetworkStatus } from '@/src/core/hooks/useNetworkStatus';
import { BlockingScreen } from '@/src/components/feedback/BlockingScreen';

export default function NoInternetScreen() {
  const { t } = useTranslation();
  const { isOnline } = useNetworkStatus();
  const router = useRouter();

  useEffect(() => {
    if (isOnline && router.canDismiss?.()) {
      router.back();
    } else if (isOnline) {
      router.replace('/');
    }
  }, [isOnline, router]);

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
