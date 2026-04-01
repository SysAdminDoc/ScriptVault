import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const code = readFileSync(resolve(__dirname, '../modules/public-api.js'), 'utf8');

let PublicAPI;
function createFreshAPI() {
  const fn = new Function('chrome', 'console', 'crypto', 'fetch',
    code + '\nreturn PublicAPI;'
  );
  return fn(globalThis.chrome, console, globalThis.crypto, vi.fn().mockResolvedValue({ ok: true }));
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
