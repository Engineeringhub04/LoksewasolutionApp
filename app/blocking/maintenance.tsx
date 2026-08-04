// §45.3 Maintenance Mode — non-bypassable, periodic background re-check to auto-exit.
import React, { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from '@/src/core/i18n';
import { fetchRemoteConfig } from '@/src/core/config/remoteConfig';
import { AppConfig } from '@/src/core/config/appConfig';
import { BlockingScreen } from '@/src/components/feedback/BlockingScreen';

const RECHECK_INTERVAL_MS = 30000;

export default function MaintenanceScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [message, setMessage] = useState(AppConfig.behavior.maintenanceMessage);

  useEffect(() => {
    const check = async () => {
      const config = await fetchRemoteConfig();
      setMessage(config.maintenanceMessage);
      if (!config.maintenanceMode) router.replace('/');
    };

    const interval = setInterval(check, RECHECK_INTERVAL_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [router]);

  return (
    <BlockingScreen
      icon="construct-outline"
      title={t('blocking.maintenanceTitle')}
      description={message}
    />
  );
}
