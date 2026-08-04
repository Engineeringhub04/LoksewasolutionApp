// §45.1 Update Required — non-dismissable, re-checks version on return.
import React from 'react';
import { Linking } from 'react-native';
import { useTranslation } from '@/src/core/i18n';
import { BlockingScreen } from '@/src/components/feedback/BlockingScreen';

const STORE_URL = 'https://play.google.com/store/apps/details?id=com.loksewasolutionnp.hub';

export default function UpdateRequiredScreen() {
  const { t } = useTranslation();
  return (
    <BlockingScreen
      icon="cloud-download-outline"
      title={t('blocking.updateRequiredTitle')}
      description={t('blocking.updateRequiredDesc')}
      actionLabel={t('blocking.updateNow')}
      onAction={() => Linking.openURL(STORE_URL)}
    />
  );
}
