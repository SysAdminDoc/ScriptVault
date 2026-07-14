import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  _pendingFetches,
  pendingInstallKeyForTab,
  registerWebNavigationListener,
} from '../src/background/install-handler.ts';

const coreSource = readFileSync('src/background/core.ts', 'utf8');
const installPageSource = readFileSync('pages/install.js', 'utf8');

function userscript(name) {
  return [
    '// ==UserScript==',
    `// @name ${name}`,
    '// @namespace pending-install-tests',
    '// @version 1.0.0',
    '// @match https://example.com/*',
    '// ==/UserScript==',
    `console.log(${JSON.stringify(name)});`,
  ].join('\n');
}

function installNavigationListener() {
  registerWebNavigationListener();
  const calls = chrome.webNavigation.onBeforeNavigate.addListener.mock.calls;
  return calls[calls.length - 1][0];
}

describe('pending userscript install isolation', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    globalThis.__resetStorageMock();
    _pendingFetches.clear();
    chrome.webNavigation.onBeforeNavigate.addListener.mockClear();
    chrome.tabs.update.mockClear();
    vi.restoreAllMocks();
    vi.stubGlobal('debugLog', vi.fn());
  });

  it('stores concurrent navigations under separate tab-scoped keys', async () => {
    const codeByUrl = new Map([
      ['https://scripts.example/alpha.user.js', userscript('Alpha')],
      ['https://scripts.example/bravo.user.js', userscript('Bravo')],
    ]);
    vi.stubGlobal('fetch', vi.fn(async url => new Response(codeByUrl.get(String(url)), { status: 200 })));
    const listener = installNavigationListener();

    await Promise.all([
      listener({ tabId: 11, frameId: 0, url: 'https://scripts.example/alpha.user.js' }),
      listener({ tabId: 22, frameId: 0, url: 'https://scripts.example/bravo.user.js' }),
    ]);

    const stored = await chrome.storage.local.get(null);
    expect(stored[pendingInstallKeyForTab(11)].code).toContain('@name Alpha');
    expect(stored[pendingInstallKeyForTab(22)].code).toContain('@name Bravo');
    expect(stored).not.toHaveProperty('pendingInstall');
    expect(chrome.tabs.update).toHaveBeenCalledWith(11, {
      url: 'chrome-extension://test-extension-id/pages/install.html#pendingInstall_tab-11',
    });
    expect(chrome.tabs.update).toHaveBeenCalledWith(22, {
      url: 'chrome-extension://test-extension-id/pages/install.html#pendingInstall_tab-22',
    });
  });

  it('shares one network fetch for the same URL but creates one review payload per tab', async () => {
    let resolveFetch;
    const fetchPromise = new Promise(resolve => { resolveFetch = resolve; });
    const fetchMock = vi.fn(() => fetchPromise);
    vi.stubGlobal('fetch', fetchMock);
    const listener = installNavigationListener();
    const url = 'https://scripts.example/shared.user.js';

    const first = listener({ tabId: 31, frameId: 0, url });
    const second = listener({ tabId: 32, frameId: 0, url });
    resolveFetch(new Response(userscript('Shared'), { status: 200 }));
    await Promise.all([first, second]);

    const stored = await chrome.storage.local.get(null);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(stored[pendingInstallKeyForTab(31)].code).toContain('@name Shared');
    expect(stored[pendingInstallKeyForTab(32)].code).toContain('@name Shared');
    expect(_pendingFetches.size).toBe(0);
  });

  it('keeps the runtime bridge and install page on the same keyed handoff contract', () => {
    expect(coreSource).toContain("_pendingInstallStorageKey(`tab-${numericTabId}`)");
    expect(coreSource).toContain('await _storePendingInstall(storageKey, result.pendingInstall)');
    expect(coreSource).toContain('url: _pendingInstallPageUrl(storageKey)');
    expect(coreSource).toContain("_createPendingInstallStorageKey('context-menu')");
    expect(installPageSource).toContain('pendingInstallStorageKey = resolvePendingInstallStorageKey()');
    expect(installPageSource).toContain('const pendingInstall = data[pendingInstallStorageKey]');
    expect(installPageSource).toContain('return chrome.storage.local.remove(pendingInstallStorageKey)');
    expect(installPageSource).toContain("const LEGACY_PENDING_INSTALL_STORAGE_KEY = 'pendingInstall'");
  });
});
