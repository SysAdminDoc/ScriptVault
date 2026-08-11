// ============================================================================
// ScriptVault IndexedDB schema + DAO
// ----------------------------------------------------------------------------
// Defines the four object stores backing v3.0 storage and exposes thin DAO
// helpers used by the public storage modules. Public API (ScriptStorage,
// ScriptValues, etc.) is unchanged — only the engine swaps.
// ============================================================================

import type { Script } from '../types/index';
import {
  DB_NAME,
  DB_VERSION,
  Stores,
  isStorageBucketPartitioningActive,
  openDB,
  reqToPromise,
  forEachCursor,
  type OpenTarget,
  type StoreName,
  type StoragePartition,
} from './idb';
import { withTransaction } from './transaction';

// ----------------------------------------------------------------------------
// Schema
// ----------------------------------------------------------------------------
//
// scripts:
//   keyPath: 'id'
//   indexes: by-enabled, by-position, by-namespace
// values:
//   keyPath: ['scriptId', 'key']  (compound) — single-key reads avoid loading
//   the full script's value bag.
//   indexes: by-script (scriptId)
// stats:
//   keyPath: 'scriptId'
// backups:
//   keyPath: 'id'
//   indexes: by-created (createdAt)
// localWorkspaceBindings:
//   keyPath: 'bindingId'
//   indexes: by-script (scriptId), by-project (projectId),
//            by-relative-path (relativePath)
// publicationReceipts:
//   keyPath: 'receiptId'
//   indexes: by-script (scriptId), by-created (createdAt)
//
// Stores that shipped in v1 are created under `oldVersion < 1`. New stores
// bump DB_VERSION and add an `if (oldVersion < N)` block in `upgradeSchema()`.

export interface ScriptStatsRecord {
  scriptId: string;
  runCount: number;
  lastRun: number | null;
  errors: number;
  lastError?: { message: string; ts: number } | null;
}

export interface ScriptValueRow {
  scriptId: string;
  key: string;
  value: unknown;
  updatedAt?: number;
  clock?: GmValueClockRecord;
}

export interface GmValueClockRecord {
  ts: number;
  counter: number;
  deviceId: string;
}

export interface GmValueKeyMetadataRecord {
  updatedAt?: number;
  clock?: GmValueClockRecord;
}

export interface BackupRecord {
  id: string;
  name: string;
  createdAt: number;
  byteSize: number;
  data: ArrayBuffer;
  // When true, `data` is gzip-compressed (CompressionStream). Absent/false means
  // the record predates compression and `data` is the raw blob — read
  // transparently either way. `byteSize` is always the uncompressed size.
  compressed?: boolean;
  meta?: Record<string, unknown>;
}

interface StoredScriptRecord extends Omit<Script, 'code'> {
  code?: string;
  codeCompressed?: boolean;
  codeGzip?: ArrayBuffer;
  codeByteSize?: number;
}

export type StatsUrlRetentionMode = 'origin' | 'none';

export interface StatsUrlRewriteResult {
  id: string;
  lastUrl?: string;
}

export interface ScriptRestoreResult {
  collision: boolean;
  existing?: Record<string, unknown>;
}

function retainStatsUrl(url: unknown, mode: StatsUrlRetentionMode): string | undefined {
  if (mode === 'none' || typeof url !== 'string' || !url) return undefined;
  try {
    const origin = new URL(url).origin;
    return origin === 'null' ? undefined : origin;
  } catch (_) {
    return undefined;
  }
}

export type LocalWorkspaceBindingKind = 'script' | 'library' | 'project' | 'project-file';

export interface LocalWorkspaceBindingRecord {
  bindingId: string;
  scriptId: string;
  bindingKind?: LocalWorkspaceBindingKind;
  libraryId?: string;
  projectId?: string;
  relativePath?: string;
  manifest?: Record<string, unknown>;
  handle?: unknown;
  fileHandle?: unknown;
  displayName: string;
  lastKnownSha256?: string;
  lastKnownSize?: number;
  lastKnownModified?: number;
  permissionState?: PermissionState | 'unknown';
  createdAt: number;
  updatedAt: number;
  lastRefreshAt?: number | null;
  lastErrorKind?: string;
  lastStatusKind?: string;
}

export interface LocalWorkspaceBindingSummary {
  bindingId: string;
  scriptId: string;
  bindingKind: LocalWorkspaceBindingKind;
  libraryId?: string;
  projectId?: string;
  relativePath?: string;
  displayName: string;
  lastKnownSha256?: string;
  lastKnownSize?: number;
  lastKnownModified?: number;
  permissionState?: PermissionState | 'unknown';
  createdAt: number;
  updatedAt: number;
  lastRefreshAt?: number | null;
  lastErrorKind?: string;
  lastStatusKind?: string;
}

