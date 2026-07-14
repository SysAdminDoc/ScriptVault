import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const code = readFileSync(resolve(process.cwd(), 'modules/quota-manager.js'), 'utf8');
const _body = code + '\nreturn QuotaManager;';
let _compiledFn;
try { const vm = require('node:vm'); _compiledFn = vm.compileFunction(_body, ['chrome', 'console', 'navigator', 'ScriptStorage', 'ScriptValues', 'BackupsDAO'], { filename: resolve(process.cwd(), 'modules/quota-manager.js') }); } catch { _compiledFn = new Function('chrome', 'console', 'navigator', 'ScriptStorage', 'ScriptValues', 'BackupsDAO', _body); }
const originalNavigatorStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis.navigator, 'storage');

function makeStoredScript(id, name) {
  return {
    id,
    code: `// ==UserScript==\n// @name ${name}\n// ==/UserScript==`,
    enabled: true,
    meta: { name, match: ['https://example.com/*'] },
    settings: {},
    stats: { runs: 0, totalTime: 0, avgTime: 0, errors: 0 },
    createdAt: 1,
    updatedAt: 1,
  };
}

function createFreshQuotaManager() {
  return _compiledFn(
    globalThis.chrome,
    console,
    globalThis.navigator,
    globalThis.ScriptStorage,
    globalThis.ScriptValues,
    globalThis.BackupsDAO,
  );
}

let QuotaManager;

beforeEach(() => {
  globalThis.__resetStorageMock();
  chrome.storage.local.getBytesInUse.mockResolvedValue(0);
  chrome.permissions.getAll.mockResolvedValue({ permissions: [] });
  globalThis.ScriptStorage = { getAll: vi.fn().mockResolvedValue([]) };
  globalThis.ScriptValues = { getAll: vi.fn().mockResolvedValue({}) };
  globalThis.BackupsDAO = {
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
  };
  QuotaManager = createFreshQuotaManager();
  vi.clearAllMocks();
});

afterEach(() => {
  if (originalNavigatorStorageDescriptor) {
    Object.defineProperty(globalThis.navigator, 'storage', originalNavigatorStorageDescriptor);
  } else {
    Reflect.deleteProperty(globalThis.navigator, 'storage');
  }
  Reflect.deleteProperty(globalThis, 'ScriptStorage');
  Reflect.deleteProperty(globalThis, 'ScriptValues');
  Reflect.deleteProperty(globalThis, 'BackupsDAO');
});

