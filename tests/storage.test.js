import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// storage.js is generated as a script-mode runtime artifact, so tests eval it
// in the same global shape background.js uses rather than importing it as ESM.
const storageCode = readFileSync(resolve(__dirname, '../modules/storage.js'), 'utf8');

const fn = new Function('chrome', 'console', storageCode + `
  return {
    SettingsManager,
    ScriptStorage,
    LocalWorkspaceBindings,
    ScriptValues,
    FolderStorage,
    TabStorage,
    _openTabTrackers,
    setScriptChangeListener
  };
`);

const {
  SettingsManager,
  ScriptStorage,
  LocalWorkspaceBindings,
  ScriptValues,
  FolderStorage,
  TabStorage,
  _openTabTrackers,
  setScriptChangeListener,
} = fn(globalThis.chrome, console);

function resetRuntimeCaches() {
  SettingsManager.cache = null;
  ScriptStorage.cache = null;
  ScriptValues.cache = Object.create(null);
  ScriptValues.listeners.clear();
  ScriptValues._initPromises?.clear?.();
  for (const pending of ScriptValues.pendingNotifications.values()) {
    clearTimeout(pending.timeout);
  }
  ScriptValues.pendingNotifications.clear();
  FolderStorage.cache = null;
  TabStorage.data.clear();
  _openTabTrackers.clear();
  setScriptChangeListener(null);
}

beforeEach(() => {
  globalThis.__resetStorageMock();
  resetRuntimeCaches();
  vi.clearAllMocks();
  vi.useRealTimers();
});

afterEach(() => {
  resetRuntimeCaches();
  vi.useRealTimers();
});

