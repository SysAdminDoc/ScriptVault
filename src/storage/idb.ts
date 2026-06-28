// ============================================================================
// IndexedDB low-level wrapper
// ----------------------------------------------------------------------------
// Promise-wrapped helpers around the IndexedDB API. Schema upgrades happen in
// `script-db.ts` via `openScriptDB()`; this module is pure plumbing.
// ============================================================================

export const DB_NAME = 'scriptvault';
export const DB_VERSION = 3;

export const StorageBucketNames = {
  scripts: 'scriptvault-script-storage',
  values: 'scriptvault-script-values',
  backups: 'scriptvault-backup-scheduler',
} as const;

export type StoragePartition = keyof typeof StorageBucketNames;

// Object store names (single source of truth, imported by script-db.ts and
// transaction.ts so a typo cannot desync the schema).
export const Stores = {
  scripts: 'scripts',
  values: 'values',
  stats: 'stats',
  backups: 'backups',
  localWorkspaceBindings: 'localWorkspaceBindings',
  publicationReceipts: 'publicationReceipts',
} as const;

export type StoreName = (typeof Stores)[keyof typeof Stores];

export const StorePartitions: Record<StoreName, StoragePartition> = {
  [Stores.scripts]: 'scripts',
  [Stores.values]: 'values',
  [Stores.stats]: 'scripts',
  [Stores.backups]: 'backups',
  [Stores.localWorkspaceBindings]: 'scripts',
  [Stores.publicationReceipts]: 'backups',
};

export interface OpenTarget {
  partition: StoragePartition;
  bucketName: string | null;
  bucketed: boolean;
  name: string;
}

// ----------------------------------------------------------------------------
// Connection management
// ----------------------------------------------------------------------------
//
// We hold one IDBDatabase per storage partition for the service-worker
// lifetime. If a different SW context (e.g. a dashboard tab) requests an
// upgrade, the connection here receives `versionchange` and closes cleanly so
// the upgrade can proceed.

interface StorageBucketLike {
  indexedDB?: IDBFactory;
}

interface StorageBucketsNavigator extends Navigator {
  storageBuckets?: {
    open(name: string): Promise<StorageBucketLike>;
  };
}

interface ConnectionState {
  db: IDBDatabase | null;
  opening: Promise<IDBDatabase> | null;
  factory: IDBFactory | null;
  name: string | null;
  bucketed: boolean;
}

interface ResolvedOpenTarget extends OpenTarget {
  factory: IDBFactory;
}

const _connections = new Map<StoragePartition, ConnectionState>();
let _bucketModeProbe: Promise<boolean> | null = null;
let _bucketMode: boolean | null = null;

export type SchemaUpgrade = (
  db: IDBDatabase,
  oldVersion: number,
  newVersion: number,
  tx: IDBTransaction,
  target: OpenTarget,
) => void;

export interface OpenOptions {
  name?: string;
  version?: number;
  upgrade?: SchemaUpgrade;
  partition?: StoragePartition;
}

function connectionFor(partition: StoragePartition): ConnectionState {
  const existing = _connections.get(partition);
  if (existing) return existing;
  const state: ConnectionState = {
    db: null,
    opening: null,
    factory: null,
    name: null,
    bucketed: false,
  };
  _connections.set(partition, state);
  return state;
}

function globalIndexedDBFactory(): IDBFactory | null {
  return typeof indexedDB !== 'undefined' ? indexedDB : null;
}

export function hasStorageBucketsAPI(): boolean {
  const storageBuckets = typeof navigator !== 'undefined'
    ? (navigator as StorageBucketsNavigator).storageBuckets
    : undefined;
  return !!storageBuckets && typeof storageBuckets.open === 'function';
}

async function resolveOpenTarget(partition: StoragePartition, name: string): Promise<ResolvedOpenTarget> {
  const globalFactory = globalIndexedDBFactory();
  const storageBuckets = typeof navigator !== 'undefined'
    ? (navigator as StorageBucketsNavigator).storageBuckets
    : undefined;

  if (storageBuckets && typeof storageBuckets.open === 'function') {
    try {
      const bucketName = StorageBucketNames[partition];
      const bucket = await storageBuckets.open(bucketName);
      if (bucket?.indexedDB && typeof bucket.indexedDB.open === 'function') {
        _bucketMode = true;
        return { partition, bucketName, bucketed: true, name, factory: bucket.indexedDB };
      }
    } catch {
      // Fall through to the legacy origin IndexedDB so storage remains usable.
    }
  }

  if (!globalFactory) {
    throw new Error('IndexedDB is not available in this context');
  }
  if (_bucketMode !== true) _bucketMode = false;
  return { partition, bucketName: null, bucketed: false, name, factory: globalFactory };
}

