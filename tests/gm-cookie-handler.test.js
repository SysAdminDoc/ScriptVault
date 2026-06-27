import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GM_COOKIE_ACTIONS,
  handleGMCookieMessage,
  isGMCookieAction,
} from '../src/background/gm-cookie-handler.ts';

const originalScriptStorage = globalThis.ScriptStorage;
const originalSettingsManager = globalThis.SettingsManager;
const originalIsHttpCookieUrl = globalThis.isHttpCookieUrl;
const originalNormalizeCookiePartitionKey = globalThis.normalizeCookiePartitionKey;
const originalResolveCookiePolicyTarget = globalThis.resolveCookiePolicyTarget;
const originalEvaluateScriptHostScopePolicy = globalThis.evaluateScriptHostScopePolicy;

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.ScriptStorage = {
    get: vi.fn().mockResolvedValue({ id: 'script-1', meta: { match: ['https://example.com/*'] } }),
  };
  globalThis.SettingsManager = {
    get: vi.fn().mockResolvedValue({ allowCookieAccess: true }),
  };
  globalThis.isHttpCookieUrl = vi.fn((url) => typeof url === 'string' && /^https?:\/\//.test(url));
  globalThis.normalizeCookiePartitionKey = vi.fn((value) => {
    if (value && value.bad) return { error: 'bad partition' };
    return { partitionKey: value ?? null };
  });
  globalThis.resolveCookiePolicyTarget = vi.fn((data, sender) => data.url || sender.tab?.url || (data.domain ? `https://${data.domain}/` : ''));
  globalThis.evaluateScriptHostScopePolicy = vi.fn().mockReturnValue({ allowed: true });
  chrome.cookies.getAll.mockResolvedValue([{ name: 'sid', value: '1' }]);
  chrome.cookies.set.mockResolvedValue({ name: 'sid', value: '2' });
  chrome.cookies.remove.mockResolvedValue({ name: 'sid' });
});

afterEach(() => {
  globalThis.ScriptStorage = originalScriptStorage;
  globalThis.SettingsManager = originalSettingsManager;
  globalThis.isHttpCookieUrl = originalIsHttpCookieUrl;
  globalThis.normalizeCookiePartitionKey = originalNormalizeCookiePartitionKey;
  globalThis.resolveCookiePolicyTarget = originalResolveCookiePolicyTarget;
  globalThis.evaluateScriptHostScopePolicy = originalEvaluateScriptHostScopePolicy;
});

describe('GM cookie handler', () => {
  it('exposes the exact cookie action set', () => {
    expect([...GM_COOKIE_ACTIONS]).toEqual([
      'GM_cookie_delete',
      'GM_cookie_list',
      'GM_cookie_set',
    ]);
    expect(isGMCookieAction('GM_cookie_list')).toBe(true);
    expect(isGMCookieAction('GM_webRequest')).toBe(false);
  });

  it('lists cookies with script policy and partition guards', async () => {
    await expect(handleGMCookieMessage(
      'GM_cookie_list',
      {
        scriptId: 'script-1',
        domain: 'example.com',
        name: 'sid',
        partitionKey: { topLevelSite: 'https://example.com' },
      },
      { tab: { url: 'https://example.com/page' } },
    )).resolves.toEqual({
      success: true,
      cookies: [{ name: 'sid', value: '1' }],
    });

    expect(globalThis.ScriptStorage.get).toHaveBeenCalledWith('script-1');
    expect(globalThis.evaluateScriptHostScopePolicy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'script-1' }),
      'https://example.com/page',
      'Cookie access',
      { allowCookieAccess: true },
    );
    expect(chrome.cookies.getAll).toHaveBeenCalledWith({
      domain: 'example.com',
      name: 'sid',
      partitionKey: { topLevelSite: 'https://example.com' },
    });
  });

  it('sets and deletes cookies with normalized details', async () => {
    await expect(handleGMCookieMessage('GM_cookie_set', {
      scriptId: 'script-1',
      url: 'https://example.com/',
      name: 'sid',
      value: '2',
      secure: true,
      partitionKey: { topLevelSite: 'https://example.com' },
    })).resolves.toEqual({ success: true, cookie: { name: 'sid', value: '2' } });

    expect(chrome.cookies.set).toHaveBeenCalledWith({
      url: 'https://example.com/',
      name: 'sid',
      value: '2',
      domain: undefined,
      path: '/',
      secure: true,
      httpOnly: false,
      expirationDate: undefined,
      sameSite: 'unspecified',
      partitionKey: { topLevelSite: 'https://example.com' },
    });

    await expect(handleGMCookieMessage('GM_cookie_delete', {
      scriptId: 'script-1',
      url: 'https://example.com/',
      name: 'sid',
    })).resolves.toEqual({ success: true });
    expect(chrome.cookies.remove).toHaveBeenCalledWith({
      url: 'https://example.com/',
      name: 'sid',
    });
  });

  it('returns validation and policy errors before Chrome cookie calls', async () => {
    await expect(handleGMCookieMessage('GM_cookie_list', {}))
      .resolves.toEqual({ error: 'Missing script context' });
    await expect(handleGMCookieMessage('GM_cookie_set', { scriptId: 'script-1' }))
      .resolves.toEqual({ error: 'url is required for cookie set' });
    await expect(handleGMCookieMessage('GM_cookie_delete', { scriptId: 'script-1', url: 'ftp://example.com/', name: 'sid' }))
      .resolves.toEqual({ error: 'url must be http(s)://' });

    globalThis.normalizeCookiePartitionKey.mockReturnValueOnce({ error: 'bad partition' });
    await expect(handleGMCookieMessage('GM_cookie_set', {
      scriptId: 'script-1',
      url: 'https://example.com/',
      name: 'sid',
      partitionKey: { bad: true },
    })).resolves.toEqual({ error: 'bad partition' });

    globalThis.evaluateScriptHostScopePolicy.mockReturnValueOnce({
      allowed: false,
      error: 'Cookie access blocked',
    });
    await expect(handleGMCookieMessage('GM_cookie_set', {
      scriptId: 'script-1',
      url: 'https://example.com/',
      name: 'sid',
    })).resolves.toEqual({ error: 'Cookie access blocked' });
  });

  it('returns Chrome cookie API error messages', async () => {
    chrome.cookies.getAll.mockRejectedValueOnce(new Error('cookie read failed'));
    await expect(handleGMCookieMessage('GM_cookie_list', {
      scriptId: 'script-1',
      url: 'https://example.com/',
    })).resolves.toEqual({ error: 'cookie read failed' });
  });
});
