// Functional coverage for the fetch-freshness policy on the update-check path:
// stale-cache refusal, 304 handling, forced (manual) refresh, and validator
// persistence. Drives the same UpdateSystem the runtime bridge mirrors.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { UpdateSystem } from '../src/background/update-checker.ts';

function makeMeta(overrides = {}) {
  return {
    name: 'Freshness Script',
    namespace: 'scriptvault-tests',
    version: '1.0.0',
    updateURL: 'https://cdn.example.com/freshness.meta.js',
    downloadURL: 'https://cdn.example.com/freshness.user.js',
    match: ['https://example.com/*'],
    grant: [],
    require: [],
    resource: {},
    connect: [],
    ...overrides,
  };
}

function makeScript(id, overrides = {}) {
  const meta = makeMeta(overrides.meta || {});
  return {
    id,
    code: '// ==UserScript==\n// ==/UserScript==\n',
    enabled: true,
    meta,
    settings: {},
    ...overrides,
    meta,
  };
}

function response(status, { headers = {}, body = '' } = {}) {
  const lower = new Map(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  return {
    status,
    ok: status >= 200 && status < 300,
    url: 'https://cdn.example.com/freshness.user.js',
    headers: { get: (name) => (lower.has(String(name).toLowerCase()) ? lower.get(String(name).toLowerCase()) : null) },
    text: async () => body,
    body: {
      getReader: () => {
        let done = false;
        return {
          read: async () => {
            if (done) return { done: true, value: undefined };
            done = true;
            return { done: false, value: new TextEncoder().encode(body) };
          },
          cancel: async () => {},
          releaseLock: () => {},
        };
      },
    },
  };
}

const scripts = new Map();
let fetchCalls = [];

beforeEach(() => {
  scripts.clear();
  fetchCalls = [];
  globalThis.ScriptStorage = {
    get: vi.fn(async (id) => scripts.get(id) || null),
    getAll: vi.fn(async () => Array.from(scripts.values())),
    set: vi.fn(async (id, script) => { scripts.set(id, script); }),
  };
  globalThis.parseUserscript = vi.fn((code) => ({
    meta: makeMeta({ version: code.match(/@version\s+([^\n]+)/)?.[1]?.trim() || '1.0.0' }),
    code,
  }));
});

afterEach(() => {
  delete globalThis.ScriptStorage;
  delete globalThis.parseUserscript;
  vi.unstubAllGlobals();
});

function stubFetch(handler) {
  vi.stubGlobal('fetch', vi.fn(async (url, init) => {
    fetchCalls.push({ url, init });
    return handler(url, init);
  }));
}

describe('update check freshness policy', () => {
  it('refuses the shared HTTP cache on a scheduled check and sends stored validators', async () => {
    scripts.set('s1', makeScript('s1', { _httpEtag: 'W/"v1"', _httpLastModified: 'Wed, 21 Oct 2026 07:28:00 GMT' }));
    stubFetch(() => response(304));

    const updates = await UpdateSystem.checkForUpdates();

    expect(updates).toEqual([]);
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].init.cache).toBe('no-store');
    expect(fetchCalls[0].init.headers['If-None-Match']).toBe('W/"v1"');
    expect(fetchCalls[0].init.headers['If-Modified-Since']).toBe('Wed, 21 Oct 2026 07:28:00 GMT');
  });

  it('treats 304 as "no update" without clobbering the stored validators', async () => {
    scripts.set('s1', makeScript('s1', { _httpEtag: 'W/"v1"' }));
    stubFetch(() => response(304));

    await UpdateSystem.checkForUpdates();

    expect(scripts.get('s1')._httpEtag).toBe('W/"v1"');
    expect(globalThis.ScriptStorage.set).not.toHaveBeenCalled();
  });

  it('sends no validators on a user-triggered single-script check, so a body always comes back', async () => {
    scripts.set('s1', makeScript('s1', { _httpEtag: 'W/"v1"', _httpLastModified: 'Wed, 21 Oct 2026 07:28:00 GMT' }));
    stubFetch(() => response(200, {
      headers: { etag: 'W/"v2"' },
      body: '// ==UserScript==\n// @version 2.0.0\n// ==/UserScript==\n',
    }));

    const updates = await UpdateSystem.checkForUpdates('s1');

    expect(fetchCalls[0].init.headers['If-None-Match']).toBeUndefined();
    expect(fetchCalls[0].init.headers['If-Modified-Since']).toBeUndefined();
    expect(fetchCalls[0].init.cache).toBe('no-store');
    expect(updates).toHaveLength(1);
    expect(updates[0].newVersion).toBe('2.0.0');
  });

  it('persists validators from a 200 so the next scheduled check can be conditional', async () => {
    scripts.set('s1', makeScript('s1'));
    stubFetch(() => response(200, {
      headers: { etag: 'W/"v2"', 'last-modified': 'Thu, 22 Oct 2026 07:28:00 GMT' },
      body: '// ==UserScript==\n// @version 2.0.0\n// ==/UserScript==\n',
    }));

    await UpdateSystem.checkForUpdates();

    expect(scripts.get('s1')._httpEtag).toBe('W/"v2"');
    expect(scripts.get('s1')._httpLastModified).toBe('Thu, 22 Oct 2026 07:28:00 GMT');
  });

  it('leaves a working validator pair alone when the server stops sending them', async () => {
    scripts.set('s1', makeScript('s1', { _httpEtag: 'W/"v1"' }));
    stubFetch(() => response(200, { body: '// ==UserScript==\n// @version 1.0.0\n// ==/UserScript==\n' }));

    await UpdateSystem.checkForUpdates();

    expect(scripts.get('s1')._httpEtag).toBe('W/"v1"');
  });

  it('skips user-modified scripts on scheduled checks but allows an explicit single-script check', async () => {
    const core = readFileSync(resolve(process.cwd(), 'src/background/core.ts'), 'utf8');
    expect(core).toContain('if (!isManualSingle && script.settings?.userModified) continue;');
    scripts.set('s1', makeScript('s1', { settings: { userModified: true } }));
    stubFetch(() => response(200, {
      body: '// ==UserScript==\n// @version 2.0.0\n// ==/UserScript==\n',
    }));

    await expect(UpdateSystem.checkForUpdates()).resolves.toEqual([]);
    expect(fetchCalls).toHaveLength(0);

    const manual = await UpdateSystem.checkForUpdates('s1');
    expect(manual).toHaveLength(1);
    expect(manual[0].newVersion).toBe('2.0.0');
    expect(fetchCalls).toHaveLength(1);
  });
});
