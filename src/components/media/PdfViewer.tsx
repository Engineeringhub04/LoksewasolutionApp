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
function buildHtml(base64: string): string {
  // The base64 payload is embedded directly in the HTML source (as a plain JS
  // string literal) rather than delivered via
  // injectedJavaScriptBeforeContentLoaded. That injection API races against
  // the page's own <script> tags on Android — some Android WebView builds run
  // the page's inline script (which reads the injected global) before the
  // injection has actually landed, throwing "BASE64_DATA is not defined"; the
  // same code was reliable on iOS purely because WKWebView doesn't have that
  // race. Baking the data into the document itself removes the race
  // entirely: there is no separate injection step to lose the ordering on.
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=4.0, user-scalable=yes" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    body { background: #ffffff; }
    #pages { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 0 0 24px; background: #ffffff; }
    canvas { max-width: 100%; height: auto; display: block; box-shadow: none; background: #ffffff; }
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
        var __PDF_B64__ = "${base64}";
        post({ type: 'debug', message: 'b64 length=' + __PDF_B64__.length + ' head=' + __PDF_B64__.slice(0, 12) });
        pdfjsLib.GlobalWorkerOptions.workerSrc = '${PDFJS}/pdf.worker.min.js';
        var container = document.getElementById('pages');
        // Cap the backing resolution: full devicePixelRatio on a long document
        // exhausts WebView memory and the render dies silently.
        var scale = Math.min(window.devicePixelRatio || 1, 2);

        pdfjsLib.getDocument({ data: bytesFromBase64(__PDF_B64__) }).promise.then(function (pdf) {
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
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    setPhase('downloading');
    setErrorDetail(null);
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
      .catch((err) => {
        // Logged (not swallowed) so `npx expo start`'s Metro log shows the
        // real failure reason, and also kept in state so the on-screen error
        // shows it directly — every failure used to look identical.
        console.error('[PdfViewer] fetchPdfAsBase64 failed for', uri, err);
        if (!cancelledRef.current) {
          setErrorDetail(err instanceof Error ? err.message : String(err));
          setPhase('error');
        }
      });

    return () => {
      cancelledRef.current = true;
    };
  }, [uri, attempt]);

  const html = useMemo(
    () => (base64 ? buildHtml(base64) : null),
    [base64]
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
            console.error('[PdfViewer] pdf.js render error:', msg.message);
            setErrorDetail(typeof msg.message === 'string' ? msg.message : 'PDF rendering failed');
            setPhase('error');
            break;
          case 'debug':
            console.log('[PdfViewer][webview]', msg.message);
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
        description={
          errorDetail
            ? `The file could not be downloaded or is not a valid PDF. (${errorDetail})`
            : 'The file could not be downloaded or is not a valid PDF. Check your connection and try again.'
        }
        onRetry={() => setAttempt((a) => a + 1)}
      />
    );
  }

  const busy = phase !== 'ready';
  const progress = phase === 'downloading' ? downloadProgress * 0.5 : 0.5 + renderProgress * 0.5;

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      {html ? (
        <WebView
          originWhitelist={['*']}
          source={{ html }}
          onMessage={handleMessage}
          style={{ flex: 1, backgroundColor: '#FFFFFF' }}
          showsVerticalScrollIndicator
          scalesPageToFit={false}
          javaScriptEnabled
          domStorageEnabled
          onError={() => setPhase('error')}
        />
      ) : null}

      {/* Determinate progress across both phases: download then render. */}
      {busy ? (
        <View style={[styles.progressOverlay, { backgroundColor: '#FFFFFF' }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text variant="bodySmall" weight="semiBold" style={{ marginTop: 12, color: '#0F172A' }}>
            {phase === 'downloading' ? 'Downloading paper…' : 'Preparing PDF…'}
          </Text>
          <View style={[styles.progressTrack, { backgroundColor: colors.surfaceAlt }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: colors.primary, width: `${Math.round(Math.min(1, progress) * 100)}%` },
              ]}
            />
          </View>
          <Text variant="caption" style={{ color: '#0F172A' }}>{Math.round(Math.min(1, progress) * 100)}%</Text>
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
