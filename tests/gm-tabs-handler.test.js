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
      trackClose: true,
    });
    expect(globalThis.SessionState.persistOpenTabTrackers).toHaveBeenCalledTimes(1);
  });

  it('scopes tab storage per script instead of sharing one bag per tab', async () => {
    const bags = {};
    globalThis.TabStorage = {
      get: vi.fn((tabId) => bags[tabId]),
      getAll: vi.fn(() => bags),
      set: vi.fn((tabId, data) => { bags[tabId] = data; }),
    };

    await expect(handleGMTabsMessage('GM_getTab', {}, {})).resolves.toEqual({});

    // Script A writes its tab state.
    await expect(handleGMTabsMessage(
      'GM_saveTab',
      { data: { count: 1 } },
      { tab: { id: 7 }, userScriptId: 'script-a' },
    )).resolves.toEqual({ success: true });

    // Script B on the same tab must neither see nor clobber it.
    await expect(handleGMTabsMessage(
      'GM_getTab',
      {},
      { tab: { id: 7 }, userScriptId: 'script-b' },
    )).resolves.toEqual({});

    await handleGMTabsMessage(
      'GM_saveTab',
      { data: { count: 99 } },
      { tab: { id: 7 }, userScriptId: 'script-b' },
    );

    await expect(handleGMTabsMessage(
      'GM_getTab',
      {},
      { tab: { id: 7 }, userScriptId: 'script-a' },
    )).resolves.toEqual({ count: 1 });

    await expect(handleGMTabsMessage('GM_saveTab', { data: { count: 1 } }, {}))
      .resolves.toEqual({ error: 'GM_saveTab requires a tab context' });
  });

  it("GM_getTabs returns only the calling script's entries, not every tab bag", async () => {
    const bags = {
      7: { 'script-a': { page: 'a7' }, 'script-b': { secret: 'b7' } },
      9: { 'script-b': { secret: 'b9' } },
    };
    globalThis.TabStorage = {
      get: vi.fn((tabId) => bags[tabId]),
      getAll: vi.fn(() => bags),
      set: vi.fn(),
    };

    await expect(handleGMTabsMessage('GM_getTabs', {}, { userScriptId: 'script-a' }))
      .resolves.toEqual({ 7: { page: 'a7' } });

    // Script A must not receive script B's state from any tab.
    const asA = await handleGMTabsMessage('GM_getTabs', {}, { userScriptId: 'script-a' });
    expect(JSON.stringify(asA)).not.toContain('secret');
  });

  it('prefers the authenticated sender identity over a caller-supplied scriptId', async () => {
    const bags = { 7: { 'real-script': { mine: true } } };
    globalThis.TabStorage = {
      get: vi.fn((tabId) => bags[tabId]),
      getAll: vi.fn(() => bags),
      set: vi.fn(),
    };

    // Forged data.scriptId must not win over sender.userScriptId.
    await expect(handleGMTabsMessage(
      'GM_getTab',
      { scriptId: 'real-script' },
      { tab: { id: 7 }, userScriptId: 'attacker' },
    )).resolves.toEqual({});
  });

  it('refuses to close a tab the script did not open', async () => {
    chrome.tabs.create.mockResolvedValueOnce({ id: 42 });
    await handleGMTabsMessage(
      'GM_openInTab',
      { url: 'https://example.com/', trackClose: true },
      { tab: { id: 7 }, userScriptId: 'owner' },
    );

    // A different script guessing the id gets nothing.
    await expect(handleGMTabsMessage(
      'GM_closeTab',
      { tabId: 42 },
      { tab: { id: 7 }, userScriptId: 'attacker' },
    )).resolves.toEqual({ error: 'GM_closeTab: tab was not opened by this script' });
    expect(chrome.tabs.remove).not.toHaveBeenCalled();

    // An arbitrary unrelated tab id is refused even for the owner.
    await expect(handleGMTabsMessage(
      'GM_closeTab',
      { tabId: 1234 },
      { tab: { id: 7 }, userScriptId: 'owner' },
    )).resolves.toEqual({ error: 'GM_closeTab: tab was not opened by this script' });
    expect(chrome.tabs.remove).not.toHaveBeenCalled();

    // The owner can close the tab it opened.
    await expect(handleGMTabsMessage(
      'GM_closeTab',
      { tabId: 42 },
      { tab: { id: 7 }, userScriptId: 'owner' },
    )).resolves.toEqual({ success: true });
    expect(chrome.tabs.remove).toHaveBeenCalledWith(42);
  });

  it('lets a script close its own tab and tolerates close failures', async () => {
    await expect(handleGMTabsMessage('GM_focusTab', {}, { tab: { id: 9 } }))
      .resolves.toEqual({ success: true });
    expect(chrome.tabs.update).toHaveBeenCalledWith(9, { active: true });

    chrome.tabs.remove.mockRejectedValueOnce(new Error('already closed'));
    await expect(handleGMTabsMessage('GM_closeTab', { tabId: 9 }, { tab: { id: 9 } }))
      .resolves.toEqual({ success: true });
    expect(chrome.tabs.remove).toHaveBeenCalledWith(9);
  });
});
