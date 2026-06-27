import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GM_TABS_ACTIONS,
  handleGMTabsMessage,
  isGMTabsAction,
} from '../src/background/gm-tabs-handler.ts';

const originalTabStorage = globalThis.TabStorage;
const originalSessionState = globalThis.SessionState;
const originalOpenTabTrackers = globalThis._openTabTrackers;

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.__resetStorageMock();
  globalThis.TabStorage = {
    get: vi.fn((tabId) => ({ tabId, open: true })),
    getAll: vi.fn(() => ({ 7: { open: true } })),
    set: vi.fn(),
  };
  globalThis.SessionState = {
    persistOpenTabTrackers: vi.fn(),
  };
  globalThis._openTabTrackers = undefined;
});

afterEach(() => {
  globalThis.TabStorage = originalTabStorage;
  globalThis.SessionState = originalSessionState;
  globalThis._openTabTrackers = originalOpenTabTrackers;
});

describe('GM tabs handler', () => {
  it('exposes the exact tab action set', () => {
    expect([...GM_TABS_ACTIONS]).toEqual([
      'GM_closeTab',
      'GM_focusTab',
      'GM_getTab',
      'GM_getTabs',
      'GM_openInTab',
      'GM_saveTab',
    ]);
    expect(isGMTabsAction('GM_openInTab')).toBe(true);
    expect(isGMTabsAction('GM_registerMenuCommand')).toBe(false);
  });

  it('handles tab storage with the legacy no-tab fallbacks', async () => {
    await expect(handleGMTabsMessage('GM_getTab', {}, {})).resolves.toEqual({});
    await expect(handleGMTabsMessage('GM_getTab', {}, { tab: { id: 7 } }))
      .resolves.toEqual({ tabId: 7, open: true });

    await expect(handleGMTabsMessage('GM_saveTab', { data: { count: 1 } }, {}))
      .resolves.toEqual({ error: 'GM_saveTab requires a tab context' });
    await expect(handleGMTabsMessage('GM_saveTab', { data: { count: 1 } }, { tab: { id: 7 } }))
      .resolves.toEqual({ success: true });
    expect(globalThis.TabStorage.set).toHaveBeenCalledWith(7, { count: 1 });

    await expect(handleGMTabsMessage('GM_getTabs'))
      .resolves.toEqual({ 7: { open: true } });
  });

  it('validates open-tab URLs before calling chrome.tabs.create', async () => {
    await expect(handleGMTabsMessage('GM_openInTab', { url: 'javascript:alert(1)' }))
      .resolves.toEqual({ error: 'GM_openInTab: scheme "javascript:" is not allowed' });
    await expect(handleGMTabsMessage('GM_openInTab', { url: 'not a url' }))
      .resolves.toEqual({ error: 'GM_openInTab: invalid URL' });
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });

  it('opens tabs with placement, opener, and close tracking options', async () => {
    chrome.tabs.create.mockResolvedValueOnce({ id: 42 });

    await expect(handleGMTabsMessage(
      'GM_openInTab',
      {
        url: 'https://example.com/path',
        background: true,
        insert: true,
        setParent: true,
        trackClose: true,
        scriptId: 'script-1',
      },
      { tab: { id: 7, index: 3 } },
    )).resolves.toEqual({ success: true, tabId: 42 });

    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: 'https://example.com/path',
      active: false,
      index: 4,
      openerTabId: 7,
    });
    expect(globalThis._openTabTrackers.get(42)).toEqual({
      callerTabId: 7,
      scriptId: 'script-1',
    });
    expect(globalThis.SessionState.persistOpenTabTrackers).toHaveBeenCalledTimes(1);
  });

  it('focuses the sender tab and tolerates close failures', async () => {
    await expect(handleGMTabsMessage('GM_focusTab', {}, { tab: { id: 9 } }))
      .resolves.toEqual({ success: true });
    expect(chrome.tabs.update).toHaveBeenCalledWith(9, { active: true });

    chrome.tabs.remove.mockRejectedValueOnce(new Error('already closed'));
    await expect(handleGMTabsMessage('GM_closeTab', { tabId: 42 }))
      .resolves.toEqual({ success: true });
    expect(chrome.tabs.remove).toHaveBeenCalledWith(42);
  });
});