function makeScript(id = 'test1', overrides = {}) {
  return {
    id,
    code: '// test',
    meta: { name: 'Test Script', namespace: 'tests', version: '1.0' },
    enabled: true,
    position: 0,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe('generated storage artifact', () => {
  it('is generated from the TypeScript storage source', () => {
    expect(storageCode).toContain('Generated from src/modules/storage.ts');
    expect(storageCode).toContain('const StorageModule = (() => {');
    expect(storageCode).toContain('const SettingsManager = StorageModule.SettingsManager;');
    expect(storageCode).toContain('const ScriptStorage = StorageModule.ScriptStorage;');
    expect(storageCode).toContain('const LocalWorkspaceBindings = StorageModule.LocalWorkspaceBindings;');
  });

  it('does not register duplicate notification click/close listeners', () => {
    expect(storageCode).not.toContain('chrome.notifications.onClicked.addListener');
    expect(storageCode).not.toContain('chrome.notifications.onClosed.addListener');
  });
});

describe('SettingsManager', () => {
  it('initializes with shared defaults when no settings are stored', async () => {
    const settings = await SettingsManager.get();

    expect(settings.enabled).toBe(true);
    expect(settings.theme).toBe('dark');
    expect(settings.autoUpdate).toBe(true);
    expect(settings.layout).toBe('dark');
    expect(settings.trashMode).toBe('30');
    expect(settings.experimentalESMUserscripts).toBe(false);
    expect(settings.dashboardVirtualizationThreshold).toBe(500);
    expect(settings.allowInternalXhr).toBe(false);
    expect(settings.allowInternalSyncEndpoints).toBe(false);
    expect(settings.allowHighPrivilegeScriptApis).toBe(false);
    expect(settings.modifyCSP).toBe('auto');
  });

  it('merges stored settings with defaults', async () => {
    await chrome.storage.local.set({ settings: { theme: 'oled', customKey: 'test' } });

    const settings = await SettingsManager.get();

    expect(settings.theme).toBe('oled');
    expect(settings.customKey).toBe('test');
    expect(settings.enabled).toBe(true);
  });

  it('returns isolated full and keyed settings snapshots', async () => {
    const settings = await SettingsManager.get();
    settings.deniedHosts.push('mutated.example');
    settings.trustedSigningKeys.demo = { name: 'Demo', addedAt: 1 };

    expect((await SettingsManager.get()).deniedHosts).toEqual([]);
    expect((await SettingsManager.get()).trustedSigningKeys).toEqual({});

    const deniedHosts = await SettingsManager.get('deniedHosts');
    deniedHosts.push('blocked.example');
    expect(await SettingsManager.get('deniedHosts')).toEqual([]);
  });

  it('sets single and bulk values, cloning caller-owned objects', async () => {
    const deniedHosts = ['blocked.example'];

    await SettingsManager.set('theme', 'catppuccin');
    await SettingsManager.set({ debugMode: true, deniedHosts });
    deniedHosts.push('caller-mutated');

    expect(await SettingsManager.get('theme')).toBe('catppuccin');
    expect(await SettingsManager.get('debugMode')).toBe(true);
    expect(await SettingsManager.get('deniedHosts')).toEqual(['blocked.example']);
  });

  it('rolls back cache on failed set/reset persistence', async () => {
    await SettingsManager.set({ theme: 'oled', debugMode: false });

    chrome.storage.local.set.mockRejectedValueOnce(new Error('QUOTA'));
    await expect(SettingsManager.set({ theme: 'light', debugMode: true })).rejects.toThrow('QUOTA');
    expect(await SettingsManager.get('theme')).toBe('oled');
    expect(await SettingsManager.get('debugMode')).toBe(false);

    chrome.storage.local.set.mockRejectedValueOnce(new Error('QUOTA'));
    await expect(SettingsManager.reset()).rejects.toThrow('QUOTA');
    expect(await SettingsManager.get('theme')).toBe('oled');
  });

  it('reset() restores fresh nested defaults', async () => {
    await SettingsManager.set({ theme: 'oled', deniedHosts: ['blocked.example'] });
    const reset = await SettingsManager.reset();
    reset.deniedHosts.push('mutated.example');

    expect(await SettingsManager.get('theme')).toBe('dark');
    expect(await SettingsManager.get('deniedHosts')).toEqual([]);
  });

  it('serializes concurrent cold-start callers', async () => {
    await Promise.all([
      SettingsManager.init(),
      SettingsManager.init(),
      SettingsManager.init(),
      SettingsManager.init(),
      SettingsManager.init(),
    ]);

    expect(chrome.storage.local.get).toHaveBeenCalledTimes(1);
  });
});

describe('ScriptStorage', () => {
  it('initializes empty when no scripts are stored', async () => {
    await expect(ScriptStorage.getAll()).resolves.toEqual([]);
  });

  it('migrates legacy chrome.storage scripts and values into IndexedDB', async () => {
    const alpha = makeScript('alpha', { code: 'const a = "legacy";' });
    await chrome.storage.local.set({
      userscripts: { alpha },
      values_alpha: { count: 7, nested: { ok: true } },
    });

    expect(await ScriptStorage.get('alpha')).toEqual(alpha);
    expect(await ScriptValues.get('alpha', 'count', 0)).toBe(7);
    expect(await ScriptValues.get('alpha', 'nested', null)).toEqual({ ok: true });

    const legacy = await chrome.storage.local.get(['userscripts', 'values_alpha', '_storageSchema', '_v2LegacyTombstone']);
    expect(legacy.userscripts.alpha).toEqual(alpha);
    expect(legacy.values_alpha).toEqual({ count: 7, nested: { ok: true } });
    expect(legacy._storageSchema).toBe(3);
    expect(legacy._v2LegacyTombstone.scriptsMigrated).toBe(1);
    expect(legacy._v2LegacyTombstone.valuesMigrated).toBe(2);
  });

  it('stores, retrieves, searches, duplicates, and reorders scripts', async () => {
    const alpha = makeScript('alpha', { meta: { name: 'Alpha', namespace: 'tests', version: '1.0' } });
    const beta = makeScript('beta', {
      position: 1,
      meta: { name: 'Beta', namespace: 'tests', version: '1.0', description: 'Second script' },
    });

    await ScriptStorage.set(alpha.id, alpha);
    await ScriptStorage.set(beta.id, beta);

    expect(await ScriptStorage.get('missing')).toBeNull();
    expect(await ScriptStorage.getAll()).toHaveLength(2);
    expect((await ScriptStorage.search('beta')).map((script) => script.id)).toEqual(['beta']);
    expect((await ScriptStorage.getByNamespace('tests')).map((script) => script.id).sort()).toEqual(['alpha', 'beta']);

    await ScriptStorage.reorder(['beta', 'alpha']);
    expect((await ScriptStorage.get('beta')).position).toBe(0);
    expect((await ScriptStorage.get('alpha')).position).toBe(1);

    const copy = await ScriptStorage.duplicate('alpha');
    expect(copy.id).not.toBe('alpha');
    expect(copy.meta.name).toBe('Alpha (Copy)');
  });

  it('deletes scripts and their value bags atomically through IndexedDB', async () => {
    const script = makeScript('alpha');

    await ScriptStorage.set(script.id, script);
    await ScriptValues.set(script.id, 'draft', true);
    await LocalWorkspaceBindings.put({
      bindingId: 'binding_alpha',
      scriptId: script.id,
      handle: { kind: 'file', name: 'alpha.user.js' },
      displayName: 'alpha.user.js',
      permissionState: 'granted',
      createdAt: 1,
      updatedAt: 1,
    });
    await ScriptStorage.delete(script.id);

    expect(await ScriptStorage.get(script.id)).toBeNull();
    expect(await ScriptValues.get(script.id, 'draft', false)).toBe(false);
    expect(await LocalWorkspaceBindings.getByScript(script.id)).toEqual([]);
  });

  it('clear() removes scripts and all stored values', async () => {
    await ScriptStorage.set('alpha', makeScript('alpha'));
    await ScriptStorage.set('beta', makeScript('beta'));
    await ScriptValues.set('alpha', 'draft', true);
    await ScriptValues.set('beta', 'count', 2);
    await LocalWorkspaceBindings.put({
      bindingId: 'binding_alpha',
      scriptId: 'alpha',
      handle: { kind: 'file', name: 'alpha.user.js' },
      displayName: 'alpha.user.js',
      createdAt: 1,
      updatedAt: 1,
    });

    await ScriptStorage.clear();

    expect(await ScriptStorage.getAll()).toEqual([]);
    expect(await ScriptValues.get('alpha', 'draft', false)).toBe(false);
    expect(await ScriptValues.get('beta', 'count', 0)).toBe(0);
    expect(await LocalWorkspaceBindings.list()).toEqual([]);
  });

  it('notifies the MatchSet hook after script mutations', async () => {
    const listener = vi.fn();
    setScriptChangeListener(listener);

    await ScriptStorage.set('alpha', makeScript('alpha'));
    await ScriptStorage.delete('alpha');
    await ScriptStorage.set('beta', makeScript('beta'));
    await ScriptStorage.clear();

    expect(listener).toHaveBeenCalledTimes(4);

    setScriptChangeListener(null);
    await ScriptStorage.set('gamma', makeScript('gamma'));
    expect(listener).toHaveBeenCalledTimes(4);
  });
});

describe('LocalWorkspaceBindings', () => {
  it('stores handles locally while returning display-safe summaries', async () => {
    const handle = { kind: 'file', name: 'alpha.user.js', absolutePath: 'C:\\Users\\--\\secret\\alpha.user.js' };

    const summary = await LocalWorkspaceBindings.put({
      bindingId: 'binding_alpha',
      scriptId: 'alpha',
      handle,
      displayName: 'alpha.user.js',
      lastKnownSha256: 'a'.repeat(64),
      lastKnownSize: 128,
      lastKnownModified: 1700000000000,
      permissionState: 'prompt',
      createdAt: 1,
      updatedAt: 1,
      lastRefreshAt: null,
      lastErrorKind: 'permission-prompt',
      lastStatusKind: 'bound',
    });

    expect(summary).toMatchObject({
      bindingId: 'binding_alpha',
      scriptId: 'alpha',
      displayName: 'alpha.user.js',
      lastKnownSize: 128,
      permissionState: 'prompt',
      lastStatusKind: 'bound',
    });
    expect(summary).not.toHaveProperty('handle');
    expect(summary).not.toHaveProperty('absolutePath');
    expect(await LocalWorkspaceBindings.getHandle('binding_alpha')).toEqual(handle);

    const byScript = await LocalWorkspaceBindings.getByScript('alpha');
    expect(byScript).toHaveLength(1);
    expect(byScript[0]).not.toHaveProperty('handle');
  });

  it('deletes local bindings independently from script records', async () => {
    await ScriptStorage.set('alpha', makeScript('alpha'));
    await LocalWorkspaceBindings.put({
      bindingId: 'binding_alpha',
      scriptId: 'alpha',
      handle: { kind: 'file', name: 'alpha.user.js' },
      displayName: 'alpha.user.js',
      createdAt: 1,
      updatedAt: 1,
    });

    await LocalWorkspaceBindings.delete('binding_alpha');

    expect(await LocalWorkspaceBindings.get('binding_alpha')).toBeNull();
    expect(await ScriptStorage.get('alpha')).toMatchObject({ id: 'alpha' });
  });
});

describe('ScriptValues', () => {
  it('stores, lists, reads, and deletes values', async () => {
    await ScriptValues.set('s1', 'count', 1);
    await ScriptValues.setAll('s1', { count: 2, name: 'Alpha' });

    expect(await ScriptValues.get('s1', 'count', 0)).toBe(2);
    expect((await ScriptValues.list('s1')).sort()).toEqual(['count', 'name']);
    expect(await ScriptValues.getAll('s1')).toEqual({ count: 2, name: 'Alpha' });

    await ScriptValues.deleteMultiple('s1', ['name', 'missing']);
    expect(await ScriptValues.getAll('s1')).toEqual({ count: 2 });

    await ScriptValues.delete('s1', 'count');
    expect(await ScriptValues.get('s1', 'count', 'DEFAULT')).toBe('DEFAULT');

    await ScriptValues.set('s1', 'draft', true);
    await ScriptValues.deleteAll('s1');
    expect(await ScriptValues.get('s1', 'draft', false)).toBe(false);
  });

  it('tracks aggregate value metadata for future sync bundles', async () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1000);
    try {
      await ScriptValues.set('s1', 'count', 1);
      nowSpy.mockReturnValue(2000);
      await ScriptValues.setAll('s1', { count: 2, name: 'Alpha' });

      expect(await ScriptValues.getAllMetadata('s1')).toEqual({
        valueCount: 2,
        lastUpdatedAt: 2000,
      });
      expect(await ScriptValues.getAllKeyMetadata('s1')).toEqual({
        count: { updatedAt: 2000 },
        name: { updatedAt: 2000 },
      });
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('isolates object values at set/get/getAll boundaries', async () => {
    const value = { nested: { items: ['saved'] } };
    const returned = await ScriptValues.set('s1', 'prefs', value);
    value.nested.items.push('caller-mutated');
    returned.nested.items.push('return-mutated');

    const firstRead = await ScriptValues.get('s1', 'prefs', null);
    expect(firstRead).toEqual({ nested: { items: ['saved'] } });

    firstRead.nested.items.push('read-mutated');
    expect(await ScriptValues.get('s1', 'prefs', null)).toEqual({ nested: { items: ['saved'] } });

    const all = await ScriptValues.getAll('s1');
    all.prefs.nested.items.push('getAll-mutated');
    expect(await ScriptValues.get('s1', 'prefs', null)).toEqual({ nested: { items: ['saved'] } });
  });

  it('stores prototype-shaped names and script IDs as data keys', async () => {
    await ScriptValues.setAll('s1', {
      __proto__: { polluted: true },
      constructor: 'ctor-value',
      prototype: 'prototype-value',
    });
    await ScriptValues.set('s1', '__proto__', { polluted: false });

    expect(await ScriptValues.get('s1', '__proto__', null)).toEqual({ polluted: false });
    expect(await ScriptValues.get('s1', 'constructor', null)).toBe('ctor-value');
    expect(Object.getPrototypeOf(ScriptValues.cache.s1)).toBeNull();
    expect(Object.hasOwn(ScriptValues.cache.s1, '__proto__')).toBe(true);

    await ScriptValues.set('__proto__', 'draft', true);
    expect(Object.hasOwn(ScriptValues.cache, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(ScriptValues.cache.__proto__)).toBeNull();
    expect(await ScriptValues.get('__proto__', 'draft', false)).toBe(true);
  });

  it('emits debounced local and tab value-change notifications', async () => {
    const changes = [];
    ScriptValues.addListener('s1', 'listener', (...args) => changes.push(args));
    chrome.tabs.query.mockResolvedValue([{ id: 10 }, { id: 11 }]);

    await ScriptValues.set('s1', 'count', 1, 10);
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(changes).toEqual([['count', undefined, 1, false]]);
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(10, {
      action: 'valueChanged',
      data: { scriptId: 's1', key: 'count', oldValue: undefined, newValue: 1, remote: false },
    });
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(11, {
      action: 'valueChanged',
      data: { scriptId: 's1', key: 'count', oldValue: undefined, newValue: 1, remote: true },
    });
  });

  it('reports UTF-8 storage size', async () => {
    await ScriptValues.setAll('s1', { ascii: 'abc', unicode: '✓' });

    expect(await ScriptValues.getStorageSize('s1')).toBe(new TextEncoder().encode(JSON.stringify({
      ascii: 'abc',
      unicode: '✓',
    })).length);
  });
});

describe('FolderStorage and TabStorage', () => {
  it('creates, updates, deletes, and moves folder membership', async () => {
    const folder = await FolderStorage.create('Pinned', '#ff0000');

    expect(folder.name).toBe('Pinned');
    expect(folder.scriptIds).toEqual([]);

    await FolderStorage.addScript(folder.id, 'script1');
    await FolderStorage.addScript(folder.id, 'script1');
    expect(FolderStorage.getFolderForScript('script1').id).toBe(folder.id);
    expect(FolderStorage.getFolderForScript('script1').scriptIds).toEqual(['script1']);

    await FolderStorage.update(folder.id, { name: 'Updated', collapsed: true });
    expect(FolderStorage.getFolderForScript('script1').name).toBe('Updated');
    expect(FolderStorage.getFolderForScript('script1').collapsed).toBe(true);

    const second = await FolderStorage.create('Second');
    await FolderStorage.moveScript('script1', folder.id, second.id);
    expect(FolderStorage.getFolderForScript('script1').id).toBe(second.id);

    await FolderStorage.removeScript(second.id, 'script1');
    expect(FolderStorage.getFolderForScript('script1')).toBeNull();

    await FolderStorage.delete(folder.id);
    expect((await FolderStorage.getAll()).some((item) => item.id === folder.id)).toBe(false);
  });

  it('rolls folder cache back on failed persistence', async () => {
    chrome.storage.local.set.mockRejectedValueOnce(new Error('QUOTA'));
    await expect(FolderStorage.create('Unsaved')).rejects.toThrow('QUOTA');
    expect(await FolderStorage.getAll()).toEqual([]);

    const folder = await FolderStorage.create('Original', '#111111');

    chrome.storage.local.set.mockRejectedValueOnce(new Error('QUOTA'));
    await expect(FolderStorage.update(folder.id, { name: 'Changed', color: '#222222' })).rejects.toThrow('QUOTA');
    expect((await FolderStorage.getAll())[0]).toMatchObject({ name: 'Original', color: '#111111' });

    chrome.storage.local.set.mockRejectedValueOnce(new Error('QUOTA'));
    await expect(FolderStorage.addScript(folder.id, 'script1')).rejects.toThrow('QUOTA');
    expect(FolderStorage.getFolderForScript('script1')).toBeNull();

    chrome.storage.local.set.mockRejectedValueOnce(new Error('QUOTA'));
    await expect(FolderStorage.delete(folder.id)).rejects.toThrow('QUOTA');
    expect((await FolderStorage.getAll()).map((item) => item.id)).toEqual([folder.id]);
  });

  it('stores transient per-tab data in memory', () => {
    TabStorage.set(7, { open: true });
    TabStorage.set(8, { open: false });

    expect(TabStorage.get(7)).toEqual({ open: true });
    expect(TabStorage.getAll()).toEqual({ 7: { open: true }, 8: { open: false } });

    TabStorage.delete(7);
    expect(TabStorage.get(7)).toEqual({});
  });
});
