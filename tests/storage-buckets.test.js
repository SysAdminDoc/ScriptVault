import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

import {
  BackupsDAO,
  LocalWorkspaceBindings,
  ScriptStorage,
  ScriptValues,
} from '../src/modules/storage.ts';
import { closeDB, DB_NAME, StorageBucketNames } from '../src/storage/idb.ts';
import { ValuesDAO } from '../src/storage/script-db.ts';

function makeScript(id = 'alpha', overrides = {}) {
  return {
    id,
    code: '// ==UserScript==\n// @name Alpha\n// ==/UserScript==',
    meta: { name: 'Alpha', namespace: 'tests', version: '1.0.0' },
    enabled: true,
    position: 0,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function resetStorageCaches() {
  closeDB();
  ScriptStorage.cache = null;
  ScriptValues.cache = Object.create(null);
  ScriptValues.listeners.clear();
  ScriptValues._initPromises?.clear?.();
  for (const pending of ScriptValues.pendingNotifications.values()) {
    clearTimeout(pending.timeout);
  }
  ScriptValues.pendingNotifications.clear();
}

function clearStorageBucketsMock() {
  Object.defineProperty(globalThis.navigator, 'storageBuckets', {
    configurable: true,
    value: undefined,
  });
}

function installStorageBucketsMock() {
  const factories = Object.fromEntries(
    Object.values(StorageBucketNames).map((name) => [name, new IDBFactory()]),
  );
  const open = vi.fn(async (name) => ({ indexedDB: factories[name] }));
  Object.defineProperty(globalThis.navigator, 'storageBuckets', {
    configurable: true,
    value: { open },
  });
  return { factories, open };
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function objectStoreNames(factory) {
  const db = await requestToPromise(factory.open(DB_NAME, 3));
  const names = Array.from(db.objectStoreNames).sort();
  db.close();
  return names;
}

beforeEach(() => {
  globalThis.__resetStorageMock();
  resetStorageCaches();
  clearStorageBucketsMock();
});

afterEach(() => {
  resetStorageCaches();
  clearStorageBucketsMock();
});

describe('storage bucket partitioning', () => {
  it('feature-detects Storage Buckets and routes each storage family to its own IndexedDB factory', async () => {
    const { factories, open } = installStorageBucketsMock();

    await ScriptStorage.set('alpha', makeScript('alpha'));
    await ScriptValues.set('alpha', 'draft', true);
    await LocalWorkspaceBindings.put({
      bindingId: 'binding_alpha',
      scriptId: 'alpha',
      handle: { kind: 'file', name: 'alpha.user.js' },
      displayName: 'alpha.user.js',
      createdAt: 1,
      updatedAt: 1,
    });
    await BackupsDAO.put({
      id: 'backup_alpha',
      name: 'backup_alpha',
      createdAt: 2,
      byteSize: 4,
      data: new Uint8Array([1, 2, 3, 4]).buffer,
    });

    expect(open.mock.calls.map(([name]) => name)).toEqual(expect.arrayContaining([
      StorageBucketNames.scripts,
      StorageBucketNames.values,
      StorageBucketNames.backups,
    ]));
    expect(await objectStoreNames(factories[StorageBucketNames.scripts])).toEqual([
      'localWorkspaceBindings',
      'scripts',
      'stats',
    ]);
    expect(await objectStoreNames(factories[StorageBucketNames.values])).toEqual(['values']);
    expect(await objectStoreNames(factories[StorageBucketNames.backups])).toEqual([
      'backups',
      'publicationReceipts',
    ]);

    expect((await ScriptStorage.get('alpha'))?.id).toBe('alpha');
    expect(await ScriptValues.get('alpha', 'draft', false)).toBe(true);
    expect(await LocalWorkspaceBindings.getByScript('alpha')).toHaveLength(1);
    expect((await BackupsDAO.get('backup_alpha'))?.byteSize).toBe(4);
  });

  it('falls back to the legacy single IndexedDB when Storage Buckets are unavailable', async () => {
    await ScriptStorage.set('alpha', makeScript('alpha'));
    await ScriptValues.set('alpha', 'draft', true);
    await BackupsDAO.put({
      id: 'backup_alpha',
      name: 'backup_alpha',
      createdAt: 2,
      byteSize: 4,
      data: new Uint8Array([1, 2, 3, 4]).buffer,
    });

    expect(await objectStoreNames(globalThis.indexedDB)).toEqual([
      'backups',
      'localWorkspaceBindings',
      'publicationReceipts',
      'scripts',
      'stats',
      'values',
    ]);
    expect((await ScriptStorage.get('alpha'))?.id).toBe('alpha');
    expect(await ScriptValues.get('alpha', 'draft', false)).toBe(true);
    expect((await BackupsDAO.get('backup_alpha'))?.byteSize).toBe(4);
  });

  it('keeps delete, backup-restore style overwrites, and sync-merge style value writes working across buckets', async () => {
    installStorageBucketsMock();

    await ScriptStorage.set('alpha', makeScript('alpha', { code: 'old code' }));
    await ScriptValues.setAll('alpha', { token: 'old' });
    await ScriptStorage.delete('alpha');

    expect(await ScriptStorage.get('alpha')).toBeNull();
    expect(await ScriptValues.get('alpha', 'token', null)).toBeNull();

    await ScriptStorage.set('alpha', makeScript('alpha', { code: 'restored code' }));
    await ScriptValues.setAll('alpha', { token: 'restored' });
    expect((await ScriptStorage.get('alpha'))?.code).toBe('restored code');
    expect(await ScriptValues.get('alpha', 'token', null)).toBe('restored');

    await ScriptStorage.set('alpha', makeScript('alpha', {
      code: 'merged code',
      syncBaseCode: 'merged code',
    }));
    await ScriptValues.setAll('alpha', { token: 'remote-merged' });
    expect((await ScriptStorage.get('alpha'))?.syncBaseCode).toBe('merged code');
    expect(await ScriptValues.get('alpha', 'token', null)).toBe('remote-merged');
  });

  it('deletes the script row before best-effort cross-bucket value cleanup', async () => {
    installStorageBucketsMock();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const deleteAllSpy = vi
      .spyOn(ValuesDAO, 'deleteAll')
      .mockRejectedValueOnce(new Error('values bucket unavailable'));

    await ScriptStorage.set('alpha', makeScript('alpha', { code: 'saved code' }));
    await ScriptValues.setAll('alpha', { token: 'recoverable-orphan' });

    await expect(ScriptStorage.delete('alpha')).resolves.toBeUndefined();

    expect(await ScriptStorage.get('alpha')).toBeNull();
    expect(await ScriptValues.get('alpha', 'token', null)).toBe('recoverable-orphan');
    expect(warnSpy).toHaveBeenCalledWith(
      '[ScriptVault] Removed script but could not clean up orphaned GM values:',
      expect.any(Error),
    );

    deleteAllSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