function setRecordKey<T>(record: Record<string, T>, key: string, value: T): void {
  Object.defineProperty(record, String(key), {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

const ALL_SCHEMA_STORES = Object.values(Stores) as StoreName[];
const PARTITION_SCHEMA_STORES: Record<StoragePartition, StoreName[]> = {
  scripts: [Stores.scripts, Stores.stats, Stores.localWorkspaceBindings],
  values: [Stores.values],
  backups: [Stores.backups, Stores.publicationReceipts],
};

const SCRIPT_CODE_COMPRESSION_THRESHOLD_BYTES = 64 * 1024;
const SCRIPT_CODE_ENCODER = new TextEncoder();
const SCRIPT_CODE_DECODER = new TextDecoder();
const GM_VALUE_SYNC_HLC_STATE_KEY = 'gmValueSyncHlcState';
const GM_VALUE_SYNC_CONFLICT_SIDECAR_KEY = 'gmValueSyncConflictSidecar';
const GM_VALUE_SYNC_CONFLICT_MAX_KEYS = 128;
const GM_VALUE_SYNC_CONFLICT_MAX_PER_KEY = 4;
const GM_VALUE_SYNC_CONFLICT_MAX_BYTES = 256 * 1024;
const GM_VALUE_SYNC_CONFLICT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

interface GmValueHlcState {
  deviceId: string;
  lastTs: number;
  counter: number;
}

let _gmValueHlcState: GmValueHlcState | null = null;
let _gmValueHlcStatePromise: Promise<GmValueHlcState> | null = null;
let _gmValueHlcWriteChain: Promise<unknown> = Promise.resolve();

function makeGmValueDeviceId(): string {
  const randomUuid = (globalThis.crypto as Crypto | undefined)?.randomUUID?.();
  if (randomUuid) return randomUuid;
  const random = Math.random().toString(36).slice(2);
  return `device-${Date.now().toString(36)}-${random}`.slice(0, 128);
}

function normalizeGmValueClockRecord(value: unknown): GmValueClockRecord | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const ts = Number((value as Partial<GmValueClockRecord>).ts);
  const counter = Number((value as Partial<GmValueClockRecord>).counter);
  const deviceId = typeof (value as Partial<GmValueClockRecord>).deviceId === 'string'
    ? (value as Partial<GmValueClockRecord>).deviceId!.trim()
    : '';
  if (!Number.isFinite(ts) || ts < 0 || !Number.isFinite(counter) || counter < 0 || !deviceId || deviceId.length > 128) {
    return undefined;
  }
  return { ts: Math.floor(ts), counter: Math.floor(counter), deviceId };
}

async function loadGmValueHlcState(): Promise<GmValueHlcState> {
  if (_gmValueHlcState) return { ..._gmValueHlcState };
  if (_gmValueHlcStatePromise) return _gmValueHlcStatePromise;
  _gmValueHlcStatePromise = (async () => {
    let stored: unknown;
    try {
      stored = (await chrome.storage.local.get(GM_VALUE_SYNC_HLC_STATE_KEY))[GM_VALUE_SYNC_HLC_STATE_KEY];
    } catch (_) {
      stored = undefined;
    }
    const record = stored && typeof stored === 'object' ? stored as Partial<GmValueHlcState> : {};
    const state: GmValueHlcState = {
      deviceId: typeof record.deviceId === 'string' && record.deviceId.trim()
        ? record.deviceId.trim().slice(0, 128)
        : makeGmValueDeviceId(),
      lastTs: Number.isFinite(Number(record.lastTs)) && Number(record.lastTs) >= 0
        ? Math.floor(Number(record.lastTs))
        : 0,
      counter: Number.isFinite(Number(record.counter)) && Number(record.counter) >= 0
        ? Math.floor(Number(record.counter))
        : 0,
    };
    _gmValueHlcState = state;
    try {
      await chrome.storage.local.set({ [GM_VALUE_SYNC_HLC_STATE_KEY]: state });
    } catch (_) {
      // The in-memory state still prevents collisions during this worker life.
    }
    return { ...state };
  })();
  try {
    return await _gmValueHlcStatePromise;
  } finally {
    _gmValueHlcStatePromise = null;
  }
}

function queueGmValueHlcWrite<T>(operation: () => Promise<T>): Promise<T> {
  const result = _gmValueHlcWriteChain.then(operation, operation);
  _gmValueHlcWriteChain = result.then(() => undefined, () => undefined);
  return result;
}

async function nextGmValueClock(): Promise<GmValueClockRecord> {
  return queueGmValueHlcWrite(async () => {
    const state = await loadGmValueHlcState();
    const now = Date.now();
    const ts = Math.max(now, state.lastTs);
    const counter = ts === state.lastTs ? state.counter + 1 : 0;
    const nextState = { ...state, lastTs: ts, counter };
    _gmValueHlcState = nextState;
    try {
      await chrome.storage.local.set({ [GM_VALUE_SYNC_HLC_STATE_KEY]: nextState });
    } catch (_) {
      // The row still carries a unique monotonic clock for this worker.
    }
    return { ts, counter, deviceId: state.deviceId };
  });
}

async function observeGmValueClocks(clocks: GmValueClockRecord[]): Promise<void> {
  const valid = clocks.map(normalizeGmValueClockRecord).filter((clock): clock is GmValueClockRecord => !!clock);
  if (valid.length === 0) return;
  await queueGmValueHlcWrite(async () => {
    const state = await loadGmValueHlcState();
    let nextState = { ...state };
    for (const clock of valid) {
      if (clock.ts > nextState.lastTs) {
        nextState.lastTs = clock.ts;
        nextState.counter = clock.counter + 1;
      } else if (clock.ts === nextState.lastTs) {
        nextState.counter = Math.max(nextState.counter, clock.counter + 1);
      }
    }
    _gmValueHlcState = nextState;
    try {
      await chrome.storage.local.set({ [GM_VALUE_SYNC_HLC_STATE_KEY]: nextState });
    } catch (_) {
      // Best effort; local writes still continue with the in-memory state.
    }
  });
}

function cloneGmValueStorageValue<T>(value: T): T {
  if (value == null || typeof value !== 'object') return value;
  if (typeof structuredClone === 'function') {
    try { return structuredClone(value); } catch (_) { /* fall through */ }
  }
  try { return JSON.parse(JSON.stringify(value)) as T; } catch (_) { return value; }
}

function normalizeGmValueConflictSidecar(value: unknown, now = Date.now()): Record<string, unknown[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const output: Record<string, unknown[]> = {};
  for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) {
    if (Object.keys(output).length >= GM_VALUE_SYNC_CONFLICT_MAX_KEYS) break;
    const entries = (value as Record<string, unknown>)[key];
    if (!Array.isArray(entries)) continue;
    const valid = entries.filter((entry) => {
      const clock = normalizeGmValueClockRecord((entry as Record<string, unknown>)?.clock);
      const retainedAt = Number((entry as Record<string, unknown>)?.retainedAt);
      return !!clock && Number.isFinite(retainedAt) && retainedAt >= now - GM_VALUE_SYNC_CONFLICT_RETENTION_MS;
    }).slice(0, GM_VALUE_SYNC_CONFLICT_MAX_PER_KEY).map(cloneGmValueStorageValue);
    if (valid.length > 0) Object.defineProperty(output, key, { value: valid, enumerable: true, configurable: true, writable: true });
  }
  try {
    if (new TextEncoder().encode(JSON.stringify(output)).length > GM_VALUE_SYNC_CONFLICT_MAX_BYTES) {
      const bounded: Record<string, unknown[]> = {};
      for (const [key, entries] of Object.entries(output)) {
        const next = { ...bounded, [key]: entries };
        if (new TextEncoder().encode(JSON.stringify(next)).length > GM_VALUE_SYNC_CONFLICT_MAX_BYTES) break;
        Object.defineProperty(bounded, key, { value: entries, enumerable: true, configurable: true, writable: true });
      }
      return bounded;
    }
  } catch (_) {
    return {};
  }
  return output;
}

function targetStores(target: OpenTarget): Set<StoreName> {
  return new Set(target.bucketed ? PARTITION_SCHEMA_STORES[target.partition] : ALL_SCHEMA_STORES);
}

function shouldCreateStore(db: IDBDatabase, stores: Set<StoreName>, store: StoreName): boolean {
  return stores.has(store) && !db.objectStoreNames.contains(store);
}

async function gzipScriptCode(bytes: Uint8Array): Promise<ArrayBuffer> {
  const stream = new globalThis.ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  }).pipeThrough(new globalThis.CompressionStream('gzip') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>);
  return new globalThis.Response(stream).arrayBuffer();
}

