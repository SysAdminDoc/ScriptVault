import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

async function loadFreshQuotaManager() {
  vi.resetModules();
  const mod = await import('../src/modules/quota-manager.ts');
  return mod.QuotaManager;
}

async function loadFreshErrorLog() {
  vi.resetModules();
  return await import('../src/modules/error-log.ts');
}

beforeEach(() => {
  globalThis.__resetStorageMock();
  chrome.storage.local.getBytesInUse.mockResolvedValue(0);
  chrome.permissions.getAll.mockResolvedValue({ permissions: [] });
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

describe('source quota manager module', () => {
  it('counts scripts, GM values, and backups from the real IndexedDB-backed stores', async () => {
    globalThis.ScriptStorage = {
      getAll: vi.fn().mockResolvedValue([
        makeStoredScript('script_alpha', 'Alpha'),
        makeStoredScript('script_beta', 'Beta'),
      ]),
    };
    globalThis.ScriptValues = {
      getAll: vi.fn().mockImplementation(async (scriptId) => (
        scriptId === 'script_alpha' ? { draft: true, theme: 'dark' } : { count: 4 }
      )),
    };
    globalThis.BackupsDAO = {
      list: vi.fn().mockResolvedValue([{ id: 'backup-1', createdAt: 1 }]),
      get: vi.fn().mockResolvedValue({
        id: 'backup-1',
        createdAt: 1,
        data: new Uint8Array(128).buffer,
      }),
    };
    await chrome.storage.local.set({
      userscripts: {
        stale_legacy: makeStoredScript('stale_legacy', 'Stale'),
      },
      values_script_alpha: { draft: true },
      autoBackups: [{ id: 'stale-backup' }],
      settings: { enabled: true },
      miscKey: 'other',
    });

    const QuotaManager = await loadFreshQuotaManager();
    const breakdown = await QuotaManager.getBreakdown();

    expect(breakdown.scripts.count).toBe(2);
    expect(breakdown.scripts.bytes).toBeGreaterThan(0);
    expect(breakdown.scriptValues.count).toBe(3);
    expect(breakdown.scriptValues.bytes).toBeGreaterThan(0);
    expect(breakdown.backups.count).toBe(1);
    expect(breakdown.backups.bytes).toBeGreaterThanOrEqual(128);
    expect(breakdown.settings.count).toBe(1);
    expect(breakdown.other.count).toBe(1);
  });

  it('cleans expired cache, trims logs, and removes analytics/perf data with exact storage updates', async () => {
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

    const QuotaManager = await loadFreshQuotaManager();
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

    const QuotaManager = await loadFreshQuotaManager();
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

    const QuotaManager = await loadFreshQuotaManager();
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

    const QuotaManager = await loadFreshQuotaManager();
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

describe('source error log module', () => {
  it('groups repeated errors, exports them, and clears by script id', async () => {
    const ErrorLog = await loadFreshErrorLog();

    await ErrorLog.log({
      scriptId: 'script_alpha',
      scriptName: 'Alpha',
      error: 'Boom',
      stack: 'stack line 1',
      url: 'https://example.com/app',
      line: 10,
      col: 4,
      context: 'runtime',
    });
    await ErrorLog.logGMError('script_alpha', 'Alpha', 'setValue', new Error('Quota exceeded'));
    await ErrorLog.log({
      scriptId: 'script_alpha',
      scriptName: 'Alpha',
      error: 'Boom',
      stack: 'stack line 2',
    });

    const grouped = await ErrorLog.getGrouped();
    const stats = await ErrorLog.getStats();
    const csv = await ErrorLog.exportCSV({ search: 'alpha' });
    const text = await ErrorLog.exportText({ scriptId: 'script_alpha' });

    expect(grouped[0]).toMatchObject({
      error: 'Boom',
      scriptId: 'script_alpha',
      count: 2,
      sampleStack: 'stack line 2',
    });
    expect(stats.total).toBe(3);
    expect(stats.byScript[0]).toMatchObject({ scriptId: 'script_alpha', count: 3 });
    expect(csv).toContain('script_alpha');
    expect(text).toContain('GM API setValue: Quota exceeded');

    await ErrorLog.clear('script_alpha');
    expect(await ErrorLog.getAll()).toHaveLength(0);
  });

  it('normalizes script execution error payloads from content-world messages', async () => {
    const ErrorLog = await loadFreshErrorLog();

    const record = await ErrorLog.logScriptError('script_beta', 'Beta', {
      error: 'ReferenceError: test is not defined',
      stack: 'stack trace',
      url: 'https://example.com/test',
      lineno: 22,
      colno: 7,
    });

    expect(record).toMatchObject({
      scriptId: 'script_beta',
      scriptName: 'Beta',
      error: 'ReferenceError: test is not defined',
      url: 'https://example.com/test',
      line: 22,
      col: 7,
      context: 'script-execution',
    });
  });
});
