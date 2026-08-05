// Cloudinary unsigned image upload.
//
// Firebase Storage requires a paid (Blaze) plan, so profile photos are uploaded
// to Cloudinary's free tier instead and only the resulting HTTPS URL is stored
// in Firestore (users/{uid}.photoURL). That keeps the whole stack on free
// services while still giving every device a real, shareable image URL —
// previously a picked photo stayed a local `file://` URI and therefore only
// rendered on the device that picked it.
//
// This uses an UNSIGNED upload preset, which is why no API secret is needed
// (and why none must ever be shipped in the app bundle).
import { AppConfig } from '@/src/core/config/appConfig';

interface CloudinaryUploadResponse {
  secure_url?: string;
  error?: { message?: string };
}

/**
 * Uploads a local image URI (from expo-image-picker) to Cloudinary.
 * Returns the hosted HTTPS URL. Throws on failure so callers can surface a toast.
 *
 * `onProgress` receives 0..1. XMLHttpRequest is used instead of fetch() purely
 * because fetch() exposes no upload-progress events, and the profile screen
 * shows a real determinate progress ring while the photo uploads.
 */
export async function uploadImageToCloudinary(
  localUri: string,
  onProgress?: (fraction: number) => void
): Promise<string> {
  const { cloudName, uploadPreset, folder } = AppConfig.media.cloudinary;

  // Derive a filename/mime from the URI extension. Cloudinary is tolerant here,
  // but React Native's FormData requires all three fields to be present.
  const extensionMatch = /\.(\w+)(?:\?.*)?$/.exec(localUri);
  const extension = (extensionMatch?.[1] ?? 'jpg').toLowerCase();
  const mimeType = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';

  const form = new FormData();
  // RN's FormData accepts this {uri,name,type} shape; TS's DOM lib does not model it.
  form.append('file', { uri: localUri, name: `upload.${extension}`, type: mimeType } as unknown as Blob);
  form.append('upload_preset', uploadPreset);
  if (folder) form.append('folder', folder);

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress?.(Math.min(1, event.loaded / event.total));
      }
    };

    xhr.onload = () => {
      let data: CloudinaryUploadResponse = {};
      try {
        data = JSON.parse(xhr.responseText) as CloudinaryUploadResponse;
      } catch {
        reject(new Error('CLOUDINARY_BAD_RESPONSE'));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300 && data.secure_url) {
        onProgress?.(1);
        resolve(data.secure_url);
      } else {
        reject(new Error(data.error?.message ?? `CLOUDINARY_UPLOAD_FAILED_${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('CLOUDINARY_NETWORK_ERROR'));
    xhr.onabort = () => reject(new Error('CLOUDINARY_ABORTED'));

    xhr.send(form);
  });
}
