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
 * Every PDF begins with the bytes "%PDF", which base64-encode to "JVBER".
 *
 * This is how we detect Google Drive's virus-scan interstitial: for larger files
 * Drive answers `uc?export=download` with an HTML confirmation page instead of
 * the file, and an HTML body would otherwise be handed to pdf.js and fail with an
 * opaque parse error.
 */
function looksLikePdf(base64: string): boolean {
  return base64.startsWith('JVBER');
}

/**
 * Download URLs to try in order for a Drive file.
 *
 * `drive.usercontent.google.com/download?...&confirm=t` is the endpoint that
 * serves the bytes directly and skips the interstitial; the older `uc?export`
 * form is kept as a fallback for files where it still works.
 */
function driveCandidates(id: string): string[] {
  return [
    `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`,
    `https://drive.google.com/uc?export=download&id=${id}&confirm=t`,
    `https://drive.google.com/uc?export=download&id=${id}`,
  ];
}

/** All URLs worth attempting for a given share link, best first. */
function candidateUrls(url: string): string[] {
  const trimmed = url.trim();
  if (/drive\.google\.com|drive\.usercontent\.google\.com/i.test(trimmed)) {
    const id = driveFileId(trimmed);
    if (id) return driveCandidates(id);
  }
  return [toDirectPdfUrl(trimmed)];
}

/** Single attempt against one concrete URL. */
function download(directUrl: string, onProgress?: (fraction: number) => void): Promise<PdfFetchResult> {
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

/**
 * Downloads a PDF and returns it as base64.
 *
 * Tries each candidate URL until one returns something that actually starts with
 * the PDF magic bytes, which is what transparently gets past Google Drive's
 * virus-scan interstitial.
 *
 * `onProgress` receives 0..1, or -1 when the server doesn't report a content
 * length (so the UI can show movement instead of a stuck 0%).
 */
export async function fetchPdfAsBase64(
  url: string,
  onProgress?: (fraction: number) => void
): Promise<PdfFetchResult> {
  const candidates = candidateUrls(url);
  let lastError: Error | null = null;

  for (const candidate of candidates) {
    try {
      const result = await download(candidate, onProgress);
      if (looksLikePdf(result.base64)) return result;
      // Reached Drive's HTML confirmation page rather than the file — reset the
      // bar and fall through to the next candidate.
      onProgress?.(0);
      lastError = new Error('PDF_NOT_A_PDF');
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('PDF_DOWNLOAD_FAILED');
    }
  }

  throw lastError ?? new Error('PDF_DOWNLOAD_FAILED');
}
