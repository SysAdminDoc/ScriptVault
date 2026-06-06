import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const code = readFileSync(resolve(__dirname, '../modules/public-api.js'), 'utf8');

let PublicAPI;
function createFreshAPI({ fetchMock, ScriptStorage } = {}) {
  const storage = ScriptStorage || {
    getAll: vi.fn().mockResolvedValue([]),
    set: vi.fn().mockResolvedValue(),
  };
  const fn = new Function('chrome', 'console', 'crypto', 'fetch', 'ScriptStorage', 'AbortController',
    code + '\nreturn PublicAPI;'
  );
  return fn(
    globalThis.chrome,
    console,
    globalThis.crypto,
    fetchMock || vi.fn().mockResolvedValue({ ok: true }),
    storage,
    globalThis.AbortController,
  );
}

async function flushPromises() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
}

beforeEach(() => {
  globalThis.__resetStorageMock();
  PublicAPI = createFreshAPI();
  vi.clearAllMocks();
});

describe('PublicAPI', () => {
  it('init() loads state from storage', async () => {
    await PublicAPI.init();
    expect(chrome.storage.local.get).toHaveBeenCalled();
  });

  it('shares concurrent init so listeners are only registered once', async () => {
    await Promise.all([PublicAPI.init(), PublicAPI.init(), PublicAPI.init()]);

    expect(chrome.runtime.onMessageExternal.addListener).toHaveBeenCalledTimes(1);
  });

  it('allows init retry after a transient listener registration failure', async () => {
    chrome.runtime.onMessageExternal.addListener.mockImplementationOnce(() => {
      throw new Error('listener unavailable');
    });

    await expect(PublicAPI.init()).rejects.toThrow('listener unavailable');
    await PublicAPI.init();

    expect(chrome.runtime.onMessageExternal.addListener).toHaveBeenCalledTimes(2);
  });

  describe('getAPISchema', () => {
    it('returns schema with endpoints', () => {
      const schema = PublicAPI.getAPISchema();
      expect(schema.version).toBeTruthy();
      expect(schema.endpoints.ping).toBeTruthy();
      expect(schema.endpoints.getInstalledScripts).toBeTruthy();
    });
  });

  describe('handleExternalMessage', () => {
    it('ping returns ok + version', async () => {
      const result = await PublicAPI.handleExternalMessage(
        { action: 'ping' },
        { id: 'test-ext' }
      );
      expect(result.ok).toBe(true);
      expect(result.version).toBeTruthy();
    });

    it('getVersion returns version string', async () => {
      const result = await PublicAPI.handleExternalMessage(
        { action: 'getVersion' },
        { id: 'test-ext' }
      );
      expect(result.version).toBeTruthy();
    });

    it('unknown action returns error', async () => {
      const result = await PublicAPI.handleExternalMessage(
        { action: 'nonexistent' },
        { id: 'test-ext' }
      );
      expect(result.error).toContain('Unknown action');
    });

    it('missing action returns error', async () => {
      const result = await PublicAPI.handleExternalMessage({}, { id: 'test-ext' });
      expect(result.error).toContain('Missing action');
    });

    it('rate limits rapid requests', async () => {
      const sender = { id: 'rapid-ext' };
      for (let i = 0; i < 10; i++) {
        await PublicAPI.handleExternalMessage({ action: 'ping' }, sender);
      }
      const result = await PublicAPI.handleExternalMessage({ action: 'ping' }, sender);
      expect(result.error).toContain('Rate limited');
    });

    it('rejects arbitrary or oversized external install source before permission checks', async () => {
      const invalid = await PublicAPI.handleExternalMessage(
        { action: 'installScript', code: 'console.log("not a userscript");' },
        { id: 'test-ext' },
      );
      const oversized = await PublicAPI.handleExternalMessage(
        { action: 'installScript', code: `${'x'.repeat(5 * 1024 * 1024 + 1)}==UserScript==` },
        { id: 'test-ext-2' },
      );

      expect(invalid.error).toContain('missing ==UserScript==');
      expect(oversized.error).toContain('exceeds maximum allowed size');
    });

    it('preserves common userscript metadata when installing through the external API', async () => {
      const ScriptStorage = {
        getAll: vi.fn().mockResolvedValue([]),
        set: vi.fn().mockResolvedValue(),
      };
      PublicAPI = createFreshAPI({ ScriptStorage });
      await PublicAPI.init();
      await PublicAPI.setPermissions({ installScript: 'allow' });

      const result = await PublicAPI.handleExternalMessage(
        {
          action: 'installScript',
          code: [
            '// ==UserScript==',
            '// @name Metadata Script',
            '// @namespace scriptvault/tests',
            '// @version 1.2.3',
            '// @description Checks metadata persistence',
            '// @include https://include.example/*',
            '// @exclude https://exclude.example/*',
            '// @grant GM_getValue',
            '// @grant GM_setValue',
            '// @require https://cdn.example/lib.js',
            '// @require-provenance https://cdn.example/lib.js.bundle',
            '// @require-identity https://github.com/exampleuser (issuer: https://github.com/login/oauth)',
            '// @resource logo https://cdn.example/logo.png',
            '// @connect api.example',
            '// @noframes',
            '// @run-at document-start',
            '// ==/UserScript==',
            'console.log("metadata");',
          ].join('\n'),
        },
        { id: 'metadata-ext' },
      );
      const installed = ScriptStorage.set.mock.calls[0][1];

      expect(result.ok).toBe(true);
      expect(installed.meta).toMatchObject({
        name: 'Metadata Script',
        namespace: 'scriptvault/tests',
        version: '1.2.3',
        description: 'Checks metadata persistence',
        include: ['https://include.example/*'],
        exclude: ['https://exclude.example/*'],
        grant: ['GM_getValue', 'GM_setValue'],
        require: ['https://cdn.example/lib.js'],
        requireProvenance: ['https://cdn.example/lib.js.bundle'],
        requireIdentity: ['https://github.com/exampleuser (issuer: https://github.com/login/oauth)'],
        resource: { logo: 'https://cdn.example/logo.png' },
        connect: ['api.example'],
        noframes: true,
        'run-at': 'document-start',
      });
    });
  });

  describe('setPermissions', () => {
    it('changes action permissions', async () => {
      await PublicAPI.init();
      await PublicAPI.setPermissions({ ping: 'deny' });
      const result = await PublicAPI.handleExternalMessage(
        { action: 'ping' },
        { id: 'test-ext' }
      );
      expect(result.error).toContain('Permission denied');
    });

    it('ignores invalid permission values', async () => {
      await PublicAPI.init();
      await PublicAPI.setPermissions({ ping: 'invalid' });
      // ping should still be allowed (default)
      const result = await PublicAPI.handleExternalMessage(
        { action: 'ping' },
        { id: 'test-ext' }
      );
      expect(result.ok).toBe(true);
    });

    it('getPermissions returns a defensive copy', async () => {
      await PublicAPI.init();
      const permissions = PublicAPI.getPermissions();
      expect(permissions.ping).toBeTruthy();
      permissions.ping = 'deny';
      expect(PublicAPI.getPermissions().ping).not.toBe('deny');
    });
  });

  describe('setWebhook', () => {
    it('accepts https URLs', async () => {
      await PublicAPI.init();
      await PublicAPI.setWebhook('script.installed', { url: 'https://example.com/hook', enabled: true });
      const hooks = PublicAPI.getWebhooks();
      expect(hooks['script.installed'].url).toBe('https://example.com/hook');
    });

    it('rejects http URLs', async () => {
      await PublicAPI.init();
      await expect(PublicAPI.setWebhook('script.installed', { url: 'http://evil.com', enabled: true }))
        .rejects.toThrow('https://');
    });

    it('rejects unknown event types', async () => {
      await PublicAPI.init();
      await expect(PublicAPI.setWebhook('unknown.event', { url: 'https://x.com', enabled: true }))
        .rejects.toThrow('Unknown event type');
    });

    // Phase 5.5 — webhook SSRF guard ─────────────────────────────────────
    it('rejects localhost', async () => {
      await PublicAPI.init();
      await expect(
        PublicAPI.setWebhook('script.installed', { url: 'https://localhost/hook', enabled: true })
      ).rejects.toThrow(/internal|loopback|localhost/i);
    });

    it('rejects RFC 1918 / private IPv4 addresses', async () => {
      await PublicAPI.init();
      const privateUrls = [
        'https://10.0.0.1/hook',
        'https://192.168.1.1/hook',
        'https://172.16.0.1/hook',
        'https://172.31.255.255/hook',
        'https://127.0.0.1/hook',
      ];
      for (const url of privateUrls) {
        await expect(
          PublicAPI.setWebhook('script.installed', { url, enabled: true })
        ).rejects.toThrow(/internal|loopback|private/i);
      }
    });

    it('rejects link-local + cloud-metadata IPv4', async () => {
      await PublicAPI.init();
      // 169.254.0.0/16 — covers AWS/GCP metadata endpoint 169.254.169.254
      await expect(
        PublicAPI.setWebhook('script.installed', {
          url: 'https://169.254.169.254/latest/meta-data/',
          enabled: true,
        })
      ).rejects.toThrow();
    });

    it('rejects IPv6 loopback and link-local', async () => {
      await PublicAPI.init();
      await expect(
        PublicAPI.setWebhook('script.installed', { url: 'https://[::1]/hook', enabled: true })
      ).rejects.toThrow();
      await expect(
        PublicAPI.setWebhook('script.installed', { url: 'https://[fe80::1]/hook', enabled: true })
      ).rejects.toThrow();
    });

    it('reuses the canonical internal-host guard for webhook URLs', async () => {
      await PublicAPI.init();
      const blockedUrls = [
        'https://evil.localhost/hook',
        'https://192.0.2.1/hook',
        'https://198.51.100.5/hook',
        'https://203.0.113.254/hook',
        'https://198.18.0.1/hook',
        'https://240.0.0.1/hook',
        'https://[::ffff:c0a8:0101]/hook',
      ];

      for (const url of blockedUrls) {
        await expect(
          PublicAPI.setWebhook('script.installed', { url, enabled: true })
        ).rejects.toThrow(/internal|loopback|localhost/i);
      }
    });

    it('still accepts public hostnames', async () => {
      await PublicAPI.init();
      await PublicAPI.setWebhook('script.installed', {
        url: 'https://hooks.example.org/v1/notify',
        enabled: true,
      });
      expect(PublicAPI.getWebhooks()['script.installed'].url).toMatch(/example\.org/);
    });

    it('still accepts public IPv4', async () => {
      await PublicAPI.init();
      // 8.8.8.8 (Google DNS) — public, should pass.
      await PublicAPI.setWebhook('script.installed', {
        url: 'https://8.8.8.8/hook',
        enabled: true,
      });
      expect(PublicAPI.getWebhooks()['script.installed'].url).toContain('8.8.8.8');
    });

    it('rejects empty webhook URL host (malformed)', async () => {
      await PublicAPI.init();
      // `https://` with no host — URL constructor will fail or produce empty
      // hostname depending on the parser; either way we should reject.
      await expect(
        PublicAPI.setWebhook('script.installed', { url: 'https:///', enabled: true })
      ).rejects.toThrow();
    });
  });

  describe('trusted origins', () => {
    it('setTrustedOrigins + getTrustedOrigins', async () => {
      await PublicAPI.init();
      await PublicAPI.setTrustedOrigins(['https://example.com', 'https://test.com']);
      const origins = PublicAPI.getTrustedOrigins();
      expect(origins).toContain('https://example.com');
      expect(origins).toHaveLength(2);
    });

    it('returns copy (not reference)', async () => {
      await PublicAPI.init();
      await PublicAPI.setTrustedOrigins(['https://a.com']);
      const origins = PublicAPI.getTrustedOrigins();
      origins.push('https://injected.com');
      expect(PublicAPI.getTrustedOrigins()).toHaveLength(1);
    });

    it('normalizes origins to exact HTTPS origins and deduplicates them', async () => {
      await PublicAPI.init();
      await PublicAPI.setTrustedOrigins([
        ' https://example.com/path?query=1#frag ',
        'https://example.com/other',
        'https://test.com:443/install',
      ]);

      expect(PublicAPI.getTrustedOrigins()).toEqual([
        'https://example.com',
        'https://test.com',
      ]);
      expect(chrome.storage.local.set).toHaveBeenLastCalledWith({
        publicapi_trusted_origins: ['https://example.com', 'https://test.com'],
      });
    });

    it('rejects wildcard, insecure, and internal trusted origins without changing the current list', async () => {
      await PublicAPI.init();
      await PublicAPI.setTrustedOrigins(['https://safe.example']);

      await expect(PublicAPI.setTrustedOrigins(['*'])).rejects.toThrow(/wildcard/i);
      await expect(PublicAPI.setTrustedOrigins(['http://safe.example'])).rejects.toThrow(/https/i);
      await expect(PublicAPI.setTrustedOrigins(['https://localhost'])).rejects.toThrow(/internal|loopback/i);
      expect(PublicAPI.getTrustedOrigins()).toEqual(['https://safe.example']);
    });

    it('rejects canonical internal-host guard drift cases for trusted origins', async () => {
      await PublicAPI.init();
      await PublicAPI.setTrustedOrigins(['https://safe.example']);
      const blockedOrigins = [
        'https://evil.localhost',
        'https://192.0.2.1',
        'https://198.51.100.5',
        'https://203.0.113.254',
        'https://198.18.0.1',
        'https://240.0.0.1',
        'https://[::ffff:c0a8:0101]',
      ];

      for (const origin of blockedOrigins) {
        await expect(PublicAPI.setTrustedOrigins([origin])).rejects.toThrow(/internal|loopback/i);
      }
      expect(PublicAPI.getTrustedOrigins()).toEqual(['https://safe.example']);
    });

    it('drops legacy malformed trusted origins on load', async () => {
      globalThis.__resetStorageMock();
      await chrome.storage.local.set({
        publicapi_trusted_origins: [
          'https://legacy.example/path',
          '*',
          'http://insecure.example',
          'https://localhost',
        ],
      });
      PublicAPI = createFreshAPI();

      await PublicAPI.init();

      expect(PublicAPI.getTrustedOrigins()).toEqual(['https://legacy.example']);
    });

    it('uses normalized trusted origins when replying to web page messages', async () => {
      const source = { postMessage: vi.fn() };

      await PublicAPI.init();
      await PublicAPI.setTrustedOrigins(['https://trusted.example/install']);
      PublicAPI.handleWebMessage({
        origin: 'https://trusted.example',
        data: {
          type: 'scriptvault:isInstalled',
          name: 'Unknown Script',
        },
        source,
      });
      await flushPromises();

      expect(source.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'scriptvault:isInstalled:response',
          installed: false,
        }),
        'https://trusted.example',
      );
    });
  });

  describe('web install hardening', () => {
    it('rejects internal install URLs after authorization', async () => {
      const source = { postMessage: vi.fn() };

      await PublicAPI.init();
      await PublicAPI.setPermissions({ installScript: 'allow' });
      await PublicAPI.setTrustedOrigins(['https://trusted.example']);
      PublicAPI.handleWebMessage({
        origin: 'https://trusted.example',
        data: {
          type: 'scriptvault:install',
          url: 'https://localhost/script.user.js',
        },
        source,
      });
      await flushPromises();

      expect(source.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'scriptvault:install:response',
          error: 'Internal URLs are not allowed',
        }),
        'https://trusted.example',
      );
    });

    it('rejects PublicAPI install URLs covered by the canonical internal-host guard', async () => {
      const source = { postMessage: vi.fn() };

      await PublicAPI.init();
      await PublicAPI.setPermissions({ installScript: 'allow' });
      await PublicAPI.setTrustedOrigins(['https://trusted.example']);
      PublicAPI.handleWebMessage({
        origin: 'https://trusted.example',
        data: {
          type: 'scriptvault:install',
          url: 'https://evil.localhost/script.user.js',
        },
        source,
      });
      await flushPromises();

      expect(source.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'scriptvault:install:response',
          error: 'Internal URLs are not allowed',
        }),
        'https://trusted.example',
      );
    });

    it('enforces fetched script size and userscript header validation', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: vi.fn(() => String(5 * 1024 * 1024 + 1)) },
          text: vi.fn(),
        })
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: vi.fn(() => null) },
          text: vi.fn().mockResolvedValue('console.log("plain js");'),
        });
      PublicAPI = createFreshAPI({ fetchMock });
      const source = { postMessage: vi.fn() };

      await PublicAPI.init();
      await PublicAPI.setPermissions({ installScript: 'allow' });
      await PublicAPI.setTrustedOrigins(['https://trusted.example']);

      PublicAPI.handleWebMessage({
        origin: 'https://trusted.example',
        data: {
          type: 'scriptvault:install',
          url: 'https://cdn.example/big.user.js',
        },
        source,
      });
      await flushPromises();

      PublicAPI.handleWebMessage({
        origin: 'https://trusted.example',
        data: {
          type: 'scriptvault:install',
          url: 'https://cdn.example/plain.user.js',
        },
        source,
      });
      await flushPromises();

      expect(fetchMock).toHaveBeenCalledWith(
        'https://cdn.example/big.user.js',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
      expect(source.postMessage.mock.calls[0][0]).toMatchObject({
        type: 'scriptvault:install:response',
        error: 'Fetch failed',
        detail: 'Script file exceeds maximum allowed size (5 MB)',
      });
      expect(source.postMessage.mock.calls[1][0]).toMatchObject({
        type: 'scriptvault:install:response',
        error: 'Fetch failed',
        detail: 'Not a valid userscript (missing ==UserScript== header)',
      });
    });

    it('rejects redirects to internal install URLs before reading the response body', async () => {
      const text = vi.fn().mockResolvedValue([
        '// ==UserScript==',
        '// @name Redirected',
        '// ==/UserScript==',
        'console.log("redirected");',
      ].join('\n'));
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        url: 'https://127.0.0.1/redirected.user.js',
        headers: { get: vi.fn(() => null) },
        text,
      });
      PublicAPI = createFreshAPI({ fetchMock });
      const source = { postMessage: vi.fn() };

      await PublicAPI.init();
      await PublicAPI.setPermissions({ installScript: 'allow' });
      await PublicAPI.setTrustedOrigins(['https://trusted.example']);
      PublicAPI.handleWebMessage({
        origin: 'https://trusted.example',
        data: {
          type: 'scriptvault:install',
          url: 'https://cdn.example/redirect.user.js',
        },
        source,
      });
      await flushPromises();

      expect(text).not.toHaveBeenCalled();
      expect(source.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'scriptvault:install:response',
          error: 'Fetch failed',
          detail: 'Internal URLs are not allowed',
        }),
        'https://trusted.example',
      );
    });

    it('stops reading chunked installs that exceed the fetch cap without a content-length header', async () => {
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
        headers: { get: vi.fn(() => null) },
        body: { getReader: vi.fn(() => reader) },
        text,
      });
      PublicAPI = createFreshAPI({ fetchMock });
      const source = { postMessage: vi.fn() };

      await PublicAPI.init();
      await PublicAPI.setPermissions({ installScript: 'allow' });
      await PublicAPI.setTrustedOrigins(['https://trusted.example']);
      PublicAPI.handleWebMessage({
        origin: 'https://trusted.example',
        data: {
          type: 'scriptvault:install',
          url: 'https://cdn.example/chunked.user.js',
        },
        source,
      });
      await flushPromises();

      expect(reader.cancel).toHaveBeenCalled();
      expect(reader.releaseLock).toHaveBeenCalled();
      expect(text).not.toHaveBeenCalled();
      expect(source.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'scriptvault:install:response',
          error: 'Fetch failed',
          detail: 'Script file exceeds maximum allowed size (5 MB)',
        }),
        'https://trusted.example',
      );
    });
  });

  describe('audit log', () => {
    it('records actions', async () => {
      await PublicAPI.handleExternalMessage({ action: 'ping' }, { id: 'test' });
      const log = PublicAPI.getAuditLog();
      expect(log.length).toBeGreaterThan(0);
      expect(log[0].action).toBe('ping');
    });

    it('clearAuditLog empties the log', async () => {
      await PublicAPI.handleExternalMessage({ action: 'ping' }, { id: 'test' });
      await PublicAPI.clearAuditLog();
      expect(PublicAPI.getAuditLog()).toHaveLength(0);
    });
  });
});
