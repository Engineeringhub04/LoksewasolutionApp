// Picks a single PDF from the device for the Theory Answer Upload flow.
// Thin wrapper so screens depend on one function instead of the
// expo-document-picker result shape directly.
import * as DocumentPicker from 'expo-document-picker';

export interface PickedPdf {
  uri: string;
  name: string;
  /** Bytes, when the OS reports it — not always available for content:// URIs. */
  size: number | null;
}

/** Max upload size enforced by the Upload screen — keeps Cloudinary's free tier usable. */
export const MAX_ANSWER_PDF_BYTES = 8 * 1024 * 1024; // 8 MB

/** Returns null if the user cancelled the picker. */
export async function pickAnswerPdf(): Promise<PickedPdf | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || result.assets.length === 0) return null;

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    name: asset.name || 'answer.pdf',
    size: typeof asset.size === 'number' ? asset.size : null,
  };
}
