// Turns a shared PDF link into raw bytes the in-app viewer can render.
//
// Why fetch the bytes in React Native instead of pointing a WebView at the URL:
// a WebView page is subject to CORS, and neither Google Drive nor most file hosts
// send permissive CORS headers — so an in-WebView fetch fails. The NATIVE
// networking layer has no CORS restriction, so the app downloads the file and
// hands the bytes to the renderer. That's also what lets us show a real
// download progress bar.
//
// XMLHttpRequest is used rather than fetch() because fetch() exposes no
// download-progress events.

/** Extracts a Google Drive file id from any of its common link shapes. */
function driveFileId(url: string): string | null {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/, // /file/d/<id>/view
    /[?&]id=([a-zA-Z0-9_-]+)/, // ?id=<id>
    /\/d\/([a-zA-Z0-9_-]+)/, // /d/<id>
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(url);
    if (match?.[1]) return match[1];
  }
  return null;
}

/**
 * Rewrites share links into direct-file links.
 *
 * A Drive "/view" link returns an HTML page, not a PDF, so it must be converted
 * to the `uc?export=download` form before the bytes can be read. Dropbox needs
 * the same treatment via `?dl=1`.
 */
export function toDirectPdfUrl(url: string): string {
  const trimmed = url.trim();

  if (/drive\.google\.com/i.test(trimmed)) {
    const id = driveFileId(trimmed);
    if (id) return `https://drive.google.com/uc?export=download&id=${id}`;
  }

  if (/dropbox\.com/i.test(trimmed)) {
    return trimmed.replace(/[?&]dl=0/, '').concat(trimmed.includes('?') ? '&dl=1' : '?dl=1');
  }

  return trimmed;
}

export interface PdfFetchResult {
  /** Raw base64 (no data: prefix) — what pdf.js is handed. */
  base64: string;
  byteLength: number;
}

/**
 * Downloads a PDF and returns it as base64.
 *
 * `onProgress` receives 0..1, or -1 when the server doesn't report a content
 * length (so the UI can show an indeterminate bar instead of a stuck 0%).
 */
export function fetchPdfAsBase64(url: string, onProgress?: (fraction: number) => void): Promise<PdfFetchResult> {
  const directUrl = toDirectPdfUrl(url);

  return new Promise<PdfFetchResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', directUrl);
    xhr.responseType = 'blob';

    xhr.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress?.(Math.min(1, event.loaded / event.total));
      } else {
        onProgress?.(-1);
      }
    };

    xhr.onerror = () => reject(new Error('PDF_NETWORK_ERROR'));
    xhr.onabort = () => reject(new Error('PDF_ABORTED'));

    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`PDF_HTTP_${xhr.status}`));
        return;
      }

      const blob = xhr.response as Blob;
      if (!blob) {
        reject(new Error('PDF_EMPTY_RESPONSE'));
        return;
      }

      // FileReader gives a data: URL; pdf.js wants the payload only.
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('PDF_READ_ERROR'));
      reader.onload = () => {
        const dataUrl = String(reader.result ?? '');
        const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
        if (!base64) {
          reject(new Error('PDF_DECODE_ERROR'));
          return;
        }
        onProgress?.(1);
        resolve({ base64, byteLength: blob.size ?? 0 });
      };
      reader.readAsDataURL(blob);
    };

    xhr.send();
  });
}
