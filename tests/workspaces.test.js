import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const preamble = `
  function generateId() { return 'ws_' + Math.random().toString(36).slice(2, 10); }
  const ScriptStorage = {
    cache: {},
    async getAll() { return Object.values(this.cache); },
    async set(id, data) { this.cache[id] = data; },
    async save() {}
  };
  async function registerAllScripts() {}
  async function updateBadge() {}
`;

let WorkspaceManager;
const _code = readFileSync(resolve(__dirname, '../bg/workspaces.js'), 'utf8');
const _createFn = (() => {
  const body = preamble + _code + '\nreturn { WorkspaceManager, ScriptStorage };';
  try {
    const vm = require('node:vm');
    return vm.compileFunction(body, ['chrome', 'console'], { filename: resolve(__dirname, '../bg/workspaces.js') });
  } catch { return new Function('chrome', 'console', body); }
})();
function createFresh() {
  return _createFn(globalThis.chrome, console);
}

let mods;

beforeEach(() => {
  globalThis.__resetStorageMock();
  mods = createFresh();
  WorkspaceManager = mods.WorkspaceManager;
  vi.clearAllMocks();
});

describe('WorkspaceManager', () => {
  it('getAll returns empty list initially', async () => {
    const result = await WorkspaceManager.getAll();
    expect(result.active).toBeNull();
    expect(result.list).toEqual([]);
  });

  it('create() snapshots script states', async () => {
    mods.ScriptStorage.cache = {
      s1: { id: 's1', enabled: true },
      s2: { id: 's2', enabled: false },
    };
    const ws = await WorkspaceManager.create('Dev Mode');
    expect(ws.name).toBe('Dev Mode');
    expect(ws.id).toBeTruthy();
    expect(ws.snapshot.s1).toBe(true);
    expect(ws.snapshot.s2).toBe(false);
  });

  it('create() rolls back cache when persistence fails', async () => {
    mods.ScriptStorage.cache = { s1: { id: 's1', enabled: true } };
    chrome.storage.local.set.mockRejectedValueOnce(new Error('QUOTA'));

    await expect(WorkspaceManager.create('Unsaved')).rejects.toThrow('QUOTA');

    expect((await WorkspaceManager.getAll()).list).toEqual([]);
  });

  it('getAll returns created workspaces', async () => {
    mods.ScriptStorage.cache = { s1: { id: 's1', enabled: true } };
    await WorkspaceManager.create('WS1');
    await WorkspaceManager.create('WS2');
    const { list } = await WorkspaceManager.getAll();
    expect(list).toHaveLength(2);
  });

  it('delete removes workspace', async () => {
    mods.ScriptStorage.cache = { s1: { id: 's1', enabled: true } };
    const ws = await WorkspaceManager.create('ToDelete');
    const deleted = await WorkspaceManager.delete(ws.id);
    expect(deleted.name).toBe('ToDelete');
    const { list } = await WorkspaceManager.getAll();
    expect(list).toHaveLength(0);
  });

  it('delete returns null for missing workspace', async () => {
    const result = await WorkspaceManager.delete('nonexistent');
    expect(result).toBeNull();
  });

  it('update renames workspace', async () => {
    mods.ScriptStorage.cache = { s1: { id: 's1', enabled: true } };
    const ws = await WorkspaceManager.create('OldName');
    const updated = await WorkspaceManager.update(ws.id, { name: 'NewName' });
    expect(updated.name).toBe('NewName');
  });

  it('update rolls back cache when persistence fails', async () => {
    mods.ScriptStorage.cache = { s1: { id: 's1', enabled: true } };
    const ws = await WorkspaceManager.create('OldName');
    chrome.storage.local.set.mockRejectedValueOnce(new Error('QUOTA'));

    await expect(WorkspaceManager.update(ws.id, { name: 'NewName' })).rejects.toThrow('QUOTA');

    expect((await WorkspaceManager.getAll()).list[0].name).toBe('OldName');
  });

  it('update returns null for missing workspace', async () => {
    const result = await WorkspaceManager.update('nonexistent', { name: 'X' });
    expect(result).toBeNull();
  });

  it('activate applies snapshot to scripts', async () => {
    mods.ScriptStorage.cache = {
      s1: { id: 's1', enabled: true },
      s2: { id: 's2', enabled: true },
    };
    const ws = await WorkspaceManager.create('Minimal');
    // Manually modify snapshot to disable s2
    ws.snapshot.s2 = false;
    await WorkspaceManager.activate(ws.id);
    expect(mods.ScriptStorage.cache.s2.enabled).toBe(false);
  });

  it('activate sets active workspace id', async () => {
    mods.ScriptStorage.cache = { s1: { id: 's1', enabled: true } };
    const ws = await WorkspaceManager.create('Active');
    await WorkspaceManager.activate(ws.id);
    const { active } = await WorkspaceManager.getAll();
    expect(active).toBe(ws.id);
  });

  it('activate rolls back active workspace when persistence fails', async () => {
    mods.ScriptStorage.cache = {
      s1: { id: 's1', enabled: true, updatedAt: 1 },
      s2: { id: 's2', enabled: true, updatedAt: 1 },
    };
    const ws = await WorkspaceManager.create('Active');
    ws.snapshot.s2 = false;
    chrome.storage.local.set.mockRejectedValueOnce(new Error('QUOTA'));

    await expect(WorkspaceManager.activate(ws.id)).rejects.toThrow('QUOTA');

    expect((await WorkspaceManager.getAll()).active).toBeNull();
    expect(mods.ScriptStorage.cache.s2.enabled).toBe(true);
    expect(mods.ScriptStorage.cache.s2.updatedAt).toBe(1);
  });

  it('activate returns error for missing workspace', async () => {
    const result = await WorkspaceManager.activate('nonexistent');
    expect(result.error).toContain('not found');
  });

  it('delete clears active if deleted', async () => {
    mods.ScriptStorage.cache = { s1: { id: 's1', enabled: true } };
    const ws = await WorkspaceManager.create('WS');
    await WorkspaceManager.activate(ws.id);
    await WorkspaceManager.delete(ws.id);
    const { active } = await WorkspaceManager.getAll();
    expect(active).toBeNull();
  });

  it('delete rolls back list and active workspace when persistence fails', async () => {
    mods.ScriptStorage.cache = { s1: { id: 's1', enabled: true } };
    const ws = await WorkspaceManager.create('WS');
    await WorkspaceManager.activate(ws.id);
    chrome.storage.local.set.mockRejectedValueOnce(new Error('QUOTA'));

    await expect(WorkspaceManager.delete(ws.id)).rejects.toThrow('QUOTA');

    const { active, list } = await WorkspaceManager.getAll();
    expect(active).toBe(ws.id);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(ws.id);
  });

  it('save updates existing workspace snapshot', async () => {
    mods.ScriptStorage.cache = { s1: { id: 's1', enabled: true } };
    const ws = await WorkspaceManager.create('WS');
    // Change script state
    mods.ScriptStorage.cache.s1.enabled = false;
    const saved = await WorkspaceManager.save(ws.id);
    expect(saved.snapshot.s1).toBe(false);
  });

  it('save rolls back snapshot when persistence fails', async () => {
    mods.ScriptStorage.cache = { s1: { id: 's1', enabled: true } };
    const ws = await WorkspaceManager.create('WS');
    mods.ScriptStorage.cache.s1.enabled = false;
    chrome.storage.local.set.mockRejectedValueOnce(new Error('QUOTA'));

    await expect(WorkspaceManager.save(ws.id)).rejects.toThrow('QUOTA');

    expect((await WorkspaceManager.getAll()).list[0].snapshot.s1).toBe(true);
  });

  // WORKSPACES-INIT — _initPromise must clear on BOTH success and failure
  // so a subsequent _cache null-out (factory reset, test isolation) gets a
  // fresh storage load. Pre-fix the resolved promise stuck around forever,
  // and any caller after `_cache = null` saw the stale promise and no-op'd.
  describe('WORKSPACES-INIT — _initPromise lifecycle', () => {
    it('clears _initPromise after successful init', async () => {
      await WorkspaceManager.getAll();  // triggers _init
      expect(WorkspaceManager._initPromise).toBeNull();
    });

    it('clears _initPromise after failed init', async () => {
      chrome.storage.local.get.mockRejectedValueOnce(new Error('STORAGE_FAIL'));
      await expect(WorkspaceManager.getAll()).rejects.toThrow('STORAGE_FAIL');
      expect(WorkspaceManager._initPromise).toBeNull();
    });

    it('null-ing _cache forces a real storage reload on the next _init', async () => {
      // Seed storage; cache populates from it.
      chrome.storage.local.set({ workspaces: { active: null, list: [{ id: 'ws1', name: 'First' }] } });
      const r1 = await WorkspaceManager.getAll();
      expect(r1.list).toHaveLength(1);
      expect(r1.list[0].name).toBe('First');

      // Mutate storage out-of-band, null the cache to force a reload.
      chrome.storage.local.set({ workspaces: { active: null, list: [{ id: 'ws2', name: 'Second' }] } });
      WorkspaceManager._cache = null;

      // Pre-fix: this would return the OLD cached value because
      // _initPromise still pointed at a resolved (now stale) promise
      // and short-circuited the storage re-read.
      const r2 = await WorkspaceManager.getAll();
      expect(r2.list).toHaveLength(1);
      expect(r2.list[0].name).toBe('Second');
    });
  });
});