async function gunzipScriptCode(data: ArrayBuffer): Promise<string> {
  const stream = new globalThis.ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(data));
      controller.close();
    },
  }).pipeThrough(new globalThis.DecompressionStream('gzip') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>);
  const bytes = await new globalThis.Response(stream).arrayBuffer();
  return SCRIPT_CODE_DECODER.decode(bytes);
}

function coerceArrayBuffer(value: unknown): ArrayBuffer | null {
  if (value instanceof ArrayBuffer) return value;
  if (value && typeof value === 'object' && typeof (value as { byteLength?: unknown }).byteLength === 'number') {
    try {
      const source = new Uint8Array(value as ArrayBufferLike);
      const copy = new Uint8Array(source.byteLength);
      copy.set(source);
      return copy.buffer;
    } catch (_) {}
  }
  if (ArrayBuffer.isView(value)) {
    const view = value as ArrayBufferView;
    const copy = new Uint8Array(view.byteLength);
    copy.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
    return copy.buffer;
  }
  return null;
}

async function encodeScriptForStorage(script: Script): Promise<StoredScriptRecord> {
  const row = { ...script } as StoredScriptRecord;
  const code = typeof script.code === 'string' ? script.code : '';
  const raw = SCRIPT_CODE_ENCODER.encode(code);

  delete row.codeCompressed;
  delete row.codeGzip;
  delete row.codeByteSize;

  if (
    raw.byteLength > SCRIPT_CODE_COMPRESSION_THRESHOLD_BYTES
    && typeof globalThis.CompressionStream === 'function'
    && typeof globalThis.DecompressionStream === 'function'
    && typeof globalThis.ReadableStream === 'function'
    && typeof globalThis.Response === 'function'
  ) {
    try {
      row.codeGzip = await gzipScriptCode(raw);
      row.codeCompressed = true;
      row.codeByteSize = raw.byteLength;
      delete row.code;
      return row;
    } catch (_) {
      // If the browser lacks working stream compression, fall back to the
      // legacy raw code field so script persistence never depends on gzip.
    }
  }

  row.code = code;
  return row;
}

async function decodeScriptFromStorage(row: StoredScriptRecord | Script | undefined): Promise<Script | null> {
  if (!row) return null;
  const script = { ...row } as StoredScriptRecord & { code: string };

  if (script.codeCompressed) {
    const data = coerceArrayBuffer(script.codeGzip);
    if (data) {
      script.code = await gunzipScriptCode(data);
    } else {
      script.code = typeof script.code === 'string' ? script.code : '';
    }
  } else {
    script.code = typeof script.code === 'string' ? script.code : '';
  }

  delete script.codeCompressed;
  delete script.codeGzip;
  delete script.codeByteSize;
  return script as Script;
}

