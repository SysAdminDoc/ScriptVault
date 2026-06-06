import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import {
  classifyInstallSource,
  escapeHtml,
  formatBytes,
  generateId,
  installBrowserNamespaceAlias,
  sanitizeUrl,
} from '../src/shared/utils.ts';
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
import { ScriptsDAO, ValuesDAO } from '../src/storage/script-db.ts';

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
  ResourceCache._pendingFetches?.clear?.();
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
  globalThis.ScriptStorage = ScriptStorage;
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
    expect(sanitizeUrl('\u0000javascript:alert(1)')).toBeNull();
    expect(sanitizeUrl('java\nscript:alert(1)')).toBeNull();
    expect(sanitizeUrl('file:///C:/Users/example/secrets.txt')).toBeNull();
    expect(sanitizeUrl('https://example.com/app')).toBe('https://example.com/app');
    expect(sanitizeUrl('//cdn.example.com/lib.js')).toBe('//cdn.example.com/lib.js');
    expect(classifyInstallSource('https://greasyfork.org/en/scripts/123/foo.user.js')).toMatchObject({ id: 'greasyfork', tone: 'good' });
    expect(classifyInstallSource('not-a-url')).toMatchObject({ id: 'other', tone: 'warn' });
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1024 ** 4)).toBe('1 TB');
  });

  it('maps browser to chrome only for extension-owned globals', () => {
    const chromeApi = { runtime: { id: 'ext-id', sendMessage() {} }, tabs: { query() {} } };
    const root = { chrome: chromeApi };

    const result = installBrowserNamespaceAlias(root);

    expect(result).toEqual({ installed: true, source: 'chrome-alias' });
    expect(root.browser).toBe(chromeApi);
    expect(Object.getOwnPropertyDescriptor(root, 'browser')).toMatchObject({
      enumerable: false,
      writable: false,
      configurable: true,
    });
  });

  it('preserves native browser namespaces and inert page globals', () => {
    const nativeBrowser = { runtime: { id: 'native-browser' } };
    expect(installBrowserNamespaceAlias({
      browser: nativeBrowser,
      chrome: { runtime: { id: 'chrome-api' } },
    })).toEqual({ installed: false, source: 'native-browser' });

    expect(installBrowserNamespaceAlias({ chrome: {} })).toMatchObject({
      installed: false,
      source: 'unavailable',
    });
  });
});

