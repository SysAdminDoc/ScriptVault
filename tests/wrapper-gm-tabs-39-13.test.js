import { describe, it, expect } from 'vitest';
import { buildWrappedScript } from '../src/background/wrapper-builder.ts';

// Phase 39.13 (TM #2669) + Phase 40.5 + Phase 40.14 — GM_openInTab,
// GM_notification, and GM_download wrapper Map caps and the blob:-URL
// in-context routing. The runtime JS at `background.core.js` has carried
// these since the iter-1/iter-2 hardening waves; the typed mirror at
// `src/background/wrapper-builder.ts` was lagging until Phase 39.11's
// port. These tests pin both surfaces so the next drift is caught at CI.

function makeScript(grants) {
  return {
    id: 'gm-tabs-test',
    code: '// ==UserScript==\n// @name T\n// ==/UserScript==\n',
    enabled: true,
    position: 0,
    meta: {
      name: 'T',
      namespace: 'sv',
      version: '1',
      description: '',
      author: '',
      icon: '',
      icon64: '',
      homepage: '',
      homepageURL: '',
      website: '',
      source: '',
      updateURL: '',
      downloadURL: '',
      supportURL: '',
      license: '',
      copyright: '',
      contributionURL: '',
      match: ['https://example.com/*'],
      include: [],
      exclude: [],
      excludeMatch: [],
      matchTop: [],
      excludeTop: [],
      'run-at': 'document-idle',
      'inject-into': 'auto',
      noframes: false,
      unwrap: false,
      sandbox: '',
      'run-in': '',
      grant: grants,
      require: [],
      resource: {},
      connect: [],
      'top-level-await': false,
      webRequest: null,
      priority: 0,
      weight: 0,
      antifeature: [],
      tag: [],
      compatible: [],
      incompatible: [],
    },
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('Phase 39.13 — GM_openInTab blob URL re-routing', () => {
  it('contains the blob/data/about scheme detector', () => {
    const wrapped = buildWrappedScript(makeScript(['GM_openInTab']), [], 'test-ext-id', []);
    expect(wrapped).toContain('/^(blob|data|about):/i');
    expect(wrapped).toContain('isLocalOnly');
  });

  it('routes blob: URLs through window.open instead of chrome.tabs.create', () => {
    const wrapped = buildWrappedScript(makeScript(['GM_openInTab']), [], 'test-ext-id', []);
    expect(wrapped).toContain('window.open(url');
  });

  it('emits a clear pop-up-blocker warning when window.open returns null', () => {
    const wrapped = buildWrappedScript(makeScript(['GM_openInTab']), [], 'test-ext-id', []);
    expect(wrapped).toContain('GM_openInTab(blob:) blocked by pop-up settings');
  });

  it('still goes through sendToBackground for normal http(s) URLs', () => {
    const wrapped = buildWrappedScript(makeScript(['GM_openInTab']), [], 'test-ext-id', []);
    // The non-blob path uses sendToBackground('GM_openInTab', ...).
    expect(wrapped).toMatch(/sendToBackground\([^)]*['"]GM_openInTab['"]/);
  });
});

describe('Phase 40.5 / 40.14 — wrapper Map caps + eviction counters', () => {
  it('caps _openedTabs at 200 with an eviction counter', () => {
    const wrapped = buildWrappedScript(makeScript(['GM_openInTab']), [], 'test-ext-id', []);
    expect(wrapped).toContain('_OPENED_TABS_CAP = 200');
    expect(wrapped).toContain('_openedTabsEvicted');
  });

  it('caps _notifCallbacks at 500 with an eviction counter', () => {
    const wrapped = buildWrappedScript(makeScript(['GM_notification']), [], 'test-ext-id', []);
    expect(wrapped).toContain('_NOTIF_CALLBACKS_CAP = 500');
    expect(wrapped).toContain('_notifCallbacksEvicted');
  });

  it('caps _downloadCallbacks at 200 with an eviction counter', () => {
    const wrapped = buildWrappedScript(makeScript(['GM_download']), [], 'test-ext-id', []);
    expect(wrapped).toContain('_DOWNLOAD_CALLBACKS_CAP = 200');
    expect(wrapped).toContain('_downloadCallbacksEvicted');
  });

  it('logs the eviction count on the first eviction and every 100th thereafter', () => {
    const wrapped = buildWrappedScript(makeScript(['GM_openInTab']), [], 'test-ext-id', []);
    expect(wrapped).toContain('_openedTabsEvicted === 1 || _openedTabsEvicted % 100 === 0');
  });
});
