// Downloads (PRD §36) — tracks locally downloaded file metadata. Actual file
// bytes live under FileSystem.documentDirectory; this only tracks the index.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

export interface DownloadedItem {
  id: string;
  title: string;
  type: 'pdf' | 'note' | 'other';
  sizeBytes: number;
  localUri: string;
  downloadedAt: number;
}

const STORAGE_KEY = 'loksewa:downloads';

export async function loadDownloads(): Promise<DownloadedItem[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function persist(items: DownloadedItem[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export async function removeDownload(id: string): Promise<void> {
  const items = await loadDownloads();
  const target = items.find((i) => i.id === id);
  if (target) {
    await FileSystem.deleteAsync(target.localUri, { idempotent: true }).catch(() => {});
  }
  await persist(items.filter((i) => i.id !== id));
}

export async function clearAllDownloads(): Promise<void> {
  const items = await loadDownloads();
  await Promise.all(items.map((i) => FileSystem.deleteAsync(i.localUri, { idempotent: true }).catch(() => {})));
  await persist([]);
}

export function totalStorageUsed(items: DownloadedItem[]): number {
  return items.reduce((sum, i) => sum + i.sizeBytes, 0);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
