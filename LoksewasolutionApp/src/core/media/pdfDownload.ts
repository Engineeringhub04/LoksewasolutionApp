// Saves a hosted PDF (an uploaded exam answer, or a paper the admin wants to
// keep) to the device's own storage — separate from PdfViewer/pdfSource.ts,
// which downloads bytes only to render them in-app and never touches disk.
//
// Android: uses the Storage Access Framework so the user picks WHERE to save
// (Downloads, a course folder, etc.) via the system folder picker, matching how
// every other Android file-manager/download flow behaves. This needs no extra
// permission and works the same on every Android version, unlike writing
// straight into `FileSystem.documentDirectory`, which is sandboxed and
// invisible outside the app.
//
// iOS has no folder-picker equivalent; the standard pattern there is the native
// Share sheet ("Save to Files", AirDrop, etc.), which expo-sharing provides.
//
// Both platforms currently ship expo-file-system ~19 — this deliberately
// imports the `/legacy` entry point because StorageAccessFramework and the
// simple string-based readAsStringAsync/writeAsStringAsync API used here were
// moved there in v19; the new default export uses a different File/Directory
// class API.
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

export interface DownloadResult {
  /** False when the user cancelled the Android folder picker or the iOS share sheet. */
  saved: boolean;
}

function sanitizeFileName(name: string): string {
  const trimmed = name.trim().replace(/[\\/:*?"<>|]/g, '-');
  return trimmed.endsWith('.pdf') ? trimmed : `${trimmed}.pdf`;
}

async function downloadToCache(url: string, fileName: string, onProgress?: (fraction: number) => void): Promise<string> {
  const dest = `${FileSystem.cacheDirectory}${fileName}`;
  const download = FileSystem.createDownloadResumable(url, dest, {}, (p) => {
    if (p.totalBytesExpectedToWrite > 0) {
      onProgress?.(Math.min(1, p.totalBytesWritten / p.totalBytesExpectedToWrite));
    }
  });
  const result = await download.downloadAsync();
  if (!result?.uri) throw new Error('PDF_DOWNLOAD_FAILED');
  return result.uri;
}

/**
 * Downloads `url` and lets the user save it to their own storage.
 *
 * `saved: false` means the user backed out of the picker/share sheet — that is
 * NOT an error, so callers should show a neutral "download cancelled" state
 * rather than an error toast for it.
 */
export async function downloadPdfToDevice(
  url: string,
  suggestedName: string,
  onProgress?: (fraction: number) => void
): Promise<DownloadResult> {
  const fileName = sanitizeFileName(suggestedName);
  const cacheUri = await downloadToCache(url, fileName, onProgress);

  if (Platform.OS === 'android') {
    const SAF = FileSystem.StorageAccessFramework;
    const permission = await SAF.requestDirectoryPermissionsAsync();
    if (!permission.granted) return { saved: false };

    const base64 = await FileSystem.readAsStringAsync(cacheUri, { encoding: FileSystem.EncodingType.Base64 });
    const destUri = await SAF.createFileAsync(permission.directoryUri, fileName, 'application/pdf');
    await FileSystem.writeAsStringAsync(destUri, base64, { encoding: FileSystem.EncodingType.Base64 });
    return { saved: true };
  }

  // iOS (and any other platform without SAF): hand off to the native share sheet.
  const Sharing = await import('expo-sharing');
  const available = await Sharing.isAvailableAsync();
  if (!available) throw new Error('SHARING_UNAVAILABLE');
  await Sharing.shareAsync(cacheUri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
  return { saved: true };
}