describe('QuotaManager runtime module', () => {
  it('counts scripts, GM values, and backup blobs from their IndexedDB-backed stores', async () => {
    const scripts = [
      makeStoredScript('script_alpha', 'Alpha'),
      makeStoredScript('script_beta', 'Beta'),
    ];
    globalThis.ScriptStorage.getAll.mockResolvedValue(scripts);
    globalThis.ScriptValues.getAll.mockImplementation(async (scriptId) => (
      scriptId === 'script_alpha' ? { draft: true, theme: 'dark' } : { count: 4 }
    ));
    globalThis.BackupsDAO.list.mockResolvedValue([{ id: 'backup-1', createdAt: 1 }]);
    globalThis.BackupsDAO.get.mockResolvedValue({
      id: 'backup-1',
      createdAt: 1,
      data: new Uint8Array(256).buffer,
    });
    await chrome.storage.local.set({
      userscripts: {
        stale_legacy: makeStoredScript('stale_legacy', 'Stale'),
      },
      values_script_alpha: { draft: true },
      autoBackups: [{ id: 'stale-backup' }],
      settings: { enabled: true },
      miscKey: 'other',
    });

    const breakdown = await QuotaManager.getBreakdown();

    expect(breakdown.scripts.count).toBe(2);
    expect(breakdown.scripts.bytes).toBeGreaterThan(0);
    expect(breakdown.scriptValues.count).toBe(3);
    expect(breakdown.scriptValues.bytes).toBeGreaterThan(0);
    expect(breakdown.backups.count).toBe(1);
    expect(breakdown.backups.bytes).toBeGreaterThanOrEqual(256);
    expect(breakdown.settings.count).toBe(1);
    expect(breakdown.other.count).toBe(1);
  });

  it('measures usage origin-wide (IndexedDB-inclusive) rather than chrome.storage.local only', async () => {
    // Post-v3, scripts/values/backups live in IndexedDB. The origin-wide estimate
    // usage must drive getUsage so the percentage matches the origin-wide quota
    // and autoCleanup's level gate can actually fire.
    Object.defineProperty(globalThis.navigator, 'storage', {
      configurable: true,
      value: {
        estimate: vi.fn().mockResolvedValue({ usage: 9_600_000, quota: 10_000_000 }),
      },
    });
    // chrome.storage.local only sees a tiny slice; it must NOT be the numerator.
    chrome.storage.local.getBytesInUse.mockResolvedValue(1234);

    const usage = await QuotaManager.getUsage();

    expect(usage.bytesUsed).toBe(9_600_000);
    expect(usage.quota).toBe(10_000_000);
    expect(usage.level).toBe('critical');
  });

  it('falls back to chrome.storage.local usage when estimate lacks a usage figure', async () => {
    Object.defineProperty(globalThis.navigator, 'storage', {
      configurable: true,
      value: {
        estimate: vi.fn().mockResolvedValue({ quota: 10_000_000 }),
      },
    });
    chrome.storage.local.getBytesInUse.mockResolvedValue(500);

    const usage = await QuotaManager.getUsage();

    expect(usage.bytesUsed).toBe(500);
    expect(usage.level).toBe('ok');
  });

  it('cleans expired cache, analytics, performance history, and npm cache with exact actions', async () => {
    const now = Date.now();
    await chrome.storage.local.set({
      require_cache_old: { timestamp: now - (8 * 24 * 60 * 60 * 1000), body: 'old require cache' },
      require_cache_keep: { timestamp: now, body: 'fresh require cache' },
      res_cache_old: { timestamp: now - (8 * 24 * 60 * 60 * 1000), body: 'old resource cache' },
      errorLog: Array.from({ length: 205 }, (_, index) => ({ id: String(index), error: `error-${index}` })),
      sv_csp_reports: Array.from({ length: 120 }, (_, index) => ({ id: index })),
      syncTombstones: {
        old_alpha: now - (40 * 24 * 60 * 60 * 1000),
        unsynced_gamma: now - (35 * 24 * 60 * 60 * 1000),
        recent_beta: now - (2 * 24 * 60 * 60 * 1000),
      },
      settings: {
        lastSync: now - (36 * 24 * 60 * 60 * 1000),
      },
      npmCache: { lodash: { code: 'module.exports = {};' } },
      analytics: { events: [1, 2, 3] },
      sv_analytics_daily: { installs: 7 },
      perfHistory: [{ scriptId: 'script_alpha', avg: 25 }],
    });

    const result = await QuotaManager.cleanup({ analytics: true, perfHistory: true, npmCache: true });
    const stored = await chrome.storage.local.get(undefined);

    expect(stored.require_cache_old).toBeUndefined();
    expect(stored.require_cache_keep).toBeTruthy();
    expect(stored.res_cache_old).toBeUndefined();
    expect(stored.errorLog).toHaveLength(200);
    expect(stored.sv_csp_reports).toHaveLength(100);
    expect(stored.syncTombstones).toEqual({
      unsynced_gamma: expect.any(Number),
      recent_beta: expect.any(Number),
    });
    expect(stored.npmCache).toBeUndefined();
    expect(stored.analytics).toBeUndefined();
    expect(stored.sv_analytics_daily).toBeUndefined();
    expect(stored.perfHistory).toBeUndefined();
    expect(result.freedBytes).toBeGreaterThan(0);
    expect(result.actions).toEqual(expect.arrayContaining([
      'Removed 2 expired cache entries',
      'Pruned 5 error log entries',
      'Pruned old CSP reports',
      'Pruned 1 sync tombstones',
      'Cleared npm package cache',
      'Cleared 2 analytics entries',
      'Cleared performance history',
    ]));
  });

  it('merges aggressive cleanup results when auto-cleanup remains critical', async () => {
    Object.defineProperty(globalThis.navigator, 'storage', {
      configurable: true,
      value: {
        estimate: vi.fn().mockResolvedValue({ quota: 1000 }),
      },
    });
    chrome.storage.local.getBytesInUse.mockResolvedValue(980);

    await chrome.storage.local.set({
      errorLog: Array.from({ length: 210 }, (_, index) => ({ id: String(index), error: `boom-${index}` })),
      sv_csp_reports: Array.from({ length: 101 }, (_, index) => ({ id: index })),
      analytics: { events: [1] },
      sv_analytics_daily: { installs: 1 },
      perfHistory: [{ avg: 15 }],
    });

    const result = await QuotaManager.autoCleanup();
    const stored = await chrome.storage.local.get(undefined);

    expect(result).not.toBeNull();
    expect(result.actions).toEqual(expect.arrayContaining([
      'Pruned 10 error log entries',
      'Pruned old CSP reports',
      'Cleared 2 analytics entries',
      'Cleared performance history',
    ]));
    expect(stored.analytics).toBeUndefined();
    expect(stored.sv_analytics_daily).toBeUndefined();
    expect(stored.perfHistory).toBeUndefined();
  });

  it('requests persistent storage once before meaningful writes', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    const persisted = vi.fn().mockResolvedValue(false);
    Object.defineProperty(globalThis.navigator, 'storage', {
      configurable: true,
      value: { persisted, persist },
    });

    const first = await QuotaManager.ensurePersistentStorageForWrite({
      reason: 'script-install',
      bytes: 4096,
    });
    const second = await QuotaManager.ensurePersistentStorageForWrite({
      reason: 'script-update',
      bytes: 8192,
    });
    const stored = await chrome.storage.local.get('sv_storage_persistence');

    expect(first).toMatchObject({
      supported: true,
      requested: true,
      persisted: true,
      granted: true,
      reason: 'script-install',
      bytes: 4096,
    });
    expect(second.reason).toBe('script-install');
    expect(persisted).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(stored.sv_storage_persistence).toMatchObject({ granted: true });
  });

  it('records unsupported persistence APIs without blocking writes', async () => {
    Object.defineProperty(globalThis.navigator, 'storage', {
      configurable: true,
      value: {},
    });

    const status = await QuotaManager.ensurePersistentStorageForWrite({
      reason: 'script-import',
      bytes: 2048,
    });

    expect(status).toMatchObject({
      supported: false,
      requested: true,
      persisted: false,
      granted: false,
      reason: 'script-import',
      error: 'navigator.storage.persist is unavailable',
    });
  });
});
