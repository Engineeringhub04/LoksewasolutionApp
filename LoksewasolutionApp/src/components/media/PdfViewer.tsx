// In-app PDF viewer.
//
// Renders the document ourselves with pdf.js inside a WebView, the same approach
// PDF reader apps use. It replaces the previous implementation, which embedded
// Google's `docs.google.com/gview` viewer — that meant the file was rendered by a
// third-party service, showed Google's own chrome, and needed the file to be
// publicly reachable by Google.
//
// The bytes are downloaded natively (see core/media/pdfSource.ts) and injected as
// base64, which sidesteps CORS entirely and gives a real progress bar.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { fetchPdfAsBase64 } from '@/src/core/media/pdfSource';

// Pinned pdf.js build. Only the renderer is fetched from the CDN — the document
// itself never leaves the device.
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174';

export interface PdfViewerProps {
  uri: string;
  /** Reports page changes so the screen can show "3 / 12" in its header. */
  onPageChange?: (page: number, totalPages: number) => void;
}

/** Page tracking and rendering live in the WebView; RN only draws the chrome. */
function buildHtml(base64: string, backgroundColor: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=4.0, user-scalable=yes" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    body { background: ${backgroundColor}; }
    #pages { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 10px 0 24px; }
    canvas { max-width: 100%; height: auto; display: block; box-shadow: 0 2px 10px rgba(0,0,0,0.25); background: #fff; }
  </style>
</head>
<body>
  <div id="pages"></div>
  <script src="${PDFJS}/pdf.min.js"></script>
  <script>
    var RN = window.ReactNativeWebView;
    function post(msg) { try { RN.postMessage(JSON.stringify(msg)); } catch (e) {} }

    function bytesFromBase64(b64) {
      var raw = atob(b64);
      var out = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
      return out;
    }

    (function () {
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '${PDFJS}/pdf.worker.min.js';
        var container = document.getElementById('pages');
        // Cap the backing resolution: full devicePixelRatio on a long document
        // exhausts WebView memory and the render dies silently.
        var scale = Math.min(window.devicePixelRatio || 1, 2);

        pdfjsLib.getDocument({ data: bytesFromBase64(BASE64_DATA) }).promise.then(function (pdf) {
          post({ type: 'loaded', totalPages: pdf.numPages });

          var rendered = 0;
          function renderPage(pageNumber) {
            return pdf.getPage(pageNumber).then(function (page) {
              var viewport = page.getViewport({ scale: scale });
              var canvas = document.createElement('canvas');
              canvas.width = viewport.width;
              canvas.height = viewport.height;
              canvas.style.width = '100%';
              canvas.setAttribute('data-page', String(pageNumber));
              container.appendChild(canvas);
              return page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise.then(function () {
                rendered += 1;
                post({ type: 'renderProgress', rendered: rendered, totalPages: pdf.numPages });
              });
            });
          }

          // Sequential rather than parallel, for the same memory reason.
          var chain = Promise.resolve();
          for (var p = 1; p <= pdf.numPages; p++) {
            (function (n) { chain = chain.then(function () { return renderPage(n); }); })(p);
          }
          return chain.then(function () { post({ type: 'done', totalPages: pdf.numPages }); });
        }).catch(function (err) {
          post({ type: 'error', message: String(err && err.message ? err.message : err) });
        });

        // Whichever canvas covers the middle of the screen is the current page.
        var lastReported = 0;
        function reportVisiblePage() {
          var canvases = container.getElementsByTagName('canvas');
          var middle = window.innerHeight / 2;
          for (var i = 0; i < canvases.length; i++) {
            var rect = canvases[i].getBoundingClientRect();
            if (rect.top <= middle && rect.bottom >= middle) {
              var page = parseInt(canvases[i].getAttribute('data-page'), 10);
              if (page && page !== lastReported) {
                lastReported = page;
                post({ type: 'page', page: page });
              }
              return;
            }
          }
        }
        var ticking = false;
        window.addEventListener('scroll', function () {
          if (ticking) return;
          ticking = true;
          requestAnimationFrame(function () { reportVisiblePage(); ticking = false; });
        });
      } catch (e) {
        post({ type: 'error', message: String(e) });
      }
    })();
  </script>
</body>
</html>`;
}

export function PdfViewer({ uri, onPageChange }: PdfViewerProps) {
  const { colors } = useTheme();

  const [base64, setBase64] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [renderProgress, setRenderProgress] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [phase, setPhase] = useState<'downloading' | 'rendering' | 'ready' | 'error'>('downloading');
  const [attempt, setAttempt] = useState(0);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    setPhase('downloading');
    setBase64(null);
    setDownloadProgress(0);
    setRenderProgress(0);
    setTotalPages(0);

    fetchPdfAsBase64(uri, (fraction) => {
      if (!cancelledRef.current) setDownloadProgress(fraction < 0 ? 0.15 : fraction);
    })
      .then((result) => {
        if (cancelledRef.current) return;
        setBase64(result.base64);
        setPhase('rendering');
      })
      .catch(() => {
        if (!cancelledRef.current) setPhase('error');
      });

    return () => {
      cancelledRef.current = true;
    };
  }, [uri, attempt]);

  const html = useMemo(
    () => (base64 ? buildHtml(base64, colors.background) : null),
    [base64, colors.background]
  );

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data) as Record<string, unknown>;
        switch (msg.type) {
          case 'loaded': {
            const total = Number(msg.totalPages) || 0;
            setTotalPages(total);
            onPageChange?.(1, total);
            break;
          }
          case 'renderProgress': {
            const total = Number(msg.totalPages) || 1;
            setRenderProgress(Number(msg.rendered) / total);
            break;
          }
          case 'done':
            setRenderProgress(1);
            setPhase('ready');
            break;
          case 'page':
            onPageChange?.(Number(msg.page) || 1, totalPages);
            break;
          case 'error':
            setPhase('error');
            break;
          default:
            break;
        }
      } catch {
        // Ignore anything that isn't our JSON protocol.
      }
    },
    [onPageChange, totalPages]
  );

  if (phase === 'error') {
    return (
      <DataNotFound
        title="Could not open this paper"
        description="The file could not be downloaded or is not a valid PDF. Check your connection and try again."
        onRetry={() => setAttempt((a) => a + 1)}
      />
    );
  }

  const busy = phase !== 'ready';
  const progress = phase === 'downloading' ? downloadProgress * 0.5 : 0.5 + renderProgress * 0.5;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {html ? (
        <WebView
          originWhitelist={['*']}
          source={{ html }}
          onMessage={handleMessage}
          // Injecting via a placeholder keeps the (potentially large) base64 out
          // of the HTML string that gets parsed as markup.
          injectedJavaScriptBeforeContentLoaded={`var BASE64_DATA = "${base64}"; true;`}
          style={{ flex: 1, backgroundColor: colors.background }}
          showsVerticalScrollIndicator
          scalesPageToFit={false}
          javaScriptEnabled
          domStorageEnabled
          onError={() => setPhase('error')}
        />
      ) : null}

      {/* Determinate progress across both phases: download then render. */}
      {busy ? (
        <View style={[styles.progressOverlay, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text variant="bodySmall" weight="semiBold" style={{ marginTop: 12 }}>
            {phase === 'downloading' ? 'Downloading paper…' : 'Preparing pages…'}
          </Text>
          <View style={[styles.progressTrack, { backgroundColor: colors.surfaceAlt }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: colors.primary, width: `${Math.round(Math.min(1, progress) * 100)}%` },
              ]}
            />
          </View>
          <Text variant="caption" secondary>{Math.round(Math.min(1, progress) * 100)}%</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  progressOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 40,
  },
  progressTrack: { width: '100%', height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 6 },
  progressFill: { height: '100%', borderRadius: 3 },
});
