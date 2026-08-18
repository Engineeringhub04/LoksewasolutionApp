import AsyncStorage from '@react-native-async-storage/async-storage';

export const CONSTITUTION_BASE_URL = 'https://nepal-constitution-json.pages.dev';
const CACHE_PREFIX = '@loksewa/constitution';
const MANIFEST_KEY = `${CACHE_PREFIX}/manifest`;
const INDEX_KEY = `${CACHE_PREFIX}/index`;
const CHECKED_AT_KEY = `${CACHE_PREFIX}/checked-at`;
const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export type ConstitutionLanguage = 'np' | 'en';

export interface ConstitutionManifest {
  documentId: string;
  version: number;
  updatedAt: string;
  indexFile: string;
  contentDirectory: string;
  totalContentFiles: number;
}

export interface ConstitutionFileEntry {
  order: number;
  file: string;
  sectionType: 'preamble' | 'part' | 'schedule' | string;
  partNo: number | null;
  scheduleNo: number | null;
  titleNp: string;
  titleEn: string;
}

export interface ConstitutionIndex {
  documentId: string;
  titleNp: string;
  titleEn: string;
  version: number;
  updatedAt: string;
  totalContentFiles: number;
  directory: string;
  assets: unknown[];
  files: ConstitutionFileEntry[];
}

export interface ConstitutionContentNode {
  tag?: string;
  level?: number;
  headingType?: string;
  number?: string | number;
  articleNo?: string | number;
  title?: string;
  text?: string;
  children?: ConstitutionContentNode[];
  items?: ConstitutionContentNode[];
  rows?: ConstitutionContentNode[];
  cells?: ConstitutionContentNode[];
  content?: ConstitutionContentNode[];
  [key: string]: unknown;
}

export interface ConstitutionPart {
  id: string;
  order: number;
  sectionType: string;
  partNo: number | null;
  scheduleNo: number | null;
  fileName: string;
  titleNp: string;
  titleEn: string;
  legalReferenceNp: string | null;
  legalReferenceEn: string | null;
  source?: Record<string, unknown>;
  containnp: ConstitutionContentNode[];
  containen: ConstitutionContentNode[];
}

async function readCache<T>(key: string): Promise<T | null> {
  try {
    const value = await AsyncStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

async function writeCache(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Cache failure must never prevent Constitution content from opening.
  }
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${CONSTITUTION_BASE_URL}/${path.replace(/^\//, '')}`);
  if (!response.ok) throw new Error(`Constitution request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

function partCacheKey(file: string, version: number): string {
  const filename = decodeURIComponent(file).split('/').pop() ?? file;
  return `${CACHE_PREFIX}/part/v${version}/${filename}`;
}

function normalizePartPath(file: string): string {
  const filename = decodeURIComponent(file).split('/').pop() ?? file;
  return `parts/${filename}`;
}

async function getRemoteManifest(): Promise<ConstitutionManifest> {
  return fetchJson<ConstitutionManifest>('manifest.json');
}

async function refreshIndexIfNeeded(cachedIndex: ConstitutionIndex | null): Promise<ConstitutionIndex> {
  const cachedManifest = await readCache<ConstitutionManifest>(MANIFEST_KEY);
  const checkedAt = Number(await AsyncStorage.getItem(CHECKED_AT_KEY) ?? 0);
  const shouldCheckRemote = !cachedIndex || Date.now() - checkedAt >= UPDATE_CHECK_INTERVAL_MS;

  if (!shouldCheckRemote && cachedIndex) return cachedIndex;

  try {
    const remoteManifest = await getRemoteManifest();

    if (cachedIndex && cachedManifest?.version === remoteManifest.version) {
      await writeCache(MANIFEST_KEY, remoteManifest);
      await AsyncStorage.setItem(CHECKED_AT_KEY, String(Date.now()));
      return cachedIndex;
    }

    const remoteIndex = await fetchJson<ConstitutionIndex>(remoteManifest.indexFile || 'index.json');
    await writeCache(INDEX_KEY, remoteIndex);
    await writeCache(MANIFEST_KEY, remoteManifest);
    await AsyncStorage.setItem(CHECKED_AT_KEY, String(Date.now()));
    return remoteIndex;
  } catch (error) {
    if (cachedIndex) {
      await AsyncStorage.setItem(CHECKED_AT_KEY, String(Date.now()));
      return cachedIndex;
    }
    throw error;
  }
}

export async function fetchConstitutionIndex(): Promise<ConstitutionIndex> {
  const cachedIndex = await readCache<ConstitutionIndex>(INDEX_KEY);
  return refreshIndexIfNeeded(cachedIndex);
}

export async function fetchConstitutionPart(file: string): Promise<ConstitutionPart> {
  const index = await fetchConstitutionIndex();
  const version = Number(index.version || 1);
  const key = partCacheKey(file, version);
  const cachedPart = await readCache<ConstitutionPart>(key);
  if (cachedPart) return cachedPart;

  const part = await fetchJson<ConstitutionPart>(normalizePartPath(file));
  await writeCache(key, part);
  return part;
}

export async function clearConstitutionCache(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const constitutionKeys = keys.filter((key) => key.startsWith(CACHE_PREFIX));
  if (constitutionKeys.length) await AsyncStorage.multiRemove(constitutionKeys);
}