function upgradeSchema(
  db: IDBDatabase,
  oldVersion: number,
  _newVersion: number,
  _tx: IDBTransaction,
  target: OpenTarget,
): void {
  const stores = targetStores(target);

  if (oldVersion < 1) {
    if (shouldCreateStore(db, stores, Stores.scripts)) {
      const scripts = db.createObjectStore(Stores.scripts, { keyPath: 'id' });
      scripts.createIndex('by-enabled', 'enabled', { unique: false });
      scripts.createIndex('by-position', 'position', { unique: false });
      scripts.createIndex('by-namespace', 'meta.namespace', { unique: false });
    }

    if (shouldCreateStore(db, stores, Stores.values)) {
      const values = db.createObjectStore(Stores.values, {
        keyPath: ['scriptId', 'key'],
      });
      values.createIndex('by-script', 'scriptId', { unique: false });
    }

    if (shouldCreateStore(db, stores, Stores.stats)) {
      db.createObjectStore(Stores.stats, { keyPath: 'scriptId' });
    }

    if (shouldCreateStore(db, stores, Stores.backups)) {
      const backups = db.createObjectStore(Stores.backups, { keyPath: 'id' });
      backups.createIndex('by-created', 'createdAt', { unique: false });
    }
  }
  if (oldVersion < 2 && shouldCreateStore(db, stores, Stores.localWorkspaceBindings)) {
    const bindings = db.createObjectStore(Stores.localWorkspaceBindings, { keyPath: 'bindingId' });
    bindings.createIndex('by-script', 'scriptId', { unique: false });
  }
  if (oldVersion < 3 && shouldCreateStore(db, stores, Stores.publicationReceipts)) {
    const receipts = db.createObjectStore(Stores.publicationReceipts, { keyPath: 'receiptId' });
    receipts.createIndex('by-script', 'scriptId', { unique: false });
    receipts.createIndex('by-created', 'createdAt', { unique: false });
  }

  if (oldVersion < 3 && db.objectStoreNames.contains(Stores.localWorkspaceBindings)) {
    const bindings = _tx.objectStore(Stores.localWorkspaceBindings);
    if (!bindings.indexNames.contains('by-project')) bindings.createIndex('by-project', 'projectId', { unique: false });
    if (!bindings.indexNames.contains('by-relative-path')) bindings.createIndex('by-relative-path', 'relativePath', { unique: false });
  }
}

// Single chokepoint that opens the DB with the schema upgrader bound. Every
// caller in this module routes through this so we never accidentally open
// without the upgrade callback.
export async function openScriptDB(): Promise<IDBDatabase> {
  return openStoragePartitionDB('scripts');
}

export async function openStoragePartitionDB(partition: StoragePartition): Promise<IDBDatabase> {
  return openDB({ name: DB_NAME, version: DB_VERSION, upgrade: upgradeSchema, partition });
}

async function openValuesDB(): Promise<IDBDatabase> {
  return openStoragePartitionDB('values');
}

async function openBackupsDB(): Promise<IDBDatabase> {
  return openStoragePartitionDB('backups');
}

// ----------------------------------------------------------------------------
// Scripts DAO
// ----------------------------------------------------------------------------

