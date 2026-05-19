import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// storage.js uses global const declarations (not ES modules), so we eval it
const storageCode = readFileSync(resolve(__dirname, '../modules/storage.js'), 'utf8');
const settingsDefaults = JSON.parse(
  readFileSync(resolve(__dirname, '../src/config/settings-defaults.json'), 'utf8')
);

let SettingsManager, ScriptStorage, ScriptValues, FolderStorage;

// Provide dependencies that storage.js expects in global scope
const preamble = `
  const SCRIPTVAULT_SETTINGS_DEFAULTS = ${JSON.stringify(settingsDefaults)};
  function generateId() { return 'id_' + Math.random().toString(36).slice(2, 10); }
  function debugLog() {}
`;
const fn = new Function('chrome', 'console', preamble + storageCode + `
  return { SettingsManager, ScriptStorage, ScriptValues, FolderStorage };
`);
const mods = fn(globalThis.chrome, console);
SettingsManager = mods.SettingsManager;
ScriptStorage = mods.ScriptStorage;
ScriptValues = mods.ScriptValues;
FolderStorage = mods.FolderStorage;

beforeEach(() => {
  globalThis.__resetStorageMock();
  // Reset caches
  SettingsManager.cache = null;
  ScriptStorage.cache = null;
  if (ScriptValues) ScriptValues.cache = {};
  if (FolderStorage) FolderStorage.cache = null;
  vi.clearAllMocks();
});

// ── SettingsManager ──────────────────────────────────────────────────────

