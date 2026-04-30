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
