// Firestore REST API client. Replaces the firebase/firestore SDK with hand-rolled
// fetch() calls against Firestore's public REST endpoints (v1). Requests carry the
// current user's idToken (if signed in) as a Bearer token, so Security Rules are
// evaluated identically to the SDK; the API key is always attached so unauthenticated
// reads under permissive rules are still recognized as coming from this app.
import { firebaseEnv } from './env';
import { getValidIdToken } from './session';

const DOCUMENTS_URL = `https://firestore.googleapis.com/v1/projects/${firebaseEnv.projectId}/databases/(default)/documents`;

// Resource name path without the API base URL — Firestore commit API expects
// resource name format: projects/{project}/databases/(default)/documents/...
const RESOURCE_PATH = `projects/${firebaseEnv.projectId}/databases/(default)/documents`;

type FirestoreValue = Record<string, unknown>;

/** Replaces firebase/firestore's `Timestamp` for read values. */
export interface FirestoreTimestamp {
  toDate: () => Date;
  toMillis: () => number;
}

interface ServerTimestampSentinel {
  __firestoreSentinel: 'serverTimestamp';
}

interface IncrementSentinel {
  __firestoreSentinel: 'increment';
  by: number;
}

type Sentinel = ServerTimestampSentinel | IncrementSentinel;

/** Marks a field to be set to the server's commit time (replaces firebase/firestore's serverTimestamp()). */
export function serverTimestamp(): ServerTimestampSentinel {
  return { __firestoreSentinel: 'serverTimestamp' };
}

/** Marks a field to be atomically incremented (replaces firebase/firestore's increment()). */
export function increment(by: number): IncrementSentinel {
  return { __firestoreSentinel: 'increment', by };
}

function isSentinel(value: unknown): value is Sentinel {
  return typeof value === 'object' && value !== null && '__firestoreSentinel' in value;
}

// ---------- Serialization: plain JS -> Firestore REST Value ----------

function toFirestoreValue(value: unknown): FirestoreValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } };
  }
  if (typeof value === 'object') {
    return { mapValue: { fields: toFirestoreFields(value as Record<string, unknown>) } };
  }
  throw new Error(`Cannot serialize value of type ${typeof value} to Firestore`);
}

function toFirestoreFields(obj: Record<string, unknown>): Record<string, FirestoreValue> {
  const fields: Record<string, FirestoreValue> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || isSentinel(value)) continue;
    fields[key] = toFirestoreValue(value);
  }
  return fields;
}

// ---------- Deserialization: Firestore REST Value -> plain JS ----------

function fromFirestoreValue(value: FirestoreValue): unknown {
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('timestampValue' in value) {
    const iso = value.timestampValue as string;
    return { toDate: () => new Date(iso), toMillis: () => new Date(iso).getTime() } as FirestoreTimestamp;
  }
  if ('mapValue' in value) {
    const mapValue = value.mapValue as { fields?: Record<string, FirestoreValue> };
    return fromFirestoreFields(mapValue.fields ?? {});
  }
  if ('arrayValue' in value) {
    const arrayValue = value.arrayValue as { values?: FirestoreValue[] };
    return (arrayValue.values ?? []).map(fromFirestoreValue);
  }
  if ('referenceValue' in value) return value.referenceValue;
  if ('geoPointValue' in value) return value.geoPointValue;
  return null;
}

function fromFirestoreFields(fields: Record<string, FirestoreValue>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    result[key] = fromFirestoreValue(value);
  }
  return result;
}

function docIdFromName(name: string): string {
  return name.slice(name.lastIndexOf('/') + 1);
}

function fromFirestoreDocument(doc: { name: string; fields?: Record<string, FirestoreValue> }): Record<string, unknown> {
  return { id: docIdFromName(doc.name), ...fromFirestoreFields(doc.fields ?? {}) };
}

function generateId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 20; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

// ---------- HTTP plumbing ----------

function buildUrl(path: string, params?: Record<string, string>): string {
  const url = new URL(path);
  url.searchParams.set('key', firebaseEnv.apiKey);
  for (const [k, v] of Object.entries(params ?? {})) url.searchParams.append(k, v);
  return url.toString();
}

async function authHeaders(): Promise<Record<string, string>> {
  const idToken = await getValidIdToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (idToken) headers.Authorization = `Bearer ${idToken}`;
  return headers;
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body?.error?.message ?? `HTTP_${res.status}`;
  } catch {
    return `HTTP_${res.status}`;
  }
}

// ---------- Reads ----------

