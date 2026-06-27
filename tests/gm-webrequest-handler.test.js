import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GM_WEBREQUEST_ACTIONS,
  handleGMWebRequestMessage,
  isGMWebRequestAction,
} from '../src/background/gm-webrequest-handler.ts';

const originalScriptStorage = globalThis.ScriptStorage;
const originalSettingsManager = globalThis.SettingsManager;
const originalApplyWebRequestRules = globalThis.applyWebRequestRules;

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.ScriptStorage = {
    get: vi.fn().mockResolvedValue({
      id: 'script-1',
      meta: { grant: ['GM_webRequest'] },
    }),
  };
  globalThis.SettingsManager = {
    get: vi.fn().mockResolvedValue({ allowCspHeaderMutation: true }),
  };
  globalThis.applyWebRequestRules = vi.fn().mockResolvedValue({
    success: true,
    count: 2,
  });
});

afterEach(() => {
  globalThis.ScriptStorage = originalScriptStorage;
  globalThis.SettingsManager = originalSettingsManager;
  globalThis.applyWebRequestRules = originalApplyWebRequestRules;
});

describe('GM webRequest handler', () => {
  it('exposes the exact webRequest action set', () => {
    expect([...GM_WEBREQUEST_ACTIONS]).toEqual(['GM_webRequest']);
    expect(isGMWebRequestAction('GM_webRequest')).toBe(true);
    expect(isGMWebRequestAction('GM_loadScript')).toBe(false);
  });

  it('requires script context and GM_webRequest grant', async () => {
    await expect(handleGMWebRequestMessage('GM_webRequest', {}))
      .resolves.toEqual({ error: 'No script context' });

    globalThis.ScriptStorage.get.mockResolvedValueOnce({
      id: 'script-1',
      meta: { grant: ['GM_xmlhttpRequest'] },
    });
    await expect(handleGMWebRequestMessage('GM_webRequest', {
      scriptId: 'script-1',
      rules: [],
    })).resolves.toEqual({ error: 'Not granted' });
  });

  it('normalizes rules and applies them with script/settings context', async () => {
    const rule = { selector: { url: '*://example.com/*' }, action: { cancel: true } };

    await expect(handleGMWebRequestMessage(
      'GM_webRequest',
      { scriptId: 'payload-script', rules: rule },
      { userScriptId: 'sender-script' },
    )).resolves.toEqual({ success: true, count: 2 });

    expect(globalThis.ScriptStorage.get).toHaveBeenCalledWith('sender-script');
    expect(globalThis.SettingsManager.get).toHaveBeenCalledTimes(1);
    expect(globalThis.applyWebRequestRules).toHaveBeenCalledWith(
      'sender-script',
      [rule],
      {
        script: expect.objectContaining({ id: 'script-1' }),
        settings: { allowCspHeaderMutation: true },
      },
    );
  });

  it('falls back to rule length when apply result omits count', async () => {
    globalThis.applyWebRequestRules.mockResolvedValueOnce({ success: true });

    await expect(handleGMWebRequestMessage('GM_webRequest', {
      scriptId: 'script-1',
      rules: [{ id: 1 }, { id: 2 }],
    })).resolves.toEqual({ success: true, count: 2 });
  });

  it('propagates rule application failures with a stable fallback message', async () => {
    globalThis.applyWebRequestRules.mockResolvedValueOnce({
      success: false,
      error: 'target blocked',
    });
    await expect(handleGMWebRequestMessage('GM_webRequest', {
      scriptId: 'script-1',
      rules: [],
    })).resolves.toEqual({ error: 'target blocked' });

    globalThis.applyWebRequestRules.mockResolvedValueOnce({ success: false });
    await expect(handleGMWebRequestMessage('GM_webRequest', {
      scriptId: 'script-1',
      rules: [],
    })).resolves.toEqual({ error: 'GM_webRequest rule rejected' });
  });
});
