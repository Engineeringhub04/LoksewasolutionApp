// §45.3 Maintenance Mode — non-bypassable, periodic background re-check to auto-exit.
import React, { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { useTranslation } from '@/src/core/i18n';
import { fetchRemoteConfig } from '@/src/core/config/remoteConfig';
import { AppConfig } from '@/src/core/config/appConfig';
import { BlockingScreen } from '@/src/components/feedback/BlockingScreen';

const RECHECK_INTERVAL_MS = 30000;

export default function MaintenanceScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [message, setMessage] = useState(AppConfig.behavior.maintenanceMessage);
  // Same guard as no-internet.tsx — avoids "Attempted to navigate before mounting the
  // Root Layout component" if this screen's re-check ever resolves before the root
  // Stack/Slot has finished mounting.
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    const check = async () => {
      const config = await fetchRemoteConfig();
      setMessage(config.maintenanceMessage);
      if (!config.maintenanceMode && rootNavigationState?.key) router.replace('/');
    };

    const interval = setInterval(check, RECHECK_INTERVAL_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [router, rootNavigationState]);

  return (
    <BlockingScreen
      icon="construct-outline"
      title={t('blocking.maintenanceTitle')}
      description={message}
    />
  );
}
