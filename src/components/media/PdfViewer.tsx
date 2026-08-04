// Global PDF Viewer (PRD §8.6, screen §20): page nav, zoom, download.
// Uses Google Docs viewer via WebView for remote PDFs (no native PDF renderer dependency).
import React, { useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { Spinner } from '@/src/components/feedback/Spinner';
import { ErrorState } from '@/src/components/feedback/ErrorState';

export interface PdfViewerProps {
  uri: string;
}

export function PdfViewer({ uri }: PdfViewerProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [key, setKey] = useState(0);

  if (error) {
    return <ErrorState message={t('pdf.corrupted')} onRetry={() => { setError(false); setLoading(true); setKey((k) => k + 1); }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <WebView
        key={key}
        source={{ uri: `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(uri)}` }}
        onLoadEnd={() => setLoading(false)}
        onError={() => setError(true)}
        startInLoadingState={false}
      />
      {loading ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <Spinner fullScreen />
        </View>
      ) : null}
    </View>
  );
}
