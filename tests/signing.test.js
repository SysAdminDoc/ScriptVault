import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const code = readFileSync(resolve(__dirname, '../bg/signing.js'), 'utf8');

// Provide SettingsManager mock
const settingsCache = {};
const preamble = `
  const SettingsManager = {
    cache: null,
    async init() { if (this.cache) return; this.cache = {}; },
    async get(key) { await this.init(); return key ? this.cache[key] : {...this.cache}; },
    async set(key, val) {
      await this.init();
      if (typeof key === 'object') Object.assign(this.cache, key);
      else this.cache[key] = val;
    }
  };
`;

let ScriptSigning;
const fn = new Function('chrome', 'console', 'crypto', 'btoa', 'atob',
  preamble + code + '\nreturn { ScriptSigning, SettingsManager };'
);
const mods = fn(globalThis.chrome, console, globalThis.crypto, globalThis.btoa, globalThis.atob);
ScriptSigning = mods.ScriptSigning;
const SettingsManager = mods.SettingsManager;

beforeEach(() => {
  globalThis.__resetStorageMock();
  SettingsManager.cache = null;
  vi.clearAllMocks();
});

describe('ScriptSigning', () => {
  describe('trust management', () => {
    it('trustKey stores key with name and timestamp', async () => {
      await ScriptSigning.trustKey('abc123publickey', 'Test Author');
      const keys = await ScriptSigning.getTrustedKeys();
      expect(keys['abc123publickey']).toBeTruthy();
      expect(keys['abc123publickey'].name).toBe('Test Author');
      expect(keys['abc123publickey'].addedAt).toBeGreaterThan(0);
    });

    it('trustKey uses truncated key as default name', async () => {
      await ScriptSigning.trustKey('verylongpublickeyvalue');
      const keys = await ScriptSigning.getTrustedKeys();
      expect(keys['verylongpublickeyvalue'].name).toContain('verylongpubl');
    });

    it('untrustKey removes key', async () => {
      await ScriptSigning.trustKey('key1', 'Author 1');
      await ScriptSigning.trustKey('key2', 'Author 2');
      await ScriptSigning.untrustKey('key1');
      const keys = await ScriptSigning.getTrustedKeys();
      expect(keys['key1']).toBeUndefined();
      expect(keys['key2']).toBeTruthy();
    });

    it('getTrustedKeys returns empty object by default', async () => {
      const keys = await ScriptSigning.getTrustedKeys();
      expect(keys).toEqual({});
    });
  });

  describe('verifyScript', () => {
    it('returns invalid for missing signature', async () => {
      const result = await ScriptSigning.verifyScript('code', {});
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Missing');
    });

    it('returns invalid for null signatureInfo', async () => {
      const result = await ScriptSigning.verifyScript('code', null);
      expect(result.valid).toBe(false);
    });
  });

  describe('trust-store prototype lookup', () => {
    it('does not resolve inherited Object.prototype property names as trusted', async () => {
      // Shape the crypto.subtle.verify mock to return `true` so verification
      // succeeds, isolating the trust-store lookup path. The publicKey field is
      // controlled by the signed script's metadata — if `trustedKeys[key]` were
      // looked up without an own-property guard, `toString`/`hasOwnProperty`
      // etc. would resolve to their inherited functions and report `trusted: true`.
      const origVerify = crypto.subtle.verify;
      const origImport = crypto.subtle.importKey;
      crypto.subtle.verify = async () => true;
      crypto.subtle.importKey = async () => ({});
      try {
        const result = await ScriptSigning.verifyScript('code', {
          signature: 'AA', publicKey: 'toString'
        });
        expect(result.valid).toBe(true);
        expect(result.trusted).toBe(false);
        expect(result.trustedName).toBeNull();
      } finally {
        crypto.subtle.verify = origVerify;
        crypto.subtle.importKey = origImport;
      }
    });

    it('still reports trusted: true for keys explicitly added to the trust store', async () => {
      const origVerify = crypto.subtle.verify;
      const origImport = crypto.subtle.importKey;
      crypto.subtle.verify = async () => true;
      crypto.subtle.importKey = async () => ({});
      try {
        await ScriptSigning.trustKey('legitpubkey', 'Alice');
        const result = await ScriptSigning.verifyScript('code', {
          signature: 'AA', publicKey: 'legitpubkey'
        });
        expect(result.valid).toBe(true);
        expect(result.trusted).toBe(true);
        expect(result.trustedName).toBe('Alice');
      } finally {
        crypto.subtle.verify = origVerify;
        crypto.subtle.importKey = origImport;
      }
    });
  });

  describe('extractSignatureFromCode', () => {
    it('parses signature from metadata', () => {
      const code = `// ==UserScript==
// @name Test
// @signature abc123|pubkey456|1234567890
// ==/UserScript==
console.log('hello');`;
      const info = ScriptSigning.extractSignatureFromCode(code);
      expect(info).toBeTruthy();
      expect(info.signature).toBe('abc123');
      expect(info.publicKey).toBe('pubkey456');
      expect(info.timestamp).toBe(1234567890);
    });

    it('returns null for unsigned scripts', () => {
      const code = `// ==UserScript==
// @name Test
// ==/UserScript==
console.log('hello');`;
      const info = ScriptSigning.extractSignatureFromCode(code);
      expect(info).toBeNull();
    });
  });
});