describe('SettingsManager', () => {
  it('initializes with defaults when no settings stored', async () => {
    const settings = await SettingsManager.get();
    expect(settings.enabled).toBe(true);
    expect(settings.theme).toBe('dark');
    expect(settings.autoUpdate).toBe(true);
    expect(settings.layout).toBe('dark');
    expect(settings.trashMode).toBe('30');
  });

  it('includes the shared recovery and runtime defaults', async () => {
    const settings = await SettingsManager.get();
    expect(settings.badgeInfo).toBe('running');
    expect(settings.autoReload).toBe(false);
    expect(settings.pageFilterMode).toBe('blacklist');
    expect(settings.blacklistedPages).toBe('');
    expect(settings.whitelistedPages).toBe('');
    expect(settings.deniedHosts).toEqual([]);
    expect(settings.onedriveConnected).toBe(false);
    expect(settings.trustedSigningKeys).toEqual({});
  });

  it('merges stored settings with defaults', async () => {
    chrome.storage.local.set({ settings: { theme: 'oled', customKey: 'test' } });
    const settings = await SettingsManager.get();
    expect(settings.theme).toBe('oled');
    expect(settings.customKey).toBe('test');
    expect(settings.enabled).toBe(true); // default preserved
  });

  it('returns single key value', async () => {
    const theme = await SettingsManager.get('theme');
    expect(theme).toBe('dark');
  });

  it('returns isolated nested settings from get()', async () => {
    const settings = await SettingsManager.get();
    settings.blacklist.push('mutated.example');
    settings.deniedHosts.push('blocked.example');
    settings.trustedSigningKeys.demo = { name: 'Demo', addedAt: 1 };

    const fresh = await SettingsManager.get();
    expect(fresh.blacklist).toEqual([]);
    expect(fresh.deniedHosts).toEqual([]);
    expect(fresh.trustedSigningKeys).toEqual({});
  });

  it('returns isolated nested values from keyed get()', async () => {
    const deniedHosts = await SettingsManager.get('deniedHosts');
    deniedHosts.push('blocked.example');

    expect(await SettingsManager.get('deniedHosts')).toEqual([]);
  });

  it('set() persists to storage', async () => {
    await SettingsManager.set('theme', 'catppuccin');
    expect(chrome.storage.local.set).toHaveBeenCalled();
    const theme = await SettingsManager.get('theme');
    expect(theme).toBe('catppuccin');
  });

  it('set() accepts object for bulk updates', async () => {
    await SettingsManager.set({ theme: 'light', debugMode: true });
    expect(await SettingsManager.get('theme')).toBe('light');
    expect(await SettingsManager.get('debugMode')).toBe(true);
  });

  it('set() returns an isolated settings snapshot', async () => {
    const settings = await SettingsManager.set({ deniedHosts: ['blocked.example'] });
    settings.deniedHosts.push('mutated.example');

    expect(await SettingsManager.get('deniedHosts')).toEqual(['blocked.example']);
  });

  it('set() clones caller-owned nested settings before caching', async () => {
    const deniedHosts = ['blocked.example'];
    await SettingsManager.set({ deniedHosts });
    deniedHosts.push('mutated.example');

    expect(await SettingsManager.get('deniedHosts')).toEqual(['blocked.example']);
  });

  it('set() rolls back cache on persist failure', async () => {
    await SettingsManager.set('theme', 'oled');
    chrome.storage.local.set.mockRejectedValueOnce(new Error('QUOTA'));

    await expect(SettingsManager.set('theme', 'light')).rejects.toThrow('QUOTA');

    expect(await SettingsManager.get('theme')).toBe('oled');
    const persisted = await chrome.storage.local.get('settings');
    expect(persisted.settings.theme).toBe('oled');
  });

  it('bulk set() rolls back cache on persist failure', async () => {
    await SettingsManager.set({ theme: 'oled', debugMode: false });
    chrome.storage.local.set.mockRejectedValueOnce(new Error('QUOTA'));

    await expect(SettingsManager.set({ theme: 'light', debugMode: true })).rejects.toThrow('QUOTA');

    expect(await SettingsManager.get('theme')).toBe('oled');
    expect(await SettingsManager.get('debugMode')).toBe(false);
  });

  it('reset() restores defaults', async () => {
    await SettingsManager.set('theme', 'oled');
    const reset = await SettingsManager.reset();
    reset.deniedHosts.push('mutated.example');
    expect(await SettingsManager.get('theme')).toBe('dark');
    expect(await SettingsManager.get('deniedHosts')).toEqual([]);
  });

  it('reset() rolls back cache on persist failure', async () => {
    await SettingsManager.set('theme', 'oled');
    chrome.storage.local.set.mockRejectedValueOnce(new Error('QUOTA'));

    await expect(SettingsManager.reset()).rejects.toThrow('QUOTA');

    expect(await SettingsManager.get('theme')).toBe('oled');
    const persisted = await chrome.storage.local.get('settings');
    expect(persisted.settings.theme).toBe('oled');
  });

  it('reset() recreates nested default structures', async () => {
    const settings = await SettingsManager.get();
    settings.blacklist.push('example.com');
    settings.deniedHosts.push('blocked.test');
    settings.trustedSigningKeys.demo = { name: 'Demo', addedAt: 1 };
    await SettingsManager.reset();
    const resetSettings = await SettingsManager.get();
    expect(resetSettings.blacklist).toEqual([]);
    expect(resetSettings.deniedHosts).toEqual([]);
    expect(resetSettings.trustedSigningKeys).toEqual({});
  });

  it('init() is idempotent', async () => {
    await SettingsManager.init();
    await SettingsManager.init();
    // get() is called once internally per init, but init guards with cache !== null
    expect(chrome.storage.local.get).toHaveBeenCalledTimes(1);
  });

  it('init() serializes concurrent cold-start callers', async () => {
    // Without the _initPromise gate, two parallel callers both pass the
    // `cache === null` check before either resolves and the second clobbers
    // mutations the first applied. Force the issue by running 5 in parallel
    // and asserting storage.local.get fires exactly once.
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

// ── ScriptStorage ────────────────────────────────────────────────────────

describe('ScriptStorage', () => {
  const mockScript = {
    id: 'test1',
    code: '// test',
    meta: { name: 'Test Script', version: '1.0' },
    enabled: true,
  };

  it('initializes empty when no scripts stored', async () => {
    const all = await ScriptStorage.getAll();
    expect(all).toEqual([]);
  });

  it('set() stores and retrieves a script', async () => {
    await ScriptStorage.set('test1', mockScript);
    const script = await ScriptStorage.get('test1');
    expect(script.meta.name).toBe('Test Script');
  });

  it('getAll() returns array of scripts', async () => {
    await ScriptStorage.set('test1', mockScript);
    await ScriptStorage.set('test2', { ...mockScript, id: 'test2', meta: { name: 'Second' } });
    const all = await ScriptStorage.getAll();
    expect(all).toHaveLength(2);
  });

  it('get() returns null for missing script', async () => {
    const result = await ScriptStorage.get('nonexistent');
    expect(result).toBeNull();
  });

  it('delete() removes script from cache', async () => {
    await ScriptStorage.set('test1', mockScript);
    await ScriptStorage.delete('test1');
    const result = await ScriptStorage.get('test1');
    expect(result).toBeNull();
  });

  it('delete() removes associated script values', async () => {
    await ScriptStorage.set('test1', mockScript);
    await ScriptValues.set('test1', 'draft', true);

    await ScriptStorage.delete('test1');

    expect(await ScriptStorage.get('test1')).toBeNull();
    expect(await ScriptValues.get('test1', 'draft', false)).toBe(false);
    const persisted = await chrome.storage.local.get(['userscripts', 'values_test1']);
    expect(persisted.userscripts).toEqual({});
    expect(persisted.values_test1).toBeUndefined();
  });

  it('delete() restores persisted script state when value cleanup fails', async () => {
    await ScriptStorage.set('test1', mockScript);
    await ScriptValues.set('test1', 'draft', true);

    chrome.storage.local.remove.mockRejectedValueOnce(new Error('REMOVE_FAILED'));
    await expect(ScriptStorage.delete('test1')).rejects.toThrow('REMOVE_FAILED');

    expect(await ScriptStorage.get('test1')).toEqual(mockScript);
    expect(await ScriptValues.get('test1', 'draft', false)).toBe(true);
    const persisted = await chrome.storage.local.get(['userscripts', 'values_test1']);
    expect(persisted.userscripts.test1).toEqual(mockScript);
    expect(persisted.values_test1).toEqual({ draft: true });
  });

  it('clear() removes scripts and their value bags', async () => {
    await ScriptStorage.set('test1', mockScript);
    await ScriptStorage.set('test2', { ...mockScript, id: 'test2', meta: { name: 'Second' } });
    await ScriptValues.set('test1', 'draft', true);
    await ScriptValues.set('test2', 'count', 2);

    await ScriptStorage.clear();

    expect(await ScriptStorage.getAll()).toEqual([]);
    expect(await ScriptValues.get('test1', 'draft', false)).toBe(false);
    expect(await ScriptValues.get('test2', 'count', 0)).toBe(0);
    const persisted = await chrome.storage.local.get(['userscripts', 'values_test1', 'values_test2']);
    expect(persisted.userscripts).toEqual({});
    expect(persisted.values_test1).toBeUndefined();
    expect(persisted.values_test2).toBeUndefined();
  });

  it('clear() restores persisted script state when value cleanup fails', async () => {
    await ScriptStorage.set('test1', mockScript);
    await ScriptValues.set('test1', 'draft', true);

    chrome.storage.local.remove.mockRejectedValueOnce(new Error('REMOVE_FAILED'));
    await expect(ScriptStorage.clear()).rejects.toThrow('REMOVE_FAILED');

    expect(await ScriptStorage.get('test1')).toEqual(mockScript);
    expect(await ScriptValues.get('test1', 'draft', false)).toBe(true);
    const persisted = await chrome.storage.local.get(['userscripts', 'values_test1']);
    expect(persisted.userscripts.test1).toEqual(mockScript);
    expect(persisted.values_test1).toEqual({ draft: true });
  });

  it('set() rolls back cache on persist failure', async () => {
    await ScriptStorage.set('test1', mockScript);
    // Make save fail
    chrome.storage.local.set.mockRejectedValueOnce(new Error('QUOTA_EXCEEDED'));
    await expect(ScriptStorage.set('test1', { ...mockScript, code: 'new code' }))
      .rejects.toThrow('QUOTA_EXCEEDED');
    // Cache should have rolled back to original
    const script = await ScriptStorage.get('test1');
    expect(script.code).toBe('// test');
  });

  it('set() rolls back new script on persist failure', async () => {
    chrome.storage.local.set.mockRejectedValueOnce(new Error('QUOTA_EXCEEDED'));
    await expect(ScriptStorage.set('new1', mockScript))
      .rejects.toThrow('QUOTA_EXCEEDED');
    const result = await ScriptStorage.get('new1');
    expect(result).toBeNull();
  });
});

// ── FolderStorage ────────────────────────────────────────────────────────

describe('FolderStorage', () => {
  it('initializes empty', async () => {
    await FolderStorage.init();
    const all = await FolderStorage.getAll();
    expect(all).toEqual([]);
  });

  it('create() adds a folder', async () => {
    const folder = await FolderStorage.create('Test Folder', '#ff0000');
    expect(folder.name).toBe('Test Folder');
    expect(folder.id).toBeTruthy();
    expect(folder.scriptIds).toEqual([]);
  });

  it('addScript() adds script to folder', async () => {
    const folder = await FolderStorage.create('F1');
    await FolderStorage.addScript(folder.id, 'script1');
    const updated = (await FolderStorage.getAll()).find(f => f.id === folder.id);
    expect(updated.scriptIds).toContain('script1');
  });

  it('addScript() does not duplicate', async () => {
    const folder = await FolderStorage.create('F1');
    await FolderStorage.addScript(folder.id, 'script1');
    await FolderStorage.addScript(folder.id, 'script1');
    const updated = (await FolderStorage.getAll()).find(f => f.id === folder.id);
    expect(updated.scriptIds).toHaveLength(1);
  });

  it('removeScript() removes script from folder', async () => {
    const folder = await FolderStorage.create('F1');
    await FolderStorage.addScript(folder.id, 'script1');
    await FolderStorage.removeScript(folder.id, 'script1');
    const updated = (await FolderStorage.getAll()).find(f => f.id === folder.id);
    expect(updated.scriptIds).not.toContain('script1');
  });

  it('addScript() rolls back on persist failure', async () => {
    const folder = await FolderStorage.create('F1');
    chrome.storage.local.set.mockRejectedValueOnce(new Error('QUOTA'));
    await expect(FolderStorage.addScript(folder.id, 'script1')).rejects.toThrow('QUOTA');
    const updated = (await FolderStorage.getAll()).find(f => f.id === folder.id);
    expect(updated.scriptIds).toEqual([]);
  });

  it('create() rolls back on persist failure', async () => {
    chrome.storage.local.set.mockRejectedValueOnce(new Error('QUOTA'));
    await expect(FolderStorage.create('Unsaved')).rejects.toThrow('QUOTA');
    expect(await FolderStorage.getAll()).toEqual([]);
  });

  it('delete() removes folder', async () => {
    const folder = await FolderStorage.create('F1');
    await FolderStorage.delete(folder.id);
    const all = await FolderStorage.getAll();
    expect(all).toHaveLength(0);
  });

  it('delete() rolls back on persist failure', async () => {
    const folder = await FolderStorage.create('F1');
    chrome.storage.local.set.mockRejectedValueOnce(new Error('QUOTA'));
    await expect(FolderStorage.delete(folder.id)).rejects.toThrow('QUOTA');
    const all = await FolderStorage.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(folder.id);
  });

  it('update() rolls back on persist failure without clobbering other fields', async () => {
    const folder = await FolderStorage.create('Original', '#111111');
    chrome.storage.local.set.mockRejectedValueOnce(new Error('QUOTA'));
    await expect(FolderStorage.update(folder.id, { name: 'Changed', color: '#222222' }))
      .rejects.toThrow('QUOTA');
    const after = (await FolderStorage.getAll()).find(f => f.id === folder.id);
    expect(after.name).toBe('Original');
    expect(after.color).toBe('#111111');
  });
});

// ── ScriptValues rollback (rounds 2+ added rollback to set/delete/setAll) ─
describe('ScriptValues rollback', () => {
  it('isolates object values at set/get boundaries', async () => {
    const value = { nested: { items: ['saved'] } };
    const returned = await ScriptValues.set('s1', 'prefs', value);
    value.nested.items.push('caller-mutated');
    returned.nested.items.push('return-mutated');

    const firstRead = await ScriptValues.get('s1', 'prefs');
    expect(firstRead).toEqual({ nested: { items: ['saved'] } });

    firstRead.nested.items.push('read-mutated');
    expect(await ScriptValues.get('s1', 'prefs')).toEqual({ nested: { items: ['saved'] } });

    const all = await ScriptValues.getAll('s1');
    all.prefs.nested.items.push('getAll-mutated');
    expect(await ScriptValues.get('s1', 'prefs')).toEqual({ nested: { items: ['saved'] } });
  });

  it('isolates object values passed to setAll()', async () => {
    const values = { prefs: { nested: { items: ['saved'] } } };
    await ScriptValues.setAll('s1', values);
    values.prefs.nested.items.push('caller-mutated');

    expect(await ScriptValues.get('s1', 'prefs')).toEqual({ nested: { items: ['saved'] } });
  });

  it('stores prototype-shaped value names as data keys', async () => {
    const values = Object.fromEntries([
      ['__proto__', { polluted: true }],
      ['constructor', 'ctor-value'],
      ['prototype', 'prototype-value'],
    ]);

    await ScriptValues.setAll('s1', values);
    await ScriptValues.set('s1', '__proto__', { polluted: false });

    expect(await ScriptValues.get('s1', '__proto__')).toEqual({ polluted: false });
    expect(await ScriptValues.get('s1', 'constructor')).toBe('ctor-value');
    expect(await ScriptValues.get('s1', 'prototype')).toBe('prototype-value');

    const all = await ScriptValues.getAll('s1');
    expect(Object.hasOwn(all, '__proto__')).toBe(true);
    expect(all.__proto__).toEqual({ polluted: false });
    expect(Object.getPrototypeOf(ScriptValues.cache.s1)).toBeNull();
    expect(Object.hasOwn(ScriptValues.cache.s1, '__proto__')).toBe(true);

    const persisted = await chrome.storage.local.get('values_s1');
    expect(Object.hasOwn(persisted.values_s1, '__proto__')).toBe(true);
    expect(persisted.values_s1.__proto__).toEqual({ polluted: false });

    ScriptValues.cache = {};
    await ScriptValues.init('s1');
    expect(Object.getPrototypeOf(ScriptValues.cache.s1)).toBeNull();
    expect(await ScriptValues.get('s1', '__proto__')).toEqual({ polluted: false });
  });

  it('treats prototype-shaped script IDs as cache keys defensively', async () => {
    await ScriptValues.set('__proto__', 'draft', true);

    expect(Object.hasOwn(ScriptValues.cache, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(ScriptValues.cache.__proto__)).toBeNull();
    expect(await ScriptValues.get('__proto__', 'draft', false)).toBe(true);
  });

  it('set() rolls back cache on persist failure', async () => {
    await ScriptValues.set('s1', 'key', 'original');
    chrome.storage.local.set.mockRejectedValueOnce(new Error('QUOTA'));
    await expect(ScriptValues.set('s1', 'key', 'new'))
      .rejects.toThrow('QUOTA');
    expect(await ScriptValues.get('s1', 'key')).toBe('original');
  });

  it('set() rolls back newly-added key on persist failure', async () => {
    await ScriptValues.init('s1');
    chrome.storage.local.set.mockRejectedValueOnce(new Error('QUOTA'));
    await expect(ScriptValues.set('s1', 'fresh', 'v'))
      .rejects.toThrow('QUOTA');
    expect(await ScriptValues.get('s1', 'fresh', 'DEFAULT')).toBe('DEFAULT');
  });

  it('delete() rolls back on persist failure', async () => {
    await ScriptValues.set('s1', 'key', 'original');
    chrome.storage.local.set.mockRejectedValueOnce(new Error('QUOTA'));
    await expect(ScriptValues.delete('s1', 'key'))
      .rejects.toThrow('QUOTA');
    expect(await ScriptValues.get('s1', 'key')).toBe('original');
  });

  it('setAll() rolls back entire batch on persist failure', async () => {
    await ScriptValues.set('s1', 'a', 1);
    await ScriptValues.set('s1', 'b', 2);
    chrome.storage.local.set.mockRejectedValueOnce(new Error('QUOTA'));
    await expect(ScriptValues.setAll('s1', { a: 99, b: 99, c: 99 }))
      .rejects.toThrow('QUOTA');
    expect(await ScriptValues.get('s1', 'a')).toBe(1);
    expect(await ScriptValues.get('s1', 'b')).toBe(2);
    expect(await ScriptValues.get('s1', 'c', 'MISSING')).toBe('MISSING');
  });

  it('deleteMultiple() rolls back on persist failure', async () => {
    await ScriptValues.set('s1', 'a', 1);
    await ScriptValues.set('s1', 'b', 2);
    chrome.storage.local.set.mockRejectedValueOnce(new Error('QUOTA'));
    await expect(ScriptValues.deleteMultiple('s1', ['a', 'b']))
      .rejects.toThrow('QUOTA');
    expect(await ScriptValues.get('s1', 'a')).toBe(1);
    expect(await ScriptValues.get('s1', 'b')).toBe(2);
  });

  it('deleteAll() keeps the value cache when removal fails', async () => {
    await ScriptValues.set('s1', 'draft', true);
    chrome.storage.local.remove.mockRejectedValueOnce(new Error('QUOTA'));

    await expect(ScriptValues.deleteAll('s1')).rejects.toThrow('QUOTA');

    expect(Object.hasOwn(ScriptValues.cache, 's1')).toBe(true);
    expect(await ScriptValues.get('s1', 'draft', false)).toBe(true);
  });
});