export async function isStorageBucketPartitioningActive(): Promise<boolean> {
  if (!hasStorageBucketsAPI()) {
    _bucketMode = false;
    return false;
  }
  if (_bucketMode !== null) return _bucketMode;
  if (!_bucketModeProbe) {
    _bucketModeProbe = resolveOpenTarget('scripts', DB_NAME)
      .then((target) => target.bucketed)
      .catch(() => false)
      .finally(() => {
        _bucketModeProbe = null;
      });
  }
  _bucketMode = await _bucketModeProbe;
  return _bucketMode;
}

export async function openDB(options: OpenOptions = {}): Promise<IDBDatabase> {
  const partition = options.partition ?? 'scripts';
  const state = connectionFor(partition);
  const name = options.name ?? DB_NAME;
  const version = options.version ?? DB_VERSION;

  if (state.db && state.name === name) {
    if (state.bucketed) return state.db;
    if (state.factory && state.factory === globalIndexedDBFactory()) return state.db;
  }

  const target = await resolveOpenTarget(partition, name);

  // If the host swapped IDBFactory underneath us (test reset), drop the
  // cached connection so we re-open against the new factory.
  if (state.db && (state.factory !== target.factory || state.name !== name || state.bucketed !== target.bucketed)) {
    try { state.db.close(); } catch { /* ignore */ }
    state.db = null;
    state.factory = null;
    state.name = null;
  }
  if (state.db) return state.db;
  if (state.opening) return state.opening;

  state.opening = new Promise<IDBDatabase>((resolve, reject) => {
    const req = target.factory.open(name, version);

    req.onupgradeneeded = (ev) => {
      const db = req.result;
      const tx = req.transaction;
      if (!tx) return; // Should never happen during onupgradeneeded.
      try {
        options.upgrade?.(db, ev.oldVersion, ev.newVersion ?? version, tx, target);
      } catch (e) {
        try { tx.abort(); } catch { /* ignore */ }
        reject(e);
      }
    };

    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        try { db.close(); } catch { /* ignore */ }
        if (state.db === db) state.db = null;
      };
      db.onclose = () => {
        if (state.db === db) state.db = null;
      };
      resolve(db);
    };

    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
    req.onblocked = () => reject(new Error('IndexedDB open blocked by another connection'));
  });

  try {
    state.db = await state.opening;
    state.factory = target.factory;
    state.name = name;
    state.bucketed = target.bucketed;
    return state.db;
  } finally {
    state.opening = null;
  }
}

export function closeDB(): void {
  for (const state of _connections.values()) {
    if (state.db) {
      try { state.db.close(); } catch { /* ignore */ }
    }
    state.db = null;
    state.opening = null;
    state.factory = null;
    state.name = null;
    state.bucketed = false;
  }
  _bucketMode = null;
  _bucketModeProbe = null;
}

// Test-only helper. In production no caller should ever need to fully wipe
// the database - migrations bump DB_VERSION instead.
export async function deleteDatabase(name: string = DB_NAME): Promise<void> {
  closeDB();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error('deleteDatabase failed'));
    req.onblocked = () => reject(new Error('deleteDatabase blocked'));
  });
}

// ----------------------------------------------------------------------------
// Request-to-promise primitives
// ----------------------------------------------------------------------------

export function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IDB request failed'));
  });
}

export function txComplete(tx: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IDB transaction aborted'));
  });
}

// ----------------------------------------------------------------------------
// Cursor iteration helper
// ----------------------------------------------------------------------------

export function forEachCursor<T = unknown>(
  source: IDBObjectStore | IDBIndex,
  fn: (value: T, key: IDBValidKey, primaryKey: IDBValidKey) => void | Promise<void>,
  range?: IDBKeyRange,
  direction?: IDBCursorDirection,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const req = source.openCursor(range, direction);
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        resolve();
        return;
      }
      try {
        const r = fn(cursor.value as T, cursor.key, cursor.primaryKey);
        if (r && typeof (r as Promise<void>).then === 'function') {
          (r as Promise<void>).then(() => cursor.continue(), reject);
        } else {
          cursor.continue();
        }
      } catch (e) {
        reject(e);
      }
    };
    req.onerror = () => reject(req.error ?? new Error('cursor failed'));
  });
}
