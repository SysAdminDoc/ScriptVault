// ============================================================================
// IndexedDB low-level wrapper
// ----------------------------------------------------------------------------
// Promise-wrapped helpers around the IndexedDB API. Schema upgrades happen in
// `script-db.ts` via `openScriptDB()`; this module is pure plumbing.
// ============================================================================

export const DB_NAME = 'scriptvault';
export const DB_VERSION = 3;

// Object store names (single source of truth — imported by script-db.ts and
// transaction.ts so a typo can't desync the schema).
export const Stores = {
  scripts: 'scripts',
  values: 'values',
  stats: 'stats',
  backups: 'backups',
  localWorkspaceBindings: 'localWorkspaceBindings',
  publicationReceipts: 'publicationReceipts',
} as const;

export type StoreName = (typeof Stores)[keyof typeof Stores];

// ----------------------------------------------------------------------------
// Connection management
// ----------------------------------------------------------------------------
//
// We hold a single IDBDatabase per service-worker lifetime. If a different
// SW context (e.g. a dashboard tab) requests an upgrade, the connection here
// receives `versionchange` and closes cleanly so the upgrade can proceed.

let _db: IDBDatabase | null = null;
let _opening: Promise<IDBDatabase> | null = null;
// Track the IDBFactory that produced `_db` so test runners (which swap
// `globalThis.indexedDB` between tests) get a fresh connection automatically.
let _dbFactory: IDBFactory | null = null;

export type SchemaUpgrade = (
  db: IDBDatabase,
  oldVersion: number,
  newVersion: number,
  tx: IDBTransaction,
) => void;

export interface OpenOptions {
  name?: string;
  version?: number;
  upgrade?: SchemaUpgrade;
}

export async function openDB(options: OpenOptions = {}): Promise<IDBDatabase> {
  // If the host swapped IDBFactory underneath us (test reset), drop the
  // cached connection so we re-open against the new factory.
  if (_db && _dbFactory && typeof indexedDB !== 'undefined' && _dbFactory !== indexedDB) {
    try { _db.close(); } catch { /* ignore */ }
    _db = null;
    _dbFactory = null;
  }
  if (_db) return _db;
  if (_opening) return _opening;

  const name = options.name ?? DB_NAME;
  const version = options.version ?? DB_VERSION;

  _opening = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this context'));
      return;
    }
    const req = indexedDB.open(name, version);

    req.onupgradeneeded = (ev) => {
      const db = req.result;
      const tx = req.transaction;
      if (!tx) return; // Should never happen during onupgradeneeded
      try {
        options.upgrade?.(db, ev.oldVersion, ev.newVersion ?? version, tx);
      } catch (e) {
        // Abort the upgrade transaction on schema error so we don't end up
        // with a half-built database.
        try { tx.abort(); } catch { /* ignore */ }
        reject(e);
      }
    };

    req.onsuccess = () => {
      const db = req.result;
      // Another tab/SW asked for a newer schema — close so its upgrade can run.
      db.onversionchange = () => {
        try { db.close(); } catch { /* ignore */ }
        if (_db === db) _db = null;
      };
      // The connection was forcibly closed (quota wipe, user delete) — drop
      // our cached reference so the next openDB() reopens cleanly.
      db.onclose = () => {
        if (_db === db) _db = null;
      };
      resolve(db);
    };

    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
    req.onblocked = () => reject(new Error('IndexedDB open blocked by another connection'));
  });

  try {
    _db = await _opening;
    _dbFactory = typeof indexedDB !== 'undefined' ? indexedDB : null;
    return _db;
  } finally {
    _opening = null;
  }
}

export function closeDB(): void {
  if (_db) {
    try { _db.close(); } catch { /* ignore */ }
    _db = null;
    _dbFactory = null;
  }
}

// Test-only helper. In production no caller should ever need to fully wipe
// the database — migrations bump DB_VERSION instead.
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
