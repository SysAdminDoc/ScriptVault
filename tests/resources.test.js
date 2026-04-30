import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const code = readFileSync(resolve(__dirname, '../modules/resources.js'), 'utf8');
const originalFetch = globalThis.fetch;

let ResourceCache;
function createFresh() {
  const fn = new Function('chrome', 'console', 'fetch', 'btoa', 'TextDecoder',
    code + '\nreturn ResourceCache;'
  );
  return fn(globalThis.chrome, console, globalThis.fetch, globalThis.btoa, TextDecoder);
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
