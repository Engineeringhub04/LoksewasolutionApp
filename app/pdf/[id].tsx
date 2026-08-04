// §20 PDF Viewer
import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { IconButton } from '@/src/components/buttons/IconButton';
import { PdfViewer } from '@/src/components/media/PdfViewer';

export default function PdfViewerScreen() {
  const { id, uri, title } = useLocalSearchParams<{ id: string; uri: string; title?: string }>();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  void router;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TopAppBar
        title={title ?? id}
        actions={
          <>
            <IconButton name="download-outline" accessibilityLabel={t('common.download')} onPress={() => {}} />
            <IconButton name="share-outline" accessibilityLabel={t('common.share')} onPress={() => {}} />
          </>
        }
      />
      <PdfViewer uri={uri} />
    </View>
  );
}