export const ScriptsDAO = {
  async get(id: string): Promise<Script | null> {
    await openScriptDB();
    return withTransaction(Stores.scripts, 'readonly', async (tx) => {
      const row = await reqToPromise(tx.objectStore(Stores.scripts).get(id));
      return decodeScriptFromStorage(row as StoredScriptRecord | undefined);
    });
  },

  async getAll(): Promise<Script[]> {
    await openScriptDB();
    return withTransaction(Stores.scripts, 'readonly', async (tx) => {
      const rows = await reqToPromise(tx.objectStore(Stores.scripts).getAll());
      return Promise.all(((rows as StoredScriptRecord[]) ?? []).map((row) => decodeScriptFromStorage(row) as Promise<Script>));
    });
  },

  async put(script: Script): Promise<void> {
    await openScriptDB();
    const row = await encodeScriptForStorage(script);
    await withTransaction(Stores.scripts, 'readwrite', async (tx) => {
      await reqToPromise(tx.objectStore(Stores.scripts).put(row));
    });
  },

  /**
   * Restore a script with an atomic collision check in the scripts store.
   * Returning the current raw row keeps the check inside the transaction;
   * callers only need its metadata when a replace decision is required.
   */
  async restore(script: Script, replaceExisting = false): Promise<ScriptRestoreResult> {
    await openScriptDB();
    const row = await encodeScriptForStorage(script);
    return withTransaction(Stores.scripts, 'readwrite', async (tx) => {
      const store = tx.objectStore(Stores.scripts);
      const existing = await reqToPromise(store.get(script.id)) as StoredScriptRecord | undefined;
      if (existing && !replaceExisting) {
        return { collision: true, existing: { ...existing } };
      }
      await reqToPromise(store.put(row));
      return { collision: false };
    });
  },

  /**
   * Update every script position in one transaction without rewriting the
   * rest of any script record. The transaction re-reads the store so a
   * concurrent save cannot be overwritten by a stale in-memory snapshot.
   */
  async reorderPositions(orderedIds: string[]): Promise<void> {
    if (!Array.isArray(orderedIds) || orderedIds.some((id) => typeof id !== 'string' || id.length === 0)) {
      throw new TypeError('Script order must contain non-empty string IDs');
    }
    await openScriptDB();
    await withTransaction(Stores.scripts, 'readwrite', async (tx) => {
      const store = tx.objectStore(Stores.scripts);
      const rows = (await reqToPromise(store.getAll()) as StoredScriptRecord[]) ?? [];
      const rowsById = new Map(rows.map((row) => [row.id, row]));
      const submittedIds = new Set(orderedIds);
      if (
        orderedIds.length !== rows.length
        || submittedIds.size !== rows.length
        || rows.some((row) => !submittedIds.has(row.id))
      ) {
        throw new Error('Script order must be a permutation of the stored script IDs');
      }

      for (const [position, id] of orderedIds.entries()) {
        const row = rowsById.get(id);
        if (!row) throw new Error('Script order contains an unknown script ID');
        if (row.position === position) continue;
        row.position = position;
        await reqToPromise(store.put(row));
      }
    });
  },

  /**
   * Irreversibly reduce every persisted execution URL in one IDB transaction.
   * Returning only the minimized values lets ScriptStorage update its mirror
   * without re-reading (or accidentally retaining) the original full URLs.
   */
  async rewriteStatsUrls(mode: StatsUrlRetentionMode): Promise<StatsUrlRewriteResult[]> {
    await openScriptDB();
    return withTransaction(Stores.scripts, 'readwrite', async (tx) => {
      const store = tx.objectStore(Stores.scripts);
      const rows = (await reqToPromise(store.getAll()) as StoredScriptRecord[]) ?? [];
      const changed: StatsUrlRewriteResult[] = [];

      for (const row of rows) {
        if (!row.stats || !Object.prototype.hasOwnProperty.call(row.stats, 'lastUrl')) continue;
        const lastUrl = retainStatsUrl(row.stats.lastUrl, mode);
        if (lastUrl === row.stats.lastUrl) continue;

        row.stats = { ...row.stats };
        if (lastUrl) row.stats.lastUrl = lastUrl;
        else delete row.stats.lastUrl;
        await reqToPromise(store.put(row));
        changed.push(lastUrl ? { id: row.id, lastUrl } : { id: row.id });
      }

      return changed;
    });
  },

  async delete(id: string): Promise<void> {
    await openScriptDB();
    if (await isStorageBucketPartitioningActive()) {
      await withTransaction(
        [Stores.scripts, Stores.stats, Stores.localWorkspaceBindings] as StoreName[],
        'readwrite',
        async (tx) => {
          await reqToPromise(tx.objectStore(Stores.scripts).delete(id));
          await reqToPromise(tx.objectStore(Stores.stats).delete(id));
          const bindingIdx = tx.objectStore(Stores.localWorkspaceBindings).index('by-script');
          await forEachCursor<LocalWorkspaceBindingRecord>(bindingIdx, (_v, _k, primaryKey) => {
            tx.objectStore(Stores.localWorkspaceBindings).delete(primaryKey);
          }, IDBKeyRange.only(id));
        },
      );
      try {
        await ValuesDAO.deleteAll(id);
      } catch (e) {
        console.warn('[ScriptVault] Removed script but could not clean up orphaned GM values:', e);
      }
      return;
    }
    // Legacy single-DB fallback can still wipe the script row and associated
    // values/stats in one transaction.
    await withTransaction(
      [Stores.scripts, Stores.values, Stores.stats, Stores.localWorkspaceBindings] as StoreName[],
      'readwrite',
      async (tx) => {
        await reqToPromise(tx.objectStore(Stores.scripts).delete(id));
        await reqToPromise(tx.objectStore(Stores.stats).delete(id));
        const valuesIdx = tx.objectStore(Stores.values).index('by-script');
        await forEachCursor<ScriptValueRow>(valuesIdx, (_v, _k, primaryKey) => {
          tx.objectStore(Stores.values).delete(primaryKey);
        }, IDBKeyRange.only(id));
        const bindingIdx = tx.objectStore(Stores.localWorkspaceBindings).index('by-script');
        await forEachCursor<LocalWorkspaceBindingRecord>(bindingIdx, (_v, _k, primaryKey) => {
          tx.objectStore(Stores.localWorkspaceBindings).delete(primaryKey);
        }, IDBKeyRange.only(id));
      },
    );
  },

  async clear(): Promise<void> {
    await openScriptDB();
    if (await isStorageBucketPartitioningActive()) {
      await withTransaction(
        [Stores.scripts, Stores.stats, Stores.localWorkspaceBindings] as StoreName[],
        'readwrite',
        async (tx) => {
          await reqToPromise(tx.objectStore(Stores.scripts).clear());
          await reqToPromise(tx.objectStore(Stores.stats).clear());
          await reqToPromise(tx.objectStore(Stores.localWorkspaceBindings).clear());
        },
      );
      try {
        await ValuesDAO.clear();
      } catch (e) {
        console.warn('[ScriptVault] Removed scripts but could not clean up orphaned GM values:', e);
      }
      return;
    }
    await withTransaction(
      [Stores.scripts, Stores.values, Stores.stats, Stores.localWorkspaceBindings] as StoreName[],
      'readwrite',
      async (tx) => {
        await reqToPromise(tx.objectStore(Stores.scripts).clear());
        await reqToPromise(tx.objectStore(Stores.values).clear());
        await reqToPromise(tx.objectStore(Stores.stats).clear());
        await reqToPromise(tx.objectStore(Stores.localWorkspaceBindings).clear());
      },
    );
  },

  async count(): Promise<number> {
    await openScriptDB();
    return withTransaction(Stores.scripts, 'readonly', async (tx) => {
      return reqToPromise(tx.objectStore(Stores.scripts).count());
    });
  },

  // Bulk insert used by the v2→v3 migration. Single transaction so a partial
  // failure leaves the DB empty rather than half-imported.
  async bulkPut(scripts: Script[]): Promise<void> {
    if (scripts.length === 0) return;
    await openScriptDB();
    const rows = await Promise.all(scripts.map((script) => encodeScriptForStorage(script)));
    await withTransaction(Stores.scripts, 'readwrite', async (tx) => {
      const store = tx.objectStore(Stores.scripts);
      for (const s of rows) {
        await reqToPromise(store.put(s));
      }
    });
  },
};

// ----------------------------------------------------------------------------
// Values DAO (GM_getValue/setValue persistence)
// ----------------------------------------------------------------------------

