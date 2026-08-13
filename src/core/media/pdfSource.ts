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
  /** Local file this came from (freshly downloaded or read from cache) — exposed so callers needing a real file:// URI (e.g. sharing) don't have to write the bytes out again. */
  cachedPath?: string;
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

/** Stable filename for a URL so re-opening the same paper hits the on-disk cache instead of re-downloading it every time. expo-crypto's digest is used since a plain JS hash isn't available without another dependency and this one is already in the project. */
async function cacheKeyFor(url: string): Promise<string> {
  const Crypto = await import('expo-crypto');
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, url);
  return `pdf-cache-${hash}.pdf`;
}

/** Single attempt against one concrete URL. Uses expo-file-system's native
 * downloader rather than XHR+FileReader — the blob/FileReader path is
 * unreliable on Android (silently truncates or fails on many device/OS
 * combinations for larger binary files), while FileSystem's downloader is
 * the same native code path used everywhere else PDFs are fetched in the app.
 *
 * Checks the on-disk cache first (keyed by a hash of the URL) so opening the
 * same paper twice — the very common "back out and reopen a question" case —
 * reads local bytes instead of re-downloading every time.
 *
 * Falls back to a plain fetch()+base64 conversion if the resumable download
 * comes back empty — some Android/Expo SDK 54 combinations silently write a
 * 0-byte file when the server's response has no Content-Length (chunked
 * transfer-encoding), which Cloudinary's `raw/upload` delivery can do. fetch()
 * doesn't depend on a declared length, so it's a more reliable second attempt.
 */
async function download(directUrl: string, onProgress?: (fraction: number) => void): Promise<PdfFetchResult> {
  const FileSystem = await import('expo-file-system/legacy');
  const dest = `${FileSystem.cacheDirectory}${await cacheKeyFor(directUrl)}`;

  const cached = await FileSystem.getInfoAsync(dest);
  if (cached.exists && (cached.size ?? 0) > 0) {
    const cachedBase64 = await FileSystem.readAsStringAsync(dest, { encoding: FileSystem.EncodingType.Base64 });
    if (cachedBase64 && looksLikePdf(cachedBase64)) {
      onProgress?.(1);
      return { base64: cachedBase64, byteLength: cached.size ?? 0, cachedPath: dest };
    }
    // Stale/corrupt cache entry (e.g. an old run cached an error page) — clear
    // it so this attempt re-downloads instead of permanently failing on it.
    await FileSystem.deleteAsync(dest, { idempotent: true });
  }

  const downloadable = FileSystem.createDownloadResumable(directUrl, dest, {}, (p) => {
    if (p.totalBytesExpectedToWrite > 0) {
      onProgress?.(Math.min(1, p.totalBytesWritten / p.totalBytesExpectedToWrite));
    } else {
      onProgress?.(-1);
    }
  });

  let base64 = '';
  let byteLength = 0;

  try {
    const result = await downloadable.downloadAsync();
    if (result?.uri && (!result.status || (result.status >= 200 && result.status < 300))) {
      const info = await FileSystem.getInfoAsync(result.uri);
      if (info.exists && (info.size ?? 0) > 0) {
        base64 = await FileSystem.readAsStringAsync(result.uri, { encoding: FileSystem.EncodingType.Base64 });
        byteLength = info.size ?? 0;
      }
    } else {
    }
  } catch (err) {
  }

  if (!base64) {
    const response = await fetch(directUrl);
    if (!response.ok) throw new Error(`PDF_HTTP_${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0) throw new Error('PDF_EMPTY_RESPONSE');
    base64 = arrayBufferToBase64(arrayBuffer);
    byteLength = arrayBuffer.byteLength;
    await FileSystem.writeAsStringAsync(dest, base64, { encoding: FileSystem.EncodingType.Base64 });
    onProgress?.(1);
  }

  if (!base64) throw new Error('PDF_EMPTY_RESPONSE');
  return { base64, byteLength, cachedPath: dest };
}

/** Chunked to avoid call-stack limits on large files (base64-encoding a big Uint8Array in one String.fromCharCode(...spread) call can blow the stack). */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  // eslint-disable-next-line no-undef
  return typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
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
