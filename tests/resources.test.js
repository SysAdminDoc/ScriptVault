import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const code = readFileSync(resolve(__dirname, '../modules/resources.js'), 'utf8');
// modules/resources.js references the InternalHostGuard global declared by
// modules/internal-host-guard.js (concatenated by the production build).
// Re-create the same effect for tests by prepending the guard source.
const guardCode = readFileSync(resolve(__dirname, '../modules/internal-host-guard.js'), 'utf8');
const originalFetch = globalThis.fetch;

let ResourceCache;
function createFresh() {
  const fn = new Function('chrome', 'console', 'fetch', 'btoa', 'TextDecoder', 'URL',
    guardCode + '\n' + code + '\nreturn ResourceCache;'
  );
  return fn(globalThis.chrome, console, globalThis.fetch, globalThis.btoa, TextDecoder, URL);
}

beforeEach(() => {
  globalThis.__resetStorageMock();
  ResourceCache = createFresh();
  vi.clearAllMocks();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('ResourceCache', () => {
  describe('get/set', () => {
    it('returns null for uncached URL', async () => {
      const result = await ResourceCache.get('https://example.com/lib.js');
      expect(result).toBeNull();
    });

    it('set() stores and get() retrieves', async () => {
      await ResourceCache.set('https://example.com/lib.js', 'var x = 1;', 'data:text/javascript;base64,dmFy');
      const result = await ResourceCache.get('https://example.com/lib.js');
      expect(result.text).toBe('var x = 1;');
      expect(result.dataUri).toContain('data:');
    });

    it('expires entries after maxAge', async () => {
      await ResourceCache.set('https://old.com/lib.js', 'old', 'data:old');
      // Manually expire
      ResourceCache.cache['https://old.com/lib.js'].timestamp = Date.now() - ResourceCache.maxAge - 1000;
      const result = await ResourceCache.get('https://old.com/lib.js');
      expect(result).toBeNull();
    });

    it('persists to chrome.storage.local', async () => {
      await ResourceCache.set('https://a.com/x.js', 'code', 'data:x');
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    it('evicts oldest in-memory entries when the cache reaches its cap', async () => {
      for (let i = 0; i <= ResourceCache.maxEntries; i++) {
        await ResourceCache.set(`https://a.com/${i}.js`, String(i), `data:${i}`);
      }

      expect(Object.keys(ResourceCache.cache)).toHaveLength(ResourceCache.maxEntries);
      expect(ResourceCache.cache['https://a.com/0.js']).toBeUndefined();
      expect(ResourceCache.cache[`https://a.com/${ResourceCache.maxEntries}.js`]).toBeTruthy();
    });
  });

  describe('fetchResource', () => {
    it('rejects non-http resource URLs before fetching', async () => {
      const fetchMock = vi.fn();
      globalThis.fetch = fetchMock;
      ResourceCache = createFresh();

      await expect(ResourceCache.fetchResource('file:///tmp/local.js')).rejects.toThrow('Only HTTP(S)');

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects internal-host resource URLs before fetching', async () => {
      const fetchMock = vi.fn();
      globalThis.fetch = fetchMock;
      ResourceCache = createFresh();

      await expect(ResourceCache.fetchResource('https://127.0.0.1/lib.js')).rejects.toThrow('@resource URL rejected');

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects resource redirects into internal hosts before caching', async () => {
      const response = new Response('var redirected = true;', {
        status: 200,
        headers: { 'content-type': 'text/javascript' },
      });
      Object.defineProperty(response, 'url', { value: 'https://10.0.0.1/lib.js', configurable: true });
      const fetchMock = vi.fn().mockResolvedValue(response);
      globalThis.fetch = fetchMock;
      ResourceCache = createFresh();

      await expect(ResourceCache.fetchResource('https://cdn.example.com/lib.js')).rejects.toThrow('@resource URL redirected');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(ResourceCache.cache['https://cdn.example.com/lib.js']).toBeUndefined();
    });

    it('rejects oversized resources before reading the body when content-length is available', async () => {
      const arrayBuffer = vi.fn();
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: vi.fn((name) => (name === 'content-length' ? String(ResourceCache.maxResourceBytes + 1) : 'text/plain')),
        },
        arrayBuffer,
      });
      globalThis.fetch = fetchMock;
      ResourceCache = createFresh();

      await expect(ResourceCache.fetchResource('https://cdn.example.com/huge.js')).rejects.toThrow('maximum allowed size');

      expect(arrayBuffer).not.toHaveBeenCalled();
      expect(ResourceCache.cache['https://cdn.example.com/huge.js']).toBeUndefined();
    });

    it('rejects oversized resources after reading unknown-length bodies', async () => {
      const body = new Uint8Array(ResourceCache.maxResourceBytes + 1);
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: vi.fn((name) => (name === 'content-type' ? 'text/javascript' : null)),
        },
        arrayBuffer: vi.fn().mockResolvedValue(body.buffer),
      });
      globalThis.fetch = fetchMock;
      ResourceCache = createFresh();

      await expect(ResourceCache.fetchResource('https://cdn.example.com/huge-body.js')).rejects.toThrow('maximum allowed size');

      expect(ResourceCache.cache['https://cdn.example.com/huge-body.js']).toBeUndefined();
    });

    // LR-002 — concurrent fetch dedup
    it('deduplicates concurrent fetches of the same URL into a single network call', async () => {
      const body = new Uint8Array([0x76, 0x61, 0x72]); // "var"
      // Resolve fetch on the next microtask so both callers race the cache-miss check.
      const fetchMock = vi.fn(() => new Promise((resolve) => {
        queueMicrotask(() => resolve({
          ok: true,
          status: 200,
          headers: {
            get: vi.fn((name) => (name === 'content-type' ? 'text/javascript' : null)),
          },
          arrayBuffer: vi.fn().mockResolvedValue(body.buffer),
        }));
      }));
      globalThis.fetch = fetchMock;
      ResourceCache = createFresh();

      const url = 'https://cdn.example.com/shared-lib.js';
      const [r1, r2, r3] = await Promise.all([
        ResourceCache.fetchResource(url),
        ResourceCache.fetchResource(url),
        ResourceCache.fetchResource(url),
      ]);
      expect(r1).toBe('var');
      expect(r2).toBe('var');
      expect(r3).toBe('var');
      // The whole point: only one network call.
      expect(fetchMock).toHaveBeenCalledTimes(1);
      // Pending map drained.
      expect(ResourceCache._pendingFetches.has(url)).toBe(false);
    });

    it('a failed concurrent fetch clears the pending map so the next caller can retry', async () => {
      // Single fetch mock with sequenced behavior: first call rejects
      // (concurrent callers share this rejection), second call (after the
      // pending map is cleared) succeeds. Re-creating ResourceCache between
      // calls would wipe state and make the test vacuous, since createFresh
      // snapshots globalThis.fetch at construction time.
      const body = new Uint8Array([0x6f, 0x6b]); // "ok"
      const fetchMock = vi.fn()
        .mockImplementationOnce(() => new Promise((_, reject) => {
          queueMicrotask(() => reject(new TypeError('network error')));
        }))
        .mockImplementationOnce(() => Promise.resolve({
          ok: true,
          status: 200,
          headers: {
            get: vi.fn((name) => (name === 'content-type' ? 'text/javascript' : null)),
          },
          arrayBuffer: vi.fn().mockResolvedValue(body.buffer),
        }));
      globalThis.fetch = fetchMock;
      ResourceCache = createFresh();

      const url = 'https://cdn.example.com/flaky.js';
      // Two concurrent callers — both must reject from the SAME in-flight
      // promise. Wrap each in its own catch handler so the rejection is
      // registered before settlement (avoids unhandled-rejection probe).
      const e1 = ResourceCache.fetchResource(url).then(
        v => ({ status: 'fulfilled', value: v }),
        e => ({ status: 'rejected', reason: e })
      );
      const e2 = ResourceCache.fetchResource(url).then(
        v => ({ status: 'fulfilled', value: v }),
        e => ({ status: 'rejected', reason: e })
      );
      const [r1, r2] = await Promise.all([e1, e2]);
      expect(r1.status).toBe('rejected');
      expect(r2.status).toBe('rejected');
      // Critical assertion: only ONE network call serviced both callers.
      expect(fetchMock).toHaveBeenCalledTimes(1);
      // Pending map drained so the next call won't inherit the rejection.
      expect(ResourceCache._pendingFetches.has(url)).toBe(false);

      // Subsequent call: same ResourceCache, same bound fetchMock, but the
      // second mockImplementationOnce returns success. Verifies the failure
      // didn't poison the URL.
      const recovered = await ResourceCache.fetchResource(url);
      expect(recovered).toBe('ok');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('cache hit short-circuits before consulting _pendingFetches', async () => {
      const fetchMock = vi.fn();
      globalThis.fetch = fetchMock;
      ResourceCache = createFresh();

      const url = 'https://cdn.example.com/already-cached.js';
      await ResourceCache.set(url, 'cached body', 'data:text/javascript;base64,Y2FjaGVk');

      const result = await ResourceCache.fetchResource(url);
      expect(result).toBe('cached body');
      expect(fetchMock).not.toHaveBeenCalled();
      expect(ResourceCache._pendingFetches.has(url)).toBe(false);
    });
  });

  describe('clear', () => {
    it('clears in-memory cache', async () => {
      await ResourceCache.set('https://a.com/x.js', 'code', 'data:x');
      await ResourceCache.clear();
      expect(ResourceCache.cache).toEqual({});
    });

    it('calls storage.get(null) to find cache keys', async () => {
      await ResourceCache.clear();
      // clear() calls get(null) to enumerate all keys with the prefix
      expect(chrome.storage.local.get).toHaveBeenCalledWith(null);
    });
  });

  describe('prefetchResources', () => {
    it('handles null/undefined resources gracefully', async () => {
      await ResourceCache.prefetchResources(null);
      await ResourceCache.prefetchResources(undefined);
      // Should not throw
    });

    it('handles empty object', async () => {
      await ResourceCache.prefetchResources({});
      // No fetches triggered
    });
  });
});