export const ValuesDAO = {
  async getSyncDeviceId(): Promise<string> {
    const state = await loadGmValueHlcState();
    return state.deviceId;
  },

  async get(scriptId: string, key: string): Promise<unknown> {
    await openValuesDB();
    return withTransaction(Stores.values, 'readonly', async (tx) => {
      const row = await reqToPromise(
        tx.objectStore(Stores.values).get([scriptId, key]) as IDBRequest<ScriptValueRow | undefined>,
      );
      return row ? row.value : undefined;
    });
  },

  async set(scriptId: string, key: string, value: unknown): Promise<void> {
    await openValuesDB();
    const clock = await nextGmValueClock();
    await withTransaction(Stores.values, 'readwrite', async (tx) => {
      const row: ScriptValueRow = { scriptId, key, value, updatedAt: clock.ts, clock };
      await reqToPromise(tx.objectStore(Stores.values).put(row));
    });
  },

  async delete(scriptId: string, key: string): Promise<void> {
    await openValuesDB();
    await withTransaction(Stores.values, 'readwrite', async (tx) => {
      await reqToPromise(tx.objectStore(Stores.values).delete([scriptId, key]));
    });
  },

  async getAll(scriptId: string): Promise<Record<string, unknown>> {
    await openValuesDB();
    return withTransaction(Stores.values, 'readonly', async (tx) => {
      const out: Record<string, unknown> = {};
      const idx = tx.objectStore(Stores.values).index('by-script');
      await forEachCursor<ScriptValueRow>(idx, (row) => {
        setRecordKey(out, row.key, row.value);
      }, IDBKeyRange.only(scriptId));
      return out;
    });
  },

  async getAllMetadata(scriptId: string): Promise<{ valueCount: number; lastUpdatedAt: number | null }> {
    await openValuesDB();
    return withTransaction(Stores.values, 'readonly', async (tx) => {
      let valueCount = 0;
      let lastUpdatedAt: number | null = null;
      const idx = tx.objectStore(Stores.values).index('by-script');
      await forEachCursor<ScriptValueRow>(idx, (row) => {
        valueCount += 1;
        const updatedAt = Number(row.updatedAt);
        if (Number.isFinite(updatedAt) && updatedAt > 0) {
          lastUpdatedAt = Math.max(lastUpdatedAt ?? 0, updatedAt);
        }
      }, IDBKeyRange.only(scriptId));
      return { valueCount, lastUpdatedAt };
    });
  },

  async getAllKeyMetadata(scriptId: string): Promise<Record<string, GmValueKeyMetadataRecord>> {
    await openValuesDB();
    return withTransaction(Stores.values, 'readonly', async (tx) => {
      const out: Record<string, GmValueKeyMetadataRecord> = {};
      const idx = tx.objectStore(Stores.values).index('by-script');
      await forEachCursor<ScriptValueRow>(idx, (row) => {
        const updatedAt = Number(row.updatedAt);
        const clock = normalizeGmValueClockRecord(row.clock);
        if (Number.isFinite(updatedAt) && updatedAt > 0) {
          setRecordKey(out, row.key, {
            updatedAt: Math.floor(updatedAt),
            ...(clock ? { clock } : {}),
          });
        } else if (clock) {
          setRecordKey(out, row.key, { clock });
        }
      }, IDBKeyRange.only(scriptId));
      return out;
    });
  },

  async list(scriptId: string): Promise<string[]> {
    const all = await this.getAll(scriptId);
    return Object.keys(all);
  },

  async setAll(scriptId: string, values: Record<string, unknown>): Promise<void> {
    await openValuesDB();
    const clock = await nextGmValueClock();
    await withTransaction(Stores.values, 'readwrite', async (tx) => {
      const store = tx.objectStore(Stores.values);
      for (const [key, value] of Object.entries(values)) {
        await reqToPromise(store.put({ scriptId, key, value, updatedAt: clock.ts, clock } satisfies ScriptValueRow));
      }
    });
  },

  async setAllWithClocks(
    scriptId: string,
    values: Record<string, unknown>,
    keyMetadata: Record<string, GmValueKeyMetadataRecord> = {},
  ): Promise<void> {
    await openValuesDB();
    const fallbackClock = await nextGmValueClock();
    const clocks: GmValueClockRecord[] = [];
    const rows = Object.entries(values).map(([key, value]) => {
      const clock = normalizeGmValueClockRecord(keyMetadata[key]?.clock) || fallbackClock;
      clocks.push(clock);
      const updatedAt = Number(keyMetadata[key]?.updatedAt);
      return {
        scriptId,
        key,
        value,
        updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? Math.floor(updatedAt) : clock.ts,
        clock,
      } satisfies ScriptValueRow;
    });
    await observeGmValueClocks(clocks);
    await withTransaction(Stores.values, 'readwrite', async (tx) => {
      const store = tx.objectStore(Stores.values);
      for (const row of rows) await reqToPromise(store.put(row));
    });
  },

  async deleteMultiple(scriptId: string, keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await openValuesDB();
    await withTransaction(Stores.values, 'readwrite', async (tx) => {
      const store = tx.objectStore(Stores.values);
      for (const key of keys) {
        await reqToPromise(store.delete([scriptId, key]));
      }
    });
  },

  async deleteAll(scriptId: string): Promise<void> {
    await openValuesDB();
    await withTransaction(Stores.values, 'readwrite', async (tx) => {
      const store = tx.objectStore(Stores.values);
      const idx = store.index('by-script');
      await forEachCursor<ScriptValueRow>(idx, (_row, _k, primaryKey) => {
        store.delete(primaryKey);
      }, IDBKeyRange.only(scriptId));
    });
  },

  async clear(): Promise<void> {
    await openValuesDB();
    await withTransaction(Stores.values, 'readwrite', async (tx) => {
      await reqToPromise(tx.objectStore(Stores.values).clear());
    });
  },

  async byteSize(scriptId: string): Promise<number> {
    const all = await this.getAll(scriptId);
    return new TextEncoder().encode(JSON.stringify(all)).length;
  },
};

