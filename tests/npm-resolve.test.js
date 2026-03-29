import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const code = readFileSync(resolve(__dirname, '../modules/npm-resolve.js'), 'utf8');

let NpmResolver;
function createFresh() {
  const fn = new Function('chrome', 'console', 'fetch', 'crypto', 'TextEncoder', 'btoa',
    code + '\nreturn NpmResolver;'
  );
  return fn(globalThis.chrome, console, vi.fn(), globalThis.crypto, TextEncoder, globalThis.btoa);
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
