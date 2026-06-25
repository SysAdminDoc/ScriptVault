import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const code = readFileSync(resolve(__dirname, '../modules/npm-resolve.js'), 'utf8');

let NpmResolver;
const _body = code + '\nreturn NpmResolver;';
let _compiledFn;
try { const vm = require('node:vm'); _compiledFn = vm.compileFunction(_body, ['chrome', 'console', 'fetch', 'crypto', 'TextEncoder', 'btoa'], { filename: resolve(__dirname, '../modules/npm-resolve.js') }); } catch { _compiledFn = new Function('chrome', 'console', 'fetch', 'crypto', 'TextEncoder', 'btoa', _body); }
function createFresh(fetchMock = vi.fn()) {
  return _compiledFn(globalThis.chrome, console, fetchMock, globalThis.crypto, TextEncoder, globalThis.btoa);
}

beforeEach(() => {
  globalThis.__resetStorageMock();
  NpmResolver = createFresh();
  vi.clearAllMocks();
});

describe('NpmResolver', () => {
  describe('isNpmRequire', () => {
    it('returns true for npm: prefix', () => {
      expect(NpmResolver.isNpmRequire('npm:lodash')).toBe(true);
      expect(NpmResolver.isNpmRequire('npm:lodash@4.17.21')).toBe(true);
    });

    it('returns false for non-npm URLs', () => {
      expect(NpmResolver.isNpmRequire('https://cdn.com/lib.js')).toBe(false);
      expect(NpmResolver.isNpmRequire('')).toBe(false);
      expect(NpmResolver.isNpmRequire(null)).toBe(false);
      expect(NpmResolver.isNpmRequire(undefined)).toBe(false);
      expect(NpmResolver.isNpmRequire(123)).toBe(false);
    });
  });

  describe('_parseSpec', () => {
    it('parses name without version', () => {
      const result = NpmResolver._parseSpec('npm:lodash');
      expect(result.name).toBe('lodash');
      expect(result.version).toBeNull();
    });

    it('parses name with version', () => {
      const result = NpmResolver._parseSpec('npm:lodash@4.17.21');
      expect(result.name).toBe('lodash');
      expect(result.version).toBe('4.17.21');
    });

    it('parses scoped packages', () => {
      const result = NpmResolver._parseSpec('npm:@scope/package@1.0.0');
      expect(result.name).toBe('@scope/package');
      expect(result.version).toBe('1.0.0');
    });

    it('parses scoped package without version', () => {
      const result = NpmResolver._parseSpec('npm:@types/node');
      expect(result.name).toBe('@types/node');
      expect(result.version).toBeNull();
    });
  });

  describe('_buildCdnUrls', () => {
    it('returns multiple CDN URLs for known packages', () => {
      const urls = NpmResolver._buildCdnUrls('lodash', '4.17.21');
      expect(urls.length).toBeGreaterThanOrEqual(2);
      expect(urls.some(u => u.includes('jsdelivr'))).toBe(true);
      expect(urls.some(u => u.includes('unpkg'))).toBe(true);
    });

    it('uses known file overrides for popular packages', () => {
      const urls = NpmResolver._buildCdnUrls('jquery', '3.7.1');
      expect(urls.some(u => u.includes('jquery.min.js'))).toBe(true);
    });

    it('generates generic URLs for unknown packages', () => {
      const urls = NpmResolver._buildCdnUrls('obscure-lib', '1.0.0');
      expect(urls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('_sanitizePackageName', () => {
    it('passes valid names through', () => {
      expect(NpmResolver._sanitizePackageName('lodash')).toBe('lodash');
      expect(NpmResolver._sanitizePackageName('@scope/pkg')).toBe('@scope/pkg');
    });

    it('rejects path traversal', () => {
      expect(() => NpmResolver._sanitizePackageName('../etc/passwd')).toThrow();
      expect(() => NpmResolver._sanitizePackageName('..\\windows')).toThrow();
    });

    it('rejects empty names', () => {
      expect(() => NpmResolver._sanitizePackageName('')).toThrow();
    });
  });

  describe('resolve', () => {
    it('rejects non-npm specs', async () => {
      await expect(NpmResolver.resolve('https://cdn.com/lib.js')).rejects.toThrow('Not an npm');
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

    it('resolveWithCode returns the exact bytes used for SRI computation', async () => {
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
      expect(NpmResolver._computeSriHash).toHaveBeenCalledWith('console.log("same bytes");');
    });
  });

  describe('_fetchWithTimeout', () => {
    it('rejects non-HTTPS package fetches before network I/O', async () => {
      const fetchMock = vi.fn();
      NpmResolver = createFresh(fetchMock);

      await expect(NpmResolver._fetchWithTimeout('http://cdn.example/pkg.js')).rejects.toThrow('NPM URL rejected');

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects redirects into internal hosts', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://127.0.0.1/pkg.js',
        headers: { get: vi.fn(() => null) },
        text: vi.fn().mockResolvedValue('console.log("bad");'),
      });
      NpmResolver = createFresh(fetchMock);

      await expect(NpmResolver._fetchWithTimeout('https://cdn.example/pkg.js')).rejects.toThrow('redirected to internal host');
    });

    it('rejects oversized responses before reading when content-length is available', async () => {
      const text = vi.fn();
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: vi.fn((name) => (name === 'content-length' ? String(5 * 1024 * 1024 + 1) : null)) },
        text,
      });
      NpmResolver = createFresh(fetchMock);

      await expect(NpmResolver._fetchWithTimeout('https://cdn.example/pkg.js')).rejects.toThrow('maximum allowed size');

      expect(text).not.toHaveBeenCalled();
    });

    it('stops reading streamed responses that exceed the cap without content-length', async () => {
      const chunk = new Uint8Array(1024 * 1024);
      let reads = 0;
      const reader = {
        read: vi.fn().mockImplementation(async () => {
          reads += 1;
          return reads <= 6 ? { done: false, value: chunk } : { done: true };
        }),
        cancel: vi.fn().mockResolvedValue(undefined),
        releaseLock: vi.fn(),
      };
      const text = vi.fn();
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: vi.fn(() => null) },
        body: { getReader: vi.fn(() => reader) },
        text,
      });
      NpmResolver = createFresh(fetchMock);

      await expect(NpmResolver._fetchWithTimeout('https://cdn.example/pkg.js')).rejects.toThrow('maximum allowed size');

      expect(reader.cancel).toHaveBeenCalled();
      expect(reader.releaseLock).toHaveBeenCalled();
      expect(text).not.toHaveBeenCalled();
    });
  });

  describe('POPULAR_PACKAGES', () => {
    it('has entries for common packages', () => {
      expect(NpmResolver.POPULAR_PACKAGES.lodash).toBeTruthy();
      expect(NpmResolver.POPULAR_PACKAGES.jquery).toBeTruthy();
      expect(NpmResolver.POPULAR_PACKAGES.axios).toBeTruthy();
      expect(NpmResolver.POPULAR_PACKAGES.d3).toBeTruthy();
    });

    it('each entry has cdn and file fields', () => {
      for (const [name, entry] of Object.entries(NpmResolver.POPULAR_PACKAGES)) {
        expect(entry.cdn, `${name} missing cdn`).toBeTruthy();
        expect(entry.file, `${name} missing file`).toBeTruthy();
      }
    });
  });
});