// ----------------------------------------------------------------------------
// Local workspace bindings DAO
// ----------------------------------------------------------------------------

function summarizeLocalWorkspaceBinding(row: LocalWorkspaceBindingRecord): LocalWorkspaceBindingSummary {
  const {
    bindingId,
    scriptId,
    bindingKind,
    libraryId,
    projectId,
    relativePath,
    displayName,
    lastKnownSha256,
    lastKnownSize,
    lastKnownModified,
    permissionState,
    createdAt,
    updatedAt,
    lastRefreshAt,
    lastErrorKind,
    lastStatusKind,
  } = row;
  return {
    bindingId,
    scriptId,
    bindingKind: bindingKind === 'library'
      ? 'library'
      : bindingKind === 'project'
        ? 'project'
        : bindingKind === 'project-file'
          ? 'project-file'
          : 'script',
    libraryId: bindingKind === 'library' ? libraryId : undefined,
    projectId: projectId || undefined,
    relativePath: relativePath || undefined,
    displayName,
    lastKnownSha256,
    lastKnownSize,
    lastKnownModified,
    permissionState,
    createdAt,
    updatedAt,
    lastRefreshAt: lastRefreshAt ?? null,
    lastErrorKind,
    lastStatusKind,
  };
}

export const LocalWorkspaceBindingsDAO = {
  async put(record: LocalWorkspaceBindingRecord): Promise<LocalWorkspaceBindingSummary> {
    const now = Date.now();
    const row: LocalWorkspaceBindingRecord = {
      ...record,
      displayName: String(record.displayName || '').slice(0, 160),
      createdAt: record.createdAt || now,
      updatedAt: now,
      lastRefreshAt: record.lastRefreshAt ?? null,
    };
    await openScriptDB();
    await withTransaction(Stores.localWorkspaceBindings, 'readwrite', async (tx) => {
      await reqToPromise(tx.objectStore(Stores.localWorkspaceBindings).put(row));
    });
    return summarizeLocalWorkspaceBinding(row);
  },

  async get(bindingId: string): Promise<LocalWorkspaceBindingSummary | null> {
    await openScriptDB();
    return withTransaction(Stores.localWorkspaceBindings, 'readonly', async (tx) => {
      const row = await reqToPromise(
        tx.objectStore(Stores.localWorkspaceBindings).get(bindingId) as IDBRequest<LocalWorkspaceBindingRecord | undefined>,
      );
      return row ? summarizeLocalWorkspaceBinding(row) : null;
    });
  },

  async getHandle(bindingId: string): Promise<unknown | null> {
    await openScriptDB();
    return withTransaction(Stores.localWorkspaceBindings, 'readonly', async (tx) => {
      const row = await reqToPromise(
        tx.objectStore(Stores.localWorkspaceBindings).get(bindingId) as IDBRequest<LocalWorkspaceBindingRecord | undefined>,
      );
      return row?.handle ?? null;
    });
  },

  async getByScript(scriptId: string): Promise<LocalWorkspaceBindingSummary[]> {
    await openScriptDB();
    return withTransaction(Stores.localWorkspaceBindings, 'readonly', async (tx) => {
      const out: LocalWorkspaceBindingSummary[] = [];
      const idx = tx.objectStore(Stores.localWorkspaceBindings).index('by-script');
      await forEachCursor<LocalWorkspaceBindingRecord>(idx, (row) => {
        out.push(summarizeLocalWorkspaceBinding(row));
      }, IDBKeyRange.only(scriptId));
      return out;
    });
  },

  async getByProject(projectId: string): Promise<LocalWorkspaceBindingSummary[]> {
    await openScriptDB();
    return withTransaction(Stores.localWorkspaceBindings, 'readonly', async (tx) => {
      const out: LocalWorkspaceBindingSummary[] = [];
      const store = tx.objectStore(Stores.localWorkspaceBindings);
      if (store.indexNames.contains('by-project')) {
        const idx = store.index('by-project');
        await forEachCursor<LocalWorkspaceBindingRecord>(idx, (row) => {
          out.push(summarizeLocalWorkspaceBinding(row));
        }, IDBKeyRange.only(projectId));
      } else {
        const rows = await reqToPromise(store.getAll() as IDBRequest<LocalWorkspaceBindingRecord[]>);
        for (const row of rows ?? []) {
          if (row.projectId === projectId) out.push(summarizeLocalWorkspaceBinding(row));
        }
      }
      return out;
    });
  },

  async list(): Promise<LocalWorkspaceBindingSummary[]> {
    await openScriptDB();
    return withTransaction(Stores.localWorkspaceBindings, 'readonly', async (tx) => {
      const rows = await reqToPromise(
        tx.objectStore(Stores.localWorkspaceBindings).getAll() as IDBRequest<LocalWorkspaceBindingRecord[]>,
      );
      return (rows ?? []).map(summarizeLocalWorkspaceBinding);
    });
  },

  async delete(bindingId: string): Promise<void> {
    await openScriptDB();
    await withTransaction(Stores.localWorkspaceBindings, 'readwrite', async (tx) => {
      await reqToPromise(tx.objectStore(Stores.localWorkspaceBindings).delete(bindingId));
    });
  },

  async deleteForScript(scriptId: string): Promise<void> {
    await openScriptDB();
    await withTransaction(Stores.localWorkspaceBindings, 'readwrite', async (tx) => {
      const idx = tx.objectStore(Stores.localWorkspaceBindings).index('by-script');
      await forEachCursor<LocalWorkspaceBindingRecord>(idx, (_row, _k, primaryKey) => {
        tx.objectStore(Stores.localWorkspaceBindings).delete(primaryKey);
      }, IDBKeyRange.only(scriptId));
    });
  },

  async clear(): Promise<void> {
    await openScriptDB();
    await withTransaction(Stores.localWorkspaceBindings, 'readwrite', async (tx) => {
      await reqToPromise(tx.objectStore(Stores.localWorkspaceBindings).clear());
    });
  },
};

