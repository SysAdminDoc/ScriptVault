import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const code = readFileSync(resolve(__dirname, '../modules/resources.js'), 'utf8');

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
