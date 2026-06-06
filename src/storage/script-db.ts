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
  openDB,
  reqToPromise,
  forEachCursor,
  type StoreName,
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
//   indexes: by-script (scriptId)
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
}

export interface BackupRecord {
  id: string;
  name: string;
  createdAt: number;
  byteSize: number;
  data: ArrayBuffer;
  meta?: Record<string, unknown>;
}

export interface LocalWorkspaceBindingRecord {
  bindingId: string;
  scriptId: string;
  handle?: unknown;
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

function upgradeSchema(
  db: IDBDatabase,
  oldVersion: number,
  _newVersion: number,
  _tx: IDBTransaction,
): void {
  if (oldVersion < 1) {
    const scripts = db.createObjectStore(Stores.scripts, { keyPath: 'id' });
    scripts.createIndex('by-enabled', 'enabled', { unique: false });
    scripts.createIndex('by-position', 'position', { unique: false });
    scripts.createIndex('by-namespace', 'meta.namespace', { unique: false });

    const values = db.createObjectStore(Stores.values, {
      keyPath: ['scriptId', 'key'],
    });
    values.createIndex('by-script', 'scriptId', { unique: false });

    db.createObjectStore(Stores.stats, { keyPath: 'scriptId' });

    const backups = db.createObjectStore(Stores.backups, { keyPath: 'id' });
    backups.createIndex('by-created', 'createdAt', { unique: false });
  }
  if (oldVersion < 2 && !db.objectStoreNames.contains(Stores.localWorkspaceBindings)) {
    const bindings = db.createObjectStore(Stores.localWorkspaceBindings, { keyPath: 'bindingId' });
    bindings.createIndex('by-script', 'scriptId', { unique: false });
  }
}

// Single chokepoint that opens the DB with the schema upgrader bound. Every
// caller in this module routes through this so we never accidentally open
// without the upgrade callback.
export async function openScriptDB(): Promise<IDBDatabase> {
  return openDB({ name: DB_NAME, version: DB_VERSION, upgrade: upgradeSchema });
}

// ----------------------------------------------------------------------------
// Scripts DAO
// ----------------------------------------------------------------------------

export const ScriptsDAO = {
  async get(id: string): Promise<Script | null> {
    await openScriptDB();
    return withTransaction(Stores.scripts, 'readonly', async (tx) => {
      const row = await reqToPromise(tx.objectStore(Stores.scripts).get(id));
      return (row as Script | undefined) ?? null;
    });
  },

  async getAll(): Promise<Script[]> {
    await openScriptDB();
    return withTransaction(Stores.scripts, 'readonly', async (tx) => {
      const rows = await reqToPromise(tx.objectStore(Stores.scripts).getAll());
      return (rows as Script[]) ?? [];
    });
  },

  async put(script: Script): Promise<void> {
    await openScriptDB();
    await withTransaction(Stores.scripts, 'readwrite', async (tx) => {
      await reqToPromise(tx.objectStore(Stores.scripts).put(script));
    });
  },

  async delete(id: string): Promise<void> {
    await openScriptDB();
    // Wipe both the script row and any associated values/stats in one txn so
    // a SW kill mid-delete leaves no orphans.
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
    await withTransaction(Stores.scripts, 'readwrite', async (tx) => {
      const store = tx.objectStore(Stores.scripts);
      for (const s of scripts) {
        await reqToPromise(store.put(s));
      }
    });
  },
};

// ----------------------------------------------------------------------------
// Values DAO (GM_getValue/setValue persistence)
// ----------------------------------------------------------------------------

export const ValuesDAO = {
  async get(scriptId: string, key: string): Promise<unknown> {
    await openScriptDB();
    return withTransaction(Stores.values, 'readonly', async (tx) => {
      const row = await reqToPromise(
        tx.objectStore(Stores.values).get([scriptId, key]) as IDBRequest<ScriptValueRow | undefined>,
      );
      return row ? row.value : undefined;
    });
  },

  async set(scriptId: string, key: string, value: unknown): Promise<void> {
    await openScriptDB();
    await withTransaction(Stores.values, 'readwrite', async (tx) => {
      const row: ScriptValueRow = { scriptId, key, value, updatedAt: Date.now() };
      await reqToPromise(tx.objectStore(Stores.values).put(row));
    });
  },

  async delete(scriptId: string, key: string): Promise<void> {
    await openScriptDB();
    await withTransaction(Stores.values, 'readwrite', async (tx) => {
      await reqToPromise(tx.objectStore(Stores.values).delete([scriptId, key]));
    });
  },

  async getAll(scriptId: string): Promise<Record<string, unknown>> {
    await openScriptDB();
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
    await openScriptDB();
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

  async getAllKeyMetadata(scriptId: string): Promise<Record<string, { updatedAt: number }>> {
    await openScriptDB();
    return withTransaction(Stores.values, 'readonly', async (tx) => {
      const out: Record<string, { updatedAt: number }> = {};
      const idx = tx.objectStore(Stores.values).index('by-script');
      await forEachCursor<ScriptValueRow>(idx, (row) => {
        const updatedAt = Number(row.updatedAt);
        if (Number.isFinite(updatedAt) && updatedAt > 0) {
          setRecordKey(out, row.key, { updatedAt: Math.floor(updatedAt) });
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
    await openScriptDB();
    await withTransaction(Stores.values, 'readwrite', async (tx) => {
      const store = tx.objectStore(Stores.values);
      const updatedAt = Date.now();
      for (const [key, value] of Object.entries(values)) {
        await reqToPromise(store.put({ scriptId, key, value, updatedAt } satisfies ScriptValueRow));
      }
    });
  },

  async deleteMultiple(scriptId: string, keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await openScriptDB();
    await withTransaction(Stores.values, 'readwrite', async (tx) => {
      const store = tx.objectStore(Stores.values);
      for (const key of keys) {
        await reqToPromise(store.delete([scriptId, key]));
      }
    });
  },

  async deleteAll(scriptId: string): Promise<void> {
    await openScriptDB();
    await withTransaction(Stores.values, 'readwrite', async (tx) => {
      const store = tx.objectStore(Stores.values);
      const idx = store.index('by-script');
      await forEachCursor<ScriptValueRow>(idx, (_row, _k, primaryKey) => {
        store.delete(primaryKey);
      }, IDBKeyRange.only(scriptId));
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
    await openScriptDB();
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
    await openScriptDB();
    return withTransaction(Stores.backups, 'readonly', async (tx) => {
      const row = await reqToPromise(
        tx.objectStore(Stores.backups).get(id) as IDBRequest<BackupRecord | undefined>,
      );
      return row ?? null;
    });
  },

  async put(record: BackupRecord): Promise<void> {
    await openScriptDB();
    await withTransaction(Stores.backups, 'readwrite', async (tx) => {
      await reqToPromise(tx.objectStore(Stores.backups).put(record));
    });
  },

  async delete(id: string): Promise<void> {
    await openScriptDB();
    await withTransaction(Stores.backups, 'readwrite', async (tx) => {
      await reqToPromise(tx.objectStore(Stores.backups).delete(id));
    });
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
