// Saves a hosted image (the subscription QR code) to the device's own
// storage. Same Android SAF / iOS share-sheet pattern as pdfDownload.ts —
// see that file's header comment for why each platform is handled the way
// it is; this is the image-flavoured twin of it.
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

export interface ImageDownloadResult {
  /** False when the user cancelled the Android folder picker or the iOS share sheet. */
  saved: boolean;
}

function sanitizeFileName(name: string): string {
  const trimmed = name.trim().replace(/[\\/:*?"<>|]/g, '-');
  return /\.(png|jpg|jpeg)$/i.test(trimmed) ? trimmed : `${trimmed}.png`;
}

async function downloadToCache(url: string, fileName: string): Promise<string> {
  const dest = `${FileSystem.cacheDirectory}${fileName}`;
  const download = FileSystem.createDownloadResumable(url, dest, {});
  const result = await download.downloadAsync();
  if (!result?.uri) throw new Error('IMAGE_DOWNLOAD_FAILED');
  return result.uri;
}

/**
 * Downloads `url` and lets the user save it to their own storage as
 * `suggestedName` (defaults to Ls-qr.png for the subscription QR code).
 *
 * `saved: false` means the user backed out of the picker/share sheet — that
 * is NOT an error, so callers should show a neutral state rather than an
 * error toast for it.
 */
export async function downloadImageToDevice(url: string, suggestedName = 'Ls-qr.png'): Promise<ImageDownloadResult> {
  const fileName = sanitizeFileName(suggestedName);
  const mimeType = fileName.toLowerCase().endsWith('.jpg') || fileName.toLowerCase().endsWith('.jpeg') ? 'image/jpeg' : 'image/png';
  const cacheUri = await downloadToCache(url, fileName);

  if (Platform.OS === 'android') {
    const SAF = FileSystem.StorageAccessFramework;
    const permission = await SAF.requestDirectoryPermissionsAsync();
    if (!permission.granted) return { saved: false };

    const base64 = await FileSystem.readAsStringAsync(cacheUri, { encoding: FileSystem.EncodingType.Base64 });
    const destUri = await SAF.createFileAsync(permission.directoryUri, fileName, mimeType);
    await FileSystem.writeAsStringAsync(destUri, base64, { encoding: FileSystem.EncodingType.Base64 });
    return { saved: true };
  }

  const Sharing = await import('expo-sharing');
  const available = await Sharing.isAvailableAsync();
  if (!available) throw new Error('SHARING_UNAVAILABLE');
  await Sharing.shareAsync(cacheUri, { mimeType, UTI: mimeType === 'image/png' ? 'public.png' : 'public.jpeg' });
  return { saved: true };
}
