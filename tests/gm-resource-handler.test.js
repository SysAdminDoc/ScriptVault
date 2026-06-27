import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GM_RESOURCE_ACTIONS,
  handleGMResourceMessage,
  isGMResourceAction,
} from '../src/background/gm-resource-handler.ts';

const originalScriptStorage = globalThis.ScriptStorage;
const originalResourceCache = globalThis.ResourceCache;
const originalEvaluateConnectPolicy = globalThis.evaluateConnectPolicy;
const originalInternalHostGuard = globalThis.InternalHostGuard;
const originalFetchTextBounded = globalThis._fetchTextBounded;
const originalMaxScriptSize = globalThis.MAX_SCRIPT_SIZE;
const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.ScriptStorage = {
    get: vi.fn().mockResolvedValue({
      id: 'script-1',
      meta: {
        resource: {
          icon: 'https://cdn.example.com/icon.png',
          lib: 'https://cdn.example.com/lib.js',
        },
      },
    }),
  };
  globalThis.ResourceCache = {
    fetchResource: vi.fn().mockResolvedValue('resource text'),
    getDataUri: vi.fn().mockResolvedValue('data:text/plain;base64,b2s='),
  };
  globalThis.evaluateConnectPolicy = vi.fn().mockReturnValue({ allowed: true });
  globalThis.InternalHostGuard = {
    classifyFetchUrl: vi.fn().mockReturnValue({ ok: true, message: '' }),
    classifyResponseUrl: vi.fn().mockReturnValue({ ok: true, message: '' }),
  };
  globalThis._fetchTextBounded = vi.fn().mockResolvedValue('window.loaded = true;');
  globalThis.MAX_SCRIPT_SIZE = 5 * 1024 * 1024;
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
  });
});

afterEach(() => {
  globalThis.ScriptStorage = originalScriptStorage;
  globalThis.ResourceCache = originalResourceCache;
  globalThis.evaluateConnectPolicy = originalEvaluateConnectPolicy;
  globalThis.InternalHostGuard = originalInternalHostGuard;
  globalThis._fetchTextBounded = originalFetchTextBounded;
  globalThis.MAX_SCRIPT_SIZE = originalMaxScriptSize;
  globalThis.fetch = originalFetch;
});

describe('GM resource handler', () => {
  it('exposes the exact resource action set', () => {
    expect([...GM_RESOURCE_ACTIONS]).toEqual([
      'GM_getResourceText',
      'GM_getResourceURL',
      'GM_loadScript',
    ]);
    expect(isGMResourceAction('GM_loadScript')).toBe(true);
    expect(isGMResourceAction('GM_notification')).toBe(false);
  });

  it('resolves declared resource text and data URLs with null fallbacks', async () => {
    await expect(handleGMResourceMessage('GM_getResourceText', {
      scriptId: 'script-1',
      name: 'icon',
    })).resolves.toBe('resource text');
    expect(globalThis.ResourceCache.fetchResource).toHaveBeenCalledWith('https://cdn.example.com/icon.png');

    await expect(handleGMResourceMessage('GM_getResourceURL', {
      scriptId: 'script-1',
      name: 'icon',
    })).resolves.toBe('data:text/plain;base64,b2s=');
    expect(globalThis.ResourceCache.getDataUri).toHaveBeenCalledWith('https://cdn.example.com/icon.png');

    await expect(handleGMResourceMessage('GM_getResourceText', {
      scriptId: 'script-1',
      name: 'missing',
    })).resolves.toBeNull();

    globalThis.ResourceCache.fetchResource.mockRejectedValueOnce(new Error('network'));
    await expect(handleGMResourceMessage('GM_getResourceText', {
      scriptId: 'script-1',
      name: 'lib',
    })).resolves.toBeNull();
  });

  it('validates GM_loadScript inputs and policy failures', async () => {
    await expect(handleGMResourceMessage('GM_loadScript', {}))
      .resolves.toEqual({ error: 'No URL provided' });
    await expect(handleGMResourceMessage('GM_loadScript', {
      url: 'https://cdn.example.com/lib.js',
    })).resolves.toEqual({ error: 'Missing script context' });

    globalThis.ScriptStorage.get.mockResolvedValueOnce(null);
    await expect(handleGMResourceMessage('GM_loadScript', {
      scriptId: 'script-1',
      url: 'https://cdn.example.com/lib.js',
    })).resolves.toEqual({ error: 'Script context not found' });

    globalThis.evaluateConnectPolicy.mockReturnValueOnce({
      allowed: false,
      error: '@connect blocked',
    });
    await expect(handleGMResourceMessage('GM_loadScript', {
      scriptId: 'script-1',
      url: 'https://blocked.example.com/lib.js',
    })).resolves.toEqual({ error: '@connect blocked' });

    globalThis.InternalHostGuard.classifyFetchUrl.mockReturnValueOnce({
      ok: false,
      message: 'internal host',
    });
    await expect(handleGMResourceMessage('GM_loadScript', {
      scriptId: 'script-1',
      url: 'https://127.0.0.1/lib.js',
    })).resolves.toEqual({ error: 'GM_loadScript URL rejected: internal host' });
  });

  it('fetches GM_loadScript through bounded response reading', async () => {
    await expect(handleGMResourceMessage('GM_loadScript', {
      scriptId: 'script-1',
      url: 'https://cdn.example.com/lib.js',
      timeout: 500,
    })).resolves.toEqual({ code: 'window.loaded = true;' });

    expect(globalThis.evaluateConnectPolicy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'script-1' }),
      'https://cdn.example.com/lib.js',
    );
    expect(globalThis.InternalHostGuard.classifyFetchUrl)
      .toHaveBeenCalledWith('https://cdn.example.com/lib.js', ['http:', 'https:']);
    expect(globalThis.fetch).toHaveBeenCalledWith('https://cdn.example.com/lib.js', {
      signal: expect.any(AbortSignal),
    });
    expect(globalThis.InternalHostGuard.classifyResponseUrl)
      .toHaveBeenCalledWith(expect.objectContaining({ ok: true }), ['http:', 'https:']);
    expect(globalThis._fetchTextBounded)
      .toHaveBeenCalledWith(expect.objectContaining({ ok: true }), 5 * 1024 * 1024, 'Script');
  });

  it('reports GM_loadScript HTTP, redirect, bounded-read, and empty-body failures', async () => {
    globalThis.fetch.mockResolvedValueOnce({ ok: false, status: 404 });
    await expect(handleGMResourceMessage('GM_loadScript', {
      scriptId: 'script-1',
      url: 'https://cdn.example.com/missing.js',
    })).resolves.toEqual({ error: 'HTTP 404' });

    globalThis.InternalHostGuard.classifyResponseUrl.mockReturnValueOnce({
      ok: false,
      message: 'internal host',
    });
    await expect(handleGMResourceMessage('GM_loadScript', {
      scriptId: 'script-1',
      url: 'https://cdn.example.com/redirect.js',
    })).resolves.toEqual({ error: 'GM_loadScript URL redirected to internal host' });

    globalThis._fetchTextBounded.mockRejectedValueOnce(new Error('Script is too large'));
    await expect(handleGMResourceMessage('GM_loadScript', {
      scriptId: 'script-1',
      url: 'https://cdn.example.com/huge.js',
    })).resolves.toEqual({ error: 'Script is too large' });

    globalThis._fetchTextBounded.mockResolvedValueOnce('');
    await expect(handleGMResourceMessage('GM_loadScript', {
      scriptId: 'script-1',
      url: 'https://cdn.example.com/empty.js',
    })).resolves.toEqual({ error: 'Empty response' });
  });
});