// ----------------------------------------------------------------------------
// Stats DAO (fire-and-forget)
// ----------------------------------------------------------------------------

export const StatsDAO = {
  async get(scriptId: string): Promise<ScriptStatsRecord | null> {
    await openScriptDB();
    return withTransaction(Stores.stats, 'readonly', async (tx) => {
      const row = await reqToPromise(
        tx.objectStore(Stores.stats).get(scriptId) as IDBRequest<ScriptStatsRecord | undefined>,
      );
      return row ?? null;
    });
  },

  async getAll(): Promise<Record<string, ScriptStatsRecord>> {
    await openScriptDB();
    return withTransaction(Stores.stats, 'readonly', async (tx) => {
      const rows = await reqToPromise(
        tx.objectStore(Stores.stats).getAll() as IDBRequest<ScriptStatsRecord[]>,
      );
      const out: Record<string, ScriptStatsRecord> = {};
      for (const r of rows ?? []) setRecordKey(out, r.scriptId, r);
      return out;
    });
  },

  async put(record: ScriptStatsRecord): Promise<void> {
    await openScriptDB();
    await withTransaction(Stores.stats, 'readwrite', async (tx) => {
      await reqToPromise(tx.objectStore(Stores.stats).put(record));
    });
  },

  // Increment helper used on each script run. Read-modify-write inside a
  // single transaction to avoid lost updates when two runs land within ms.
  async recordRun(scriptId: string, opts: { error?: string } = {}): Promise<void> {
    await openScriptDB();
    await withTransaction(Stores.stats, 'readwrite', async (tx) => {
      const store = tx.objectStore(Stores.stats);
      const existing =
        ((await reqToPromise(store.get(scriptId))) as ScriptStatsRecord | undefined) ??
        { scriptId, runCount: 0, lastRun: null, errors: 0, lastError: null };
      existing.runCount += 1;
      existing.lastRun = Date.now();
      if (opts.error) {
        existing.errors += 1;
        existing.lastError = { message: opts.error, ts: Date.now() };
      }
      await reqToPromise(store.put(existing));
    });
  },

  async delete(scriptId: string): Promise<void> {
    await openScriptDB();
    await withTransaction(Stores.stats, 'readwrite', async (tx) => {
      await reqToPromise(tx.objectStore(Stores.stats).delete(scriptId));
    });
  },
};

// ----------------------------------------------------------------------------
// Backups DAO — raw ArrayBuffer storage
// ----------------------------------------------------------------------------

export const BackupsDAO = {
  async list(): Promise<Array<Omit<BackupRecord, 'data'>>> {
    await openBackupsDB();
    return withTransaction(Stores.backups, 'readonly', async (tx) => {
      const out: Array<Omit<BackupRecord, 'data'>> = [];
      await forEachCursor<BackupRecord>(tx.objectStore(Stores.backups).index('by-created'), (row) => {
        // Strip data ArrayBuffer — list views never need the blob.
        const { data: _data, ...meta } = row;
        out.push(meta);
      }, undefined, 'prev');
      return out;
    });
  },

  async get(id: string): Promise<BackupRecord | null> {
    await openBackupsDB();
    return withTransaction(Stores.backups, 'readonly', async (tx) => {
      const row = await reqToPromise(
        tx.objectStore(Stores.backups).get(id) as IDBRequest<BackupRecord | undefined>,
      );
      return row ?? null;
    });
  },

  async put(record: BackupRecord): Promise<void> {
    await openBackupsDB();
    await withTransaction(Stores.backups, 'readwrite', async (tx) => {
      await reqToPromise(tx.objectStore(Stores.backups).put(record));
    });
  },

  async delete(id: string): Promise<void> {
    await openBackupsDB();
    await withTransaction(Stores.backups, 'readwrite', async (tx) => {
      await reqToPromise(tx.objectStore(Stores.backups).delete(id));
    });
  },

  // Erase every stored backup blob and publication receipt. Used by factory
  // reset so that full restorable script code / GM values do not survive an
  // explicit wipe in the backups partition.
  async clear(): Promise<void> {
    await openBackupsDB();
    await withTransaction(
      [Stores.backups, Stores.publicationReceipts] as StoreName[],
      'readwrite',
      async (tx) => {
        await reqToPromise(tx.objectStore(Stores.backups).clear());
        await reqToPromise(tx.objectStore(Stores.publicationReceipts).clear());
      },
    );
  },
};

// ----------------------------------------------------------------------------
// Quota
// ----------------------------------------------------------------------------

export interface QuotaInfo {
  used: number;
  quota: number;
  ratio: number;
}

export async function estimateQuota(): Promise<QuotaInfo | null> {
  if (typeof navigator === 'undefined' || !('storage' in navigator) || !navigator.storage?.estimate) {
    return null;
  }
  const est = await navigator.storage.estimate();
  const used = est.usage ?? 0;
  const quota = est.quota ?? 0;
  return { used, quota, ratio: quota > 0 ? used / quota : 0 };
}
