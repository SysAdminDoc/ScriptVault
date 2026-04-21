import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import { escapeHtml, formatBytes, generateId, sanitizeUrl } from '../src/shared/utils.ts';
import { ScriptAnalyzer } from '../src/bg/analyzer.ts';
import { ResourceCache } from '../src/modules/resources.ts';
import { XhrManager } from '../src/modules/xhr.ts';
import { NpmResolver } from '../src/modules/npm-resolve.ts';
import {
  SettingsManager,
  ScriptStorage,
  ScriptValues,
  FolderStorage,
  TabStorage,
  _openTabTrackers,
} from '../src/modules/storage.ts';

const originalFetch = globalThis.fetch;

function makeScript(overrides = {}) {
  return {
    id: 'script_alpha',
    code: '// ==UserScript==\n// @name Alpha\n// ==/UserScript==',
    enabled: true,
    position: 0,
    meta: {
      name: 'Alpha',
      namespace: 'scriptvault-tests',
      version: '1.0.0',
      description: 'Alpha script',
      author: 'QA',
      icon: '',
      icon64: '',
      homepage: '',
      homepageURL: '',
      website: '',
      source: '',
      updateURL: '',
      downloadURL: '',
      supportURL: '',
      license: 'MIT',
      copyright: '',
      contributionURL: '',
      match: ['https://example.com/*'],
      include: [],
      exclude: [],
      excludeMatch: [],
      'run-at': 'document-idle',
      'inject-into': 'auto',
      noframes: false,
      unwrap: false,
      sandbox: '',
      'run-in': '',
      grant: ['none'],
      require: [],
      resource: {},
      connect: [],
      'top-level-await': false,
      webRequest: null,
      priority: 0,
      antifeature: [],
      tag: [],
      compatible: [],
      incompatible: [],
    },
    settings: {},
    stats: { runs: 0, totalTime: 0, avgTime: 0, lastRun: 0, errors: 0 },
    versionHistory: [],
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

beforeEach(() => {
  globalThis.__resetStorageMock();
  ResourceCache.cache = {};
  XhrManager.requests.clear();
  XhrManager.nextId = 1;
  SettingsManager.cache = null;
  ScriptStorage.cache = null;
  ScriptValues.cache = {};
  ScriptValues.listeners.clear();
  for (const pending of ScriptValues.pendingNotifications.values()) {
    clearTimeout(pending.timeout);
  }
  ScriptValues.pendingNotifications.clear();
  FolderStorage.cache = null;
  TabStorage.data.clear();
  _openTabTrackers.clear();
  globalThis.self?._notifCallbacks?.clear?.();
  chrome.runtime.sendMessage.mockResolvedValue({});
  chrome.offscreen.hasDocument.mockResolvedValue(false);
  chrome.offscreen.createDocument.mockResolvedValue();
  chrome.tabs.query.mockResolvedValue([]);
  chrome.tabs.sendMessage.mockResolvedValue({});
  globalThis.registerAllScripts = vi.fn().mockResolvedValue();
  globalThis.updateBadge = vi.fn().mockResolvedValue();
  globalThis.autoReloadMatchingTabs = vi.fn().mockResolvedValue();
  vi.clearAllMocks();
  vi.useRealTimers();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const pending of ScriptValues.pendingNotifications.values()) {
    clearTimeout(pending.timeout);
  }
  ScriptValues.pendingNotifications.clear();
  ScriptValues.listeners.clear();
  vi.useRealTimers();
});

async function loadFreshPublicAPI() {
  vi.resetModules();
  const mod = await import('../src/modules/public-api.ts');
  return mod.PublicAPI;
}

describe('source utils', () => {
  it('sanitizes and formats values using the actual shared module', () => {
    expect(escapeHtml('<tag "x">')).toBe('&lt;tag &quot;x&quot;&gt;');
    expect(generateId()).toMatch(/^script_/);
    expect(sanitizeUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeUrl('https://example.com/app')).toBe('https://example.com/app');
    expect(sanitizeUrl('//cdn.example.com/lib.js')).toBe('//cdn.example.com/lib.js');
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1024 ** 4)).toBe('1 TB');
  });
});

describe('source analyzer', () => {
  beforeEach(() => {
    // Reset cached offscreen-init promise between cases so each test sees a
    // clean createDocument/hasDocument call count (ScriptAnalyzer memoizes the
    // offscreen document creation in production — good for runtime, bad for
    // isolated assertions).
    ScriptAnalyzer._offscreenPromise = null;
  });

  it('analyzes code via regex fallback when offscreen dispatch fails', async () => {
    chrome.runtime.sendMessage.mockRejectedValue(new Error('offscreen unavailable'));

    const result = await ScriptAnalyzer.analyzeAsync('eval("x"); document.cookie = "a=1";');

    expect(result.astAnalyzed).toBe(false);
    expect(result.totalRisk).toBeGreaterThan(0);
    expect(result.findings.some((finding) => finding.id === 'eval')).toBe(true);
    expect(result.summary).toContain('dynamic code execution');
  });

  it('returns the offscreen result when AST analysis succeeds', async () => {
    chrome.offscreen.hasDocument.mockResolvedValue(false);
    chrome.runtime.sendMessage.mockResolvedValue({
      totalRisk: 0,
      riskLevel: 'minimal',
      findings: [],
      categories: {},
      summary: 'AST analysis complete.',
      astAnalyzed: true,
    });

    const result = await ScriptAnalyzer.analyzeAsync('console.log("ok")');

    expect(chrome.offscreen.createDocument).toHaveBeenCalledTimes(1);
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'offscreen_analyze',
      code: 'console.log("ok")',
    });
    expect(result.astAnalyzed).toBe(true);
    expect(result.summary).toBe('AST analysis complete.');
  });
});