describe('source analyzer', () => {
  beforeEach(() => {
    // Reset cached offscreen-init promise between cases so each test sees a
    // clean createDocument/hasDocument call count (ScriptAnalyzer memoizes the
    // offscreen document creation in production — good for runtime, bad for
    // isolated assertions).
    ScriptAnalyzer._offscreenPromise = null;
    ScriptAnalyzer._inlineLibraryPromises = {};
  });

  it('analyzes code via regex fallback when offscreen dispatch fails', async () => {
    chrome.runtime.sendMessage.mockRejectedValue(new Error('offscreen unavailable'));

    const result = await ScriptAnalyzer.analyzeAsync('eval("x"); document.cookie = "a=1";');

    expect(result.astAnalyzed).toBe(false);
    expect(result.totalRisk).toBeGreaterThan(0);
    expect(result.findings.some((finding) => finding.id === 'eval')).toBe(true);
    expect(result.summary).toContain('dynamic code execution');
  });

  it('keeps URLs intact when stripping comments in the regex fallback', () => {
    const result = ScriptAnalyzer.analyze('const beacon = "https://tracker.example/collect"; fetch(beacon);');

    expect(result.findings.some((finding) => finding.id === 'fetch-call')).toBe(true);
  });

  it('checks all long strings for high entropy in the regex fallback', () => {
    const benign = 'a'.repeat(100);
    const highEntropy = 'Aa1+/Z9qW8eR7tY6uI5oP4sD3fG2hJ1kL0mN9bV8cX7zQ6wE5rT4yU3iO2pA1sD0fG9hJ8kL7zX6cV5bN4mQ3wE2rT1yU0iO9p';
    const result = ScriptAnalyzer.analyze(`const a = "${benign}"; const b = "${highEntropy}";`);

    expect(result.findings.some((finding) => finding.id === 'high-entropy')).toBe(true);
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

  it('runs inline Acorn AST analysis when chrome.offscreen is unavailable', async () => {
    const originalOffscreen = chrome.offscreen;
    const originalAcorn = globalThis.acorn;
    delete chrome.offscreen;
    globalThis.acorn = {
      parse: vi.fn(() => ({
        type: 'Program',
        body: [{
          type: 'ExpressionStatement',
          expression: {
            type: 'CallExpression',
            callee: { type: 'Identifier', name: 'eval' },
            arguments: [],
            loc: { start: { line: 1, column: 0 } },
          },
        }],
      })),
    };

    try {
      const result = await ScriptAnalyzer.analyzeAsync('eval("x");');

      expect(result.astAnalyzed).toBe(true);
      expect(result.findings.some((finding) => finding.id === 'eval')).toBe(true);
      expect(chrome.offscreen).toBeUndefined();
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({
        type: 'offscreen_analyze',
      }));
    } finally {
      chrome.offscreen = originalOffscreen;
      globalThis.acorn = originalAcorn;
    }
  });

  it('parses ESM imports inline when chrome.offscreen is unavailable', async () => {
    const originalOffscreen = chrome.offscreen;
    const originalAcorn = globalThis.acorn;
    const source = 'import value from "https://cdn.example.com/value.js";\nexport default value;';
    delete chrome.offscreen;
    globalThis.acorn = {
      parse: vi.fn(() => ({
        type: 'Program',
        body: [
          {
            type: 'ImportDeclaration',
            start: 0,
            end: source.indexOf('\n'),
            source: { value: 'https://cdn.example.com/value.js' },
            specifiers: [{
              type: 'ImportDefaultSpecifier',
              local: { name: 'value' },
            }],
          },
          {
            type: 'ExportDefaultDeclaration',
            start: source.indexOf('\n') + 1,
            end: source.length,
            declaration: {
              type: 'Identifier',
              name: 'value',
              start: source.lastIndexOf('value'),
              end: source.length - 1,
            },
          },
        ],
      })),
    };

    try {
      const result = await ScriptAnalyzer.analyzeESMImports(source);

      expect(result.error).toBeUndefined();
      expect(result.imports).toEqual([
        expect.objectContaining({
          source: 'https://cdn.example.com/value.js',
          specifiers: [{ kind: 'default', local: 'value' }],
        }),
      ]);
      expect(result.exports[0]).toEqual(expect.objectContaining({ kind: 'default' }));
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({
        type: 'offscreen_esm_imports',
      }));
    } finally {
      chrome.offscreen = originalOffscreen;
      globalThis.acorn = originalAcorn;
    }
  });

  it('merges text inline when chrome.offscreen is unavailable', async () => {
    const originalOffscreen = chrome.offscreen;
    const originalDiff = globalThis.Diff;
    delete chrome.offscreen;
    globalThis.Diff = {
      merge: vi.fn(() => ({ hunks: [] })),
      applyPatch: vi.fn(() => 'merged text'),
      diffLines: vi.fn(() => []),
    };

    try {
      const result = await ScriptAnalyzer.mergeText('base', 'local edit', 'remote edit');

      expect(result).toEqual({ merged: 'merged text', conflicts: false });
      expect(globalThis.Diff.merge).toHaveBeenCalledWith('local edit', 'remote edit', 'base');
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({
        type: 'offscreen_merge',
      }));
    } finally {
      chrome.offscreen = originalOffscreen;
      globalThis.Diff = originalDiff;
    }
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

  it('returns isolated settings snapshots and keyed values', async () => {
    const settings = await SettingsManager.get();
    settings.deniedHosts.push('blocked.example');
    settings.trustedSigningKeys.demo = { name: 'Demo', addedAt: 1 };

    expect((await SettingsManager.get()).deniedHosts).toEqual([]);
    expect((await SettingsManager.get()).trustedSigningKeys).toEqual({});

    const deniedHosts = await SettingsManager.get('deniedHosts');
    deniedHosts.push('blocked.example');
    expect(await SettingsManager.get('deniedHosts')).toEqual([]);

    const returned = await SettingsManager.set({ deniedHosts: ['persisted.example'] });
    returned.deniedHosts.push('mutated.example');
    expect(await SettingsManager.get('deniedHosts')).toEqual(['persisted.example']);

    const callerOwnedHosts = ['caller.example'];
    await SettingsManager.set({ deniedHosts: callerOwnedHosts });
    callerOwnedHosts.push('mutated.example');
    expect(await SettingsManager.get('deniedHosts')).toEqual(['caller.example']);
  });

  it('keeps settings cache consistent when persistence fails', async () => {
    await SettingsManager.set({ enabled: false, theme: 'oled', debugMode: false });

    chrome.storage.local.set.mockRejectedValueOnce(new Error('QUOTA'));
    await expect(SettingsManager.set({ enabled: true, theme: 'light', debugMode: true })).rejects.toThrow('QUOTA');
    expect(await SettingsManager.get('enabled')).toBe(false);
    expect(await SettingsManager.get('theme')).toBe('oled');
    expect(await SettingsManager.get('debugMode')).toBe(false);

    chrome.storage.local.set.mockRejectedValueOnce(new Error('QUOTA'));
    await expect(SettingsManager.reset()).rejects.toThrow('QUOTA');
    expect(await SettingsManager.get('enabled')).toBe(false);
    expect(await SettingsManager.get('theme')).toBe('oled');
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
    // v3.0: values are wiped via the IDB cascade in ScriptsDAO.delete(), not
    // chrome.storage.local.remove. Verify the value bag is gone from IDB.
    expect(await ValuesDAO.getAll('script_alpha')).toEqual({});
  });

  it('stores values, emits listeners, and manages folders/tab state', async () => {
    // Note: we deliberately use real timers here. fake-indexeddb's internal
    // scheduling does not play well with vi.useFakeTimers() — IDB requests
    // would never resolve. We wait out the 100ms notification debounce with
    // a real timer instead.
    const changes = [];
    ScriptValues.addListener('script_alpha', 'listener', (...args) => changes.push(args));

    await ScriptValues.set('script_alpha', 'count', 1);
    await ScriptValues.setAll('script_alpha', { count: 2, name: 'Alpha' });
    await ScriptValues.deleteMultiple('script_alpha', ['name']);
    await new Promise((r) => setTimeout(r, 150));

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

  it('keeps script records and values consistent when delete persistence fails', async () => {
    const script = makeScript();
    await ScriptStorage.set(script.id, script);
    await ScriptValues.set(script.id, 'draft', true);

    // v3.0: simulate an IDB delete failure rather than chrome.storage.set.
    const spy = vi.spyOn(ScriptsDAO, 'delete').mockRejectedValueOnce(new Error('QUOTA'));
    await expect(ScriptStorage.delete(script.id)).rejects.toThrow('QUOTA');
    spy.mockRestore();

    expect(await ScriptStorage.get(script.id)).toEqual(script);
    expect(await ScriptValues.get(script.id, 'draft', false)).toBe(true);
  });

  it('rolls back value batches and folder membership when persistence fails', async () => {
    await ScriptValues.set('script_alpha', 'count', 1);
    await ScriptValues.set('script_alpha', 'name', 'Alpha');

    // v3.0: ValuesDAO.setAll runs every put inside one IDB transaction, so a
    // mid-batch failure aborts everything. We simulate that here.
    const spy = vi.spyOn(ValuesDAO, 'setAll').mockRejectedValueOnce(new Error('QUOTA'));
    await expect(
      ScriptValues.setAll('script_alpha', { count: 2, name: 'Beta', draft: true }),
    ).rejects.toThrow('QUOTA');
    spy.mockRestore();

    expect(await ScriptValues.get('script_alpha', 'count', 0)).toBe(1);
    expect(await ScriptValues.get('script_alpha', 'name', '')).toBe('Alpha');
    expect(await ScriptValues.get('script_alpha', 'draft', false)).toBe(false);

    // FolderStorage still uses chrome.storage.local in v3.0 (folders are a
    // small index that doesn't benefit from IDB), so the original
    // chrome.storage.local.set rejection still exercises that path.
    const folder = await FolderStorage.create('Pinned');
    chrome.storage.local.set.mockRejectedValueOnce(new Error('QUOTA'));
    await expect(FolderStorage.addScript(folder.id, 'script_alpha')).rejects.toThrow('QUOTA');
    expect(FolderStorage.getFolderForScript('script_alpha')).toBeNull();
  });

  it('isolates script value objects at persistence boundaries', async () => {
    const value = { nested: { items: ['saved'] } };
    const returned = await ScriptValues.set('script_alpha', 'prefs', value);
    value.nested.items.push('caller-mutated');
    returned.nested.items.push('return-mutated');

    const firstRead = await ScriptValues.get('script_alpha', 'prefs', null);
    expect(firstRead).toEqual({ nested: { items: ['saved'] } });

    firstRead.nested.items.push('read-mutated');
    expect(await ScriptValues.get('script_alpha', 'prefs', null)).toEqual({ nested: { items: ['saved'] } });

    const all = await ScriptValues.getAll('script_alpha');
    all.prefs.nested.items.push('getAll-mutated');
    expect(await ScriptValues.get('script_alpha', 'prefs', null)).toEqual({ nested: { items: ['saved'] } });

    const values = { prefs: { nested: { items: ['batch'] } } };
    await ScriptValues.setAll('script_alpha', values);
    values.prefs.nested.items.push('caller-mutated');
    expect(await ScriptValues.get('script_alpha', 'prefs', null)).toEqual({ nested: { items: ['batch'] } });
  });

  it('stores prototype-shaped value names as normal data keys', async () => {
    const values = Object.fromEntries([
      ['__proto__', { polluted: true }],
      ['constructor', 'ctor-value'],
      ['prototype', 'prototype-value'],
    ]);

    await ScriptValues.setAll('script_alpha', values);
    await ScriptValues.set('script_alpha', '__proto__', { polluted: false });

    expect(await ScriptValues.get('script_alpha', '__proto__', null)).toEqual({ polluted: false });
    expect(await ScriptValues.get('script_alpha', 'constructor', null)).toBe('ctor-value');
    expect(await ScriptValues.get('script_alpha', 'prototype', null)).toBe('prototype-value');

    const all = await ScriptValues.getAll('script_alpha');
    expect(Object.hasOwn(all, '__proto__')).toBe(true);
    expect(all.__proto__).toEqual({ polluted: false });
    expect(Object.getPrototypeOf(ScriptValues.cache.script_alpha)).toBeNull();

    const stored = await ValuesDAO.getAll('script_alpha');
    expect(Object.hasOwn(stored, '__proto__')).toBe(true);
    expect(stored.__proto__).toEqual({ polluted: false });

    ScriptValues.cache = {};
    await ScriptValues.init('script_alpha');
    expect(Object.getPrototypeOf(ScriptValues.cache.script_alpha)).toBeNull();
    expect(await ScriptValues.get('script_alpha', '__proto__', null)).toEqual({ polluted: false });

    await ScriptValues.deleteMultiple('script_alpha', ['__proto__', 'constructor']);
    expect(await ScriptValues.get('script_alpha', '__proto__', 'DEFAULT')).toBe('DEFAULT');
    expect(await ScriptValues.get('script_alpha', 'constructor', 'DEFAULT')).toBe('DEFAULT');
    expect(Object.hasOwn(await ValuesDAO.getAll('script_alpha'), '__proto__')).toBe(false);
  });

  it('treats prototype-shaped script IDs as value-cache keys defensively', async () => {
    await ScriptValues.set('__proto__', 'draft', true);

    expect(Object.hasOwn(ScriptValues.cache, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(ScriptValues.cache.__proto__)).toBeNull();
    expect(await ScriptValues.get('__proto__', 'draft', false)).toBe(true);
  });

  it('keeps value cache loaded when deleteAll persistence fails', async () => {
    await ScriptValues.set('script_alpha', 'draft', true);

    const spy = vi.spyOn(ValuesDAO, 'deleteAll').mockRejectedValueOnce(new Error('QUOTA'));
    await expect(ScriptValues.deleteAll('script_alpha')).rejects.toThrow('QUOTA');
    spy.mockRestore();

    expect(Object.hasOwn(ScriptValues.cache, 'script_alpha')).toBe(true);
    expect(await ScriptValues.get('script_alpha', 'draft', false)).toBe(true);
  });

  it('rolls back folder create and delete when persistence fails', async () => {
    chrome.storage.local.set.mockRejectedValueOnce(new Error('QUOTA'));
    await expect(FolderStorage.create('Unsaved')).rejects.toThrow('QUOTA');
    expect(await FolderStorage.getAll()).toEqual([]);

    const folder = await FolderStorage.create('Pinned');
    chrome.storage.local.set.mockRejectedValueOnce(new Error('QUOTA'));
    await expect(FolderStorage.delete(folder.id)).rejects.toThrow('QUOTA');
    const folders = await FolderStorage.getAll();
    expect(folders).toHaveLength(1);
    expect(folders[0].id).toBe(folder.id);
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

  it('rejects invalid and oversized resources without caching them', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: vi.fn((name) => (name === 'content-length' ? String(ResourceCache.maxResourceBytes + 1) : 'text/plain')),
      },
      arrayBuffer: vi.fn(),
    });
    globalThis.fetch = fetchMock;

    await expect(ResourceCache.fetchResource('file:///tmp/local.js')).rejects.toThrow('Only HTTP(S)');
    await expect(ResourceCache.fetchResource('https://example.com/huge.js')).rejects.toThrow('maximum allowed size');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(ResourceCache.cache['https://example.com/huge.js']).toBeUndefined();
  });

  it('deduplicates concurrent source resource fetches for the same URL', async () => {
    const fetchMock = vi.fn(() => new Promise((resolve) => {
      queueMicrotask(() => resolve(new Response('window.shared = true;', {
        status: 200,
        headers: { 'content-type': 'text/javascript' },
      })));
    }));
    globalThis.fetch = fetchMock;

    const url = 'https://cdn.example.com/shared.js';
    const [first, second] = await Promise.all([
      ResourceCache.fetchResource(url),
      ResourceCache.fetchResource(url),
    ]);

    expect(first).toBe('window.shared = true;');
    expect(second).toBe('window.shared = true;');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(ResourceCache._pendingFetches.has(url)).toBe(false);
  });

  it('rejects internal-host and redirected resource URLs without caching them', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    await expect(ResourceCache.fetchResource('https://127.0.0.1/resource.js')).rejects.toThrow('@resource URL rejected');
    expect(fetchMock).not.toHaveBeenCalled();

    const response = new Response('window.redirected = true;', {
      status: 200,
      headers: { 'content-type': 'text/javascript' },
    });
    Object.defineProperty(response, 'url', { value: 'https://10.0.0.1/resource.js', configurable: true });
    fetchMock.mockResolvedValueOnce(response);

    await expect(ResourceCache.fetchResource('https://cdn.example.com/resource.js')).rejects.toThrow('@resource URL redirected');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(ResourceCache.cache['https://cdn.example.com/resource.js']).toBeUndefined();
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

  it('auto-cleans abandoned requests after the cleanup delay', () => {
    vi.useFakeTimers();
    const request = XhrManager.create(1, 'script_alpha', { url: 'https://a.example' });

    vi.advanceTimersByTime(XhrManager.cleanupDelayMs - 1);
    expect(XhrManager.get(request.id)).toBe(request);

    vi.advanceTimersByTime(1);
    expect(XhrManager.get(request.id)).toBeUndefined();
  });

  it('builds fetch options with cache, redirect, and anonymous controls', () => {
    const headers = { 'cache-control': 'no-store' };
    const options = XhrManager.buildFetchOptions({
      method: 'post',
      headers,
      noCache: true,
      redirect: 'manual',
      anonymous: true,
    });

    expect(options).toMatchObject({
      method: 'POST',
      credentials: 'omit',
      redirect: 'manual',
    });
    expect(options.headers).toEqual({
      'cache-control': 'no-store',
      Pragma: 'no-cache',
    });
    expect(headers).toEqual({ 'cache-control': 'no-store' });
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

  it('resolves explicit latest tags through the registry before building CDN URLs', async () => {
    NpmResolver._resolveLatestVersion = vi.fn().mockResolvedValue('4.17.21');
    NpmResolver._buildCdnUrls = vi.fn().mockReturnValue(['https://cdn.example/lodash.js']);
    NpmResolver._fetchWithTimeout = vi.fn().mockResolvedValue('console.log("ok");');
    NpmResolver._computeSriHash = vi.fn().mockResolvedValue('sha256-test');

    const result = await NpmResolver.resolve('npm:lodash@latest');

    expect(NpmResolver._resolveLatestVersion).toHaveBeenCalledWith('lodash');
    expect(NpmResolver._buildCdnUrls).toHaveBeenCalledWith('lodash', '4.17.21');
    expect(result).toEqual({
      url: 'https://cdn.example/lodash.js',
      integrity: 'sha256-test',
      version: '4.17.21',
    });
  });

  it('resolveWithCode exposes the fetched bytes used for the computed SRI', async () => {
    NpmResolver._buildCdnUrls = vi.fn().mockReturnValue(['https://cdn.example/lodash.js']);
    NpmResolver._fetchWithTimeout = vi.fn().mockResolvedValue('console.log("same bytes");');
    NpmResolver._computeSriHash = vi.fn().mockResolvedValue('sha256-same');

    const result = await NpmResolver.resolveWithCode('npm:lodash@4.17.21');

    expect(result).toEqual({
      url: 'https://cdn.example/lodash.js',
      integrity: 'sha256-same',
      version: '4.17.21',
      code: 'console.log("same bytes");',
    });
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
    // Seed via legacy chrome.storage.local blob — v3 migration picks it up
    // on first ScriptStorage.init() and routes it into IDB.
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
    // v3.0: PublicAPI is loaded as a fresh module (separate ScriptStorage
    // cache); read straight from IDB via the DAO to bypass cache.
    const stored = await ScriptsDAO.get('script_alpha');

    expect(result.ok).toBe(true);
    expect(stored?.enabled).toBe(false);
    expect(stored?.meta.name).toBe('Alpha');
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
          '// @include https://include.example/*',
          '// @exclude https://exclude.example/*',
          '// @grant GM_getValue',
          '// @grant GM_setValue',
          '// @require https://cdn.example/lib.js',
          '// @resource logo https://cdn.example/logo.png',
          '// @connect api.example',
          '// @noframes',
          '// ==/UserScript==',
          'console.log("beta");',
        ].join('\n'),
      },
      { id: 'ext-test' },
    );
    // v3.0: PublicAPI is loaded as a fresh module (separate ScriptStorage
    // cache); read straight from IDB via the DAO to bypass cache.
    const stored = await ScriptsDAO.get(result.scriptId);

    expect(result.ok).toBe(true);
    expect(stored?.id).toBe(result.scriptId);
    expect(stored?.meta.name).toBe('Script Beta');
    expect(stored?.meta.version).toBe('2.1.0');
    expect(stored?.meta.match).toEqual(['https://example.com/*']);
    expect(stored?.meta.include).toEqual(['https://include.example/*']);
    expect(stored?.meta.exclude).toEqual(['https://exclude.example/*']);
    expect(stored?.meta.grant).toEqual(['GM_getValue', 'GM_setValue']);
    expect(stored?.meta.require).toEqual(['https://cdn.example/lib.js']);
    expect(stored?.meta.resource).toEqual({ logo: 'https://cdn.example/logo.png' });
    expect(stored?.meta.connect).toEqual(['api.example']);
    expect(stored?.meta.noframes).toBe(true);
    expect(stored?.code).toContain('console.log("beta")');
    expect(globalThis.registerAllScripts).toHaveBeenCalledTimes(1);
    expect(globalThis.updateBadge).toHaveBeenCalledTimes(1);
    expect(globalThis.autoReloadMatchingTabs).toHaveBeenCalledWith(expect.objectContaining({
      id: result.scriptId,
      name: 'Script Beta',
      meta: expect.objectContaining({
        match: ['https://example.com/*'],
      }),
    }));
  });
});