/** Fetches a single document by path (e.g. "subjects/math"). Returns null if it doesn't exist. */
export async function getDocument(path: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(buildUrl(`${DOCUMENTS_URL}/${path}`), { headers: await authHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return fromFirestoreDocument(await res.json());
}

/** Fetches every document directly under a collection path (e.g. "subjects", or "subjects/math/chapters"). */
export async function listDocuments(collectionPath: string): Promise<Record<string, unknown>[]> {
  const results: Record<string, unknown>[] = [];
  let pageToken: string | undefined;
  do {
    const res = await fetch(
      buildUrl(`${DOCUMENTS_URL}/${collectionPath}`, { pageSize: '300', ...(pageToken ? { pageToken } : {}) }),
      { headers: await authHeaders() }
    );
    if (!res.ok) throw new Error(await parseErrorMessage(res));
    const data = await res.json();
    for (const doc of data.documents ?? []) results.push(fromFirestoreDocument(doc));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return results;
}

export type FirestoreOp = '==' | '<' | '<=' | '>' | '>=' | '!=' | 'array-contains' | 'in' | 'array-contains-any' | 'not-in';

const OP_MAP: Record<FirestoreOp, string> = {
  '==': 'EQUAL',
  '<': 'LESS_THAN',
  '<=': 'LESS_THAN_OR_EQUAL',
  '>': 'GREATER_THAN',
  '>=': 'GREATER_THAN_OR_EQUAL',
  '!=': 'NOT_EQUAL',
  'array-contains': 'ARRAY_CONTAINS',
  in: 'IN',
  'array-contains-any': 'ARRAY_CONTAINS_ANY',
  'not-in': 'NOT_IN',
};

export interface QueryOptions {
  where?: { field: string; op: FirestoreOp; value: unknown }[];
  orderBy?: { field: string; direction?: 'asc' | 'desc' }[];
  limit?: number;
}

/**
 * Runs a structured query against a collection (e.g. Collections.questions, or
 * Collections.chapters(subjectId)). Mirrors query(collection(db, path), where(...), orderBy(...), limit(...)).
 */
export async function runQuery(collectionPath: string, options: QueryOptions = {}): Promise<Record<string, unknown>[]> {
  const lastSlash = collectionPath.lastIndexOf('/');
  const collectionId = lastSlash === -1 ? collectionPath : collectionPath.slice(lastSlash + 1);
  const parentPath = lastSlash === -1 ? '' : collectionPath.slice(0, lastSlash);

  const structuredQuery: Record<string, unknown> = {
    from: [{ collectionId, allDescendants: false }],
  };

  if (options.where?.length) {
    const filters = options.where.map((w) => ({
      fieldFilter: {
        field: { fieldPath: w.field },
        op: OP_MAP[w.op],
        value: toFirestoreValue(w.value),
      },
    }));
    structuredQuery.where = filters.length === 1 ? filters[0] : { compositeFilter: { op: 'AND', filters } };
  }

  if (options.orderBy?.length) {
    structuredQuery.orderBy = options.orderBy.map((o) => ({
      field: { fieldPath: o.field },
      direction: o.direction === 'desc' ? 'DESCENDING' : 'ASCENDING',
    }));
  }

  if (options.limit) structuredQuery.limit = options.limit;

  const res = await fetch(buildUrl(`${DOCUMENTS_URL}${parentPath ? `/${parentPath}` : ''}:runQuery`), {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ structuredQuery }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  const rows: { document?: { name: string; fields?: Record<string, FirestoreValue> } }[] = await res.json();
  return rows.filter((r) => r.document).map((r) => fromFirestoreDocument(r.document!));
}

// ---------- Writes ----------

export interface WriteSpec {
  type: 'set' | 'merge' | 'delete';
  path: string;
  data?: Record<string, unknown>;
}

/** Builds a single write spec for commitWrites(), replacing a batch.set() call. */
export function setWrite(path: string, data: Record<string, unknown>, opts?: { merge?: boolean }): WriteSpec {
  return { type: opts?.merge ? 'merge' : 'set', path, data };
}

function buildWrite(spec: WriteSpec): Record<string, unknown> {
  if (spec.type === 'delete') {
    return { delete: `${RESOURCE_PATH}/${spec.path}` };
  }

  const data = spec.data ?? {};
  const plainEntries: Record<string, unknown> = {};
  const transforms: Record<string, unknown>[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (isSentinel(value)) {
      if (value.__firestoreSentinel === 'serverTimestamp') {
        transforms.push({ fieldPath: key, setToServerValue: 'REQUEST_TIME' });
      } else {
        transforms.push({ fieldPath: key, increment: toFirestoreValue(value.by) });
      }
    } else {
      plainEntries[key] = value;
    }
  }

  const write: Record<string, unknown> = {
    update: { name: `${RESOURCE_PATH}/${spec.path}`, fields: toFirestoreFields(plainEntries) },
  };
  if (spec.type === 'merge') {
    write.updateMask = { fieldPaths: Object.keys(plainEntries) };
  }
  if (transforms.length) write.updateTransforms = transforms;
  return write;
}

/** Commits one or more writes atomically (replaces firebase/firestore's writeBatch). */
export async function commitWrites(specs: WriteSpec[]): Promise<void> {
  if (specs.length === 0) return;
  const res = await fetch(buildUrl(`${DOCUMENTS_URL}:commit`), {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ writes: specs.map(buildWrite) }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
}

/** Creates a new document under collectionPath, replacing addDoc(). Returns the new document's id. */
export async function createDocument(
  collectionPath: string,
  data: Record<string, unknown>,
  docId?: string
): Promise<{ id: string }> {
  const id = docId ?? generateId();
  await commitWrites([{ type: 'set', path: `${collectionPath}/${id}`, data }]);
  return { id };
}

/** Overwrites (merge: false) or merges (merge: true) a document at an exact path, replacing setDoc(). */
export async function setDocument(path: string, data: Record<string, unknown>, opts?: { merge?: boolean }): Promise<void> {
  await commitWrites([{ type: opts?.merge ? 'merge' : 'set', path, data }]);
}

/** Partially updates a document, replacing updateDoc(). */
export async function updateDocument(path: string, data: Record<string, unknown>): Promise<void> {
  await commitWrites([{ type: 'merge', path, data }]);
}

/** Deletes a document, replacing deleteDoc(). */
export async function deleteDocument(path: string): Promise<void> {
  await commitWrites([{ type: 'delete', path }]);
}

/** Builds a batch of update writes for commitWrites, replacing writeBatch()'s batch.update() calls. */
export function batchUpdate(entries: { path: string; data: Record<string, unknown> }[]): WriteSpec[] {
  return entries.map((e) => ({ type: 'merge', path: e.path, data: e.data }));
}