describe('source storage module', () => {
  it('loads, updates, and resets settings through SettingsManager', async () => {
    const defaults = await SettingsManager.get();
    expect(defaults.enabled).toBe(true);
    expect(defaults.layout).toBe('dark');

    await SettingsManager.set({ enabled: false, theme: 'light' });
    expect(await SettingsManager.get('enabled')).toBe(false);
    expect(await SettingsManager.get('theme')).toBe('light');

    const reset = await SettingsManager.reset();
    expect(reset.enabled).toBe(true);
    expect(reset.theme).toBe('dark');
  });

  it('persists, searches, duplicates, reorders, and deletes scripts', async () => {
    const alpha = makeScript();
    const beta = makeScript({
      id: 'script_beta',
      position: 1,
      meta: {
        ...makeScript().meta,
        name: 'Beta',
        description: 'Second script',
      },
    });

    await ScriptStorage.set(alpha.id, alpha);
    await ScriptStorage.set(beta.id, beta);

    const matches = await ScriptStorage.search('beta');
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe('script_beta');

    await ScriptStorage.reorder(['script_beta', 'script_alpha']);
    expect((await ScriptStorage.get('script_beta'))?.position).toBe(0);
    expect((await ScriptStorage.get('script_alpha'))?.position).toBe(1);

    const copy = await ScriptStorage.duplicate('script_alpha');
    expect(copy?.meta.name).toContain('(Copy)');

    await ScriptValues.set('script_alpha', 'draft', true);
    await ScriptStorage.delete('script_alpha');
    expect(await ScriptStorage.get('script_alpha')).toBeNull();
    expect(await chrome.storage.local.remove).toHaveBeenCalledWith('values_script_alpha');
  });

  it('stores values, emits listeners, and manages folders/tab state', async () => {
    vi.useFakeTimers();
    const changes = [];
    ScriptValues.addListener('script_alpha', 'listener', (...args) => changes.push(args));

    await ScriptValues.set('script_alpha', 'count', 1);
    await ScriptValues.setAll('script_alpha', { count: 2, name: 'Alpha' });
    await ScriptValues.deleteMultiple('script_alpha', ['name']);
    vi.runAllTimers();

    expect(await ScriptValues.get('script_alpha', 'count', 0)).toBe(2);
    expect(await ScriptValues.list('script_alpha')).toEqual(['count']);
    expect(changes.length).toBeGreaterThan(0);

    const folder = await FolderStorage.create('Pinned');
    await FolderStorage.addScript(folder.id, 'script_alpha');
    expect(FolderStorage.getFolderForScript('script_alpha')?.name).toBe('Pinned');
    await FolderStorage.moveScript('script_alpha', folder.id, '');
    expect(FolderStorage.getFolderForScript('script_alpha')).toBeNull();

    TabStorage.set(7, { open: true });
    expect(TabStorage.get(7)).toEqual({ open: true });
    TabStorage.delete(7);
    expect(TabStorage.get(7)).toEqual({});
  });
});

describe('source resource cache module', () => {
  it('fetches, caches, and returns resource data URIs', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('window.cached = true;', {
        status: 200,
        headers: { 'content-type': 'text/javascript' },
      }),
    );
    globalThis.fetch = fetchMock;

    const url = 'https://cdn.example.com/cache.js';
    const text = await ResourceCache.fetchResource(url);
    const dataUri = await ResourceCache.getDataUri(url);
    const secondRead = await ResourceCache.fetchResource(url);

    expect(text).toContain('window.cached');
    expect(secondRead).toBe(text);
    expect(dataUri).toContain('data:text/javascript;base64,');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('prefetches multiple resources without failing the whole batch', async () => {
    const fetchMock = vi.fn((url) => {
      if (String(url).includes('missing')) {
        return Promise.reject(new Error('network down'));
      }
      return Promise.resolve(new Response('ok', {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      }));
    });
    globalThis.fetch = fetchMock;

    await expect(ResourceCache.prefetchResources({
      good: 'https://example.com/good.txt',
      bad: 'https://example.com/missing.txt',
    })).resolves.toBeUndefined();

    expect(ResourceCache.cache['https://example.com/good.txt']?.text).toBe('ok');
  });
});

