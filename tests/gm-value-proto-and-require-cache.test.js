import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const core = readFileSync(resolve(process.cwd(), 'background.core.js'), 'utf8');

// Extract the GM_getValue body from the wrapper template and run it against a
// plain-object cache, which is exactly how the shipped wrapper builds it
// (`let _cache = ${JSON.stringify(preloadedStorage)}`).
function makeGetValue(cache) {
  const start = core.indexOf('function GM_getValue(key, defaultValue) {');
  expect(start, 'GM_getValue in the wrapper template').toBeGreaterThan(-1);
  let depth = 0;
  let end = -1;
  for (let i = core.indexOf('{', start); i < core.length; i += 1) {
    if (core[i] === '{') depth += 1;
    else if (core[i] === '}') {
      depth -= 1;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  const body = [
    `const _cache = ${JSON.stringify(cache)};`,
    'function hasGrant() { return true; }',
    core.slice(start, end),
    'return GM_getValue;',
  ].join('\n');
  return new Function(body)();
}

describe('GM_getValue does not resolve prototype-chain members', () => {
  const GM_getValue = makeGetValue({ real: 'stored' });

  it('returns stored own properties', () => {
    expect(GM_getValue('real', 'fallback')).toBe('stored');
  });

  it('returns the caller default for Object.prototype members', () => {
    // `key in _cache` was true for every inherited member, so these returned
    // functions from Object.prototype instead of the supplied default.
    for (const key of ['toString', 'constructor', 'hasOwnProperty', 'valueOf', '__proto__']) {
      expect(GM_getValue(key, 'fallback'), key).toBe('fallback');
    }
  });

  it('returns the default for genuinely absent keys', () => {
    expect(GM_getValue('missing', 'fallback')).toBe('fallback');
    expect(GM_getValue('missing')).toBeUndefined();
  });

  it('uses hasOwnProperty at every cache read site', () => {
    const sites = core.match(/key in _cache/g) || [];
    expect(sites, 'no bare `key in _cache` reads should remain').toHaveLength(0);
    expect(core).toContain("Object.prototype.hasOwnProperty.call(_cache, key)");
  });
});

describe('GM storage refresh preserves writes made during the initial read', () => {
  it('does not let the stale background snapshot overwrite a local set', async () => {
    const start = core.indexOf('  // Refresh storage cache from background');
    const end = core.indexOf('  // Constructable-stylesheet support', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const refreshCode = core.slice(start, end);
    const factory = new Function(`
      let _cache = { race: 'preloaded' };
      const _cacheLocalMutations = new Set();
      let _cacheReady = false;
      let _cacheReadyResolve = null;
      const scriptId = 'script-race';
      let resolveRefresh;
      const pendingRefresh = new Promise(resolve => { resolveRefresh = resolve; });
      function sendToBackground() { return pendingRefresh; }
      function hasGrant() { return true; }
      ${refreshCode}
      return { GM_getValue, GM_setValue, GM_deleteValue, pendingRefresh, resolveRefresh };
    `)();

    factory.GM_setValue('race', 'local');
    factory.resolveRefresh({ race: 'stale', fresh: 'background' });
    await factory.pendingRefresh;
    await Promise.resolve();

    expect(factory.GM_getValue('race')).toBe('local');
    expect(factory.GM_getValue('fresh')).toBe('background');

    factory.GM_deleteValue('fresh');
    expect(factory.GM_getValue('fresh', 'fallback')).toBe('fallback');
  });
});

describe('@require in-memory cache is keyed by the integrity fragment', () => {
  // The persistent cache hashes the full URL (buildRequireCacheKey(url)), but
  // the in-memory Map was keyed on fetchUrl — the URL with #sha256=... stripped.
  // So an unpinned require of https://cdn/x.js stored unverified bytes under
  // the same key a pinned https://cdn/x.js#sha256-... would hit, returning them
  // before verifySRI ever ran.
  const fn = core.slice(
    core.indexOf('async function fetchRequireScript(url'),
    core.indexOf('async function fetchRequireScript(url') + 12000,
  );

  it('reads and writes the in-memory cache under the full url', () => {
    expect(fn).toContain('requireCache.has(url)');
    expect(fn).toContain('requireCache.get(url)');
    expect(fn).not.toContain('requireCache.has(fetchUrl)');
    expect(fn).not.toContain('requireCache.get(fetchUrl)');
    expect(fn).not.toContain('requireCacheSet(fetchUrl');
  });

  it('still strips the fragment for the actual network fetch', () => {
    // fetchUrl remains the thing we request; only the cache key changed.
    expect(fn).toContain('const fallbacks = getFallbackUrls(fetchUrl)');
    expect(fn).toContain('const urlsToTry = [fetchUrl, ...fallbacks]');
  });
});