describe('source xhr manager module', () => {
  it('tracks and aborts requests by script and tab', () => {
    const first = XhrManager.create(1, 'script_alpha', { url: 'https://a.example' });
    const second = XhrManager.create(1, 'script_beta', { url: 'https://b.example' });
    const third = XhrManager.create(2, 'script_alpha', { url: 'https://c.example' });

    first.controller = { abort: vi.fn() };
    third.controller = { abort: vi.fn() };

    expect(XhrManager.getActiveCount()).toBe(3);
    expect(XhrManager.abort(first.id)).toBe(true);

    XhrManager.abortByScript('script_alpha');
    expect(XhrManager.get(first.id)).toBeUndefined();
    expect(XhrManager.get(third.id)).toBeUndefined();
    expect(XhrManager.get(second.id)).toBeTruthy();

    XhrManager.abortByTab(1);
    expect(XhrManager.getActiveCount()).toBe(0);
  });
});

describe('source npm resolver module', () => {
  it('resolves and caches npm requires using the real source module', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('console.log("lodash ready");', {
        status: 200,
        headers: { 'content-type': 'text/javascript' },
      }),
    );
    globalThis.fetch = fetchMock;

    const first = await NpmResolver.resolve('npm:lodash@4.17.21');
    const second = await NpmResolver.resolve('npm:lodash@4.17.21');

    expect(first.url).toContain('lodash@4.17.21');
    expect(first.integrity).toMatch(/^sha256-/);
    expect(second.url).toBe(first.url);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('parses scoped specs and rejects invalid package names', () => {
    expect(NpmResolver._parseSpec('npm:@types/node@24.0.0')).toEqual({
      name: '@types/node',
      version: '24.0.0',
    });
    expect(() => NpmResolver._sanitizePackageName('../oops')).toThrow();
  });
});

describe('source public api module', () => {
  it('lists installed scripts from the real object-map storage shape', async () => {
    await chrome.storage.local.set({
      userscripts: {
        script_alpha: makeScript(),
      },
    });

    const PublicAPI = await loadFreshPublicAPI();
    const result = await PublicAPI.handleExternalMessage({ action: 'getInstalledScripts' }, { id: 'ext-test' });

    expect(result.scripts).toHaveLength(1);
    expect(result.scripts[0]).toMatchObject({
      id: 'script_alpha',
      name: 'Alpha',
      version: '1.0.0',
      enabled: true,
    });
  });

  it('toggles scripts in object-map storage without corrupting the record shape', async () => {
    await chrome.storage.local.set({
      userscripts: {
        script_alpha: makeScript(),
      },
    });

    const PublicAPI = await loadFreshPublicAPI();
    await PublicAPI.setPermissions({ toggleScript: 'allow' });
    const result = await PublicAPI.handleExternalMessage(
      { action: 'toggleScript', scriptId: 'script_alpha', enabled: false },
      { id: 'ext-test' },
    );
    const stored = await chrome.storage.local.get('userscripts');

    expect(result.ok).toBe(true);
    expect(stored.userscripts.script_alpha.enabled).toBe(false);
    expect(stored.userscripts.script_alpha.meta.name).toBe('Alpha');
    expect(globalThis.registerAllScripts).toHaveBeenCalledTimes(1);
    expect(globalThis.updateBadge).toHaveBeenCalledTimes(1);
    expect(globalThis.autoReloadMatchingTabs).not.toHaveBeenCalled();
  });

  it('installs new scripts into object-map storage with nested metadata', async () => {
    await chrome.storage.local.set({ userscripts: {} });

    const PublicAPI = await loadFreshPublicAPI();
    await PublicAPI.setPermissions({ installScript: 'allow' });
    const result = await PublicAPI.handleExternalMessage(
      {
        action: 'installScript',
        code: [
          '// ==UserScript==',
          '// @name Script Beta',
          '// @version 2.1.0',
          '// @description Installed through API',
          '// @match https://example.com/*',
          '// ==/UserScript==',
          'console.log("beta");',
        ].join('\n'),
      },
      { id: 'ext-test' },
    );
    const stored = await chrome.storage.local.get('userscripts');

    expect(result.ok).toBe(true);
    expect(stored.userscripts.script_beta.meta.name).toBe('Script Beta');
    expect(stored.userscripts.script_beta.meta.version).toBe('2.1.0');
    expect(stored.userscripts.script_beta.meta.match).toEqual(['https://example.com/*']);
    expect(stored.userscripts.script_beta.code).toContain('console.log("beta")');
    expect(globalThis.registerAllScripts).toHaveBeenCalledTimes(1);
    expect(globalThis.updateBadge).toHaveBeenCalledTimes(1);
    expect(globalThis.autoReloadMatchingTabs).toHaveBeenCalledWith(expect.objectContaining({
      id: 'script_beta',
      name: 'Script Beta',
      meta: expect.objectContaining({
        match: ['https://example.com/*'],
      }),
    }));
  });
});
