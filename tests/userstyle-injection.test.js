import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileFunction } from 'node:vm';

const engineCode = readFileSync(resolve(process.cwd(), 'modules/userstyles.js'), 'utf8');
const factory = compileFunction(`${engineCode}\nreturn UserStylesEngine;`, ['chrome', 'console'], {
  filename: resolve(process.cwd(), 'modules/userstyles.js'),
});

// A chrome mock that models per-tab injected stylesheets so we can assert the
// injection lifecycle. `injected` maps tabId -> array of live CSS strings; a
// real navigation clears a tab's document CSS, which the tests simulate by
// resetting that array before dispatching a commit.
function makeChrome(store = {}) {
  const injected = new Map();
  let tabs = [];
  return {
    _injected: injected,
    _setTabs: (t) => { tabs = t; },
    _sheets: (tabId) => injected.get(tabId) || [],
    _clearDocument: (tabId) => injected.set(tabId, []),
    storage: {
      local: {
        get: async (keys) => {
          const list = Array.isArray(keys) ? keys : [keys];
          const out = {};
          for (const k of list) if (k in store) out[k] = store[k];
          return out;
        },
        set: async (obj) => { Object.assign(store, obj); },
      },
    },
    tabs: {
      query: async () => tabs.map((t) => ({ ...t })),
      get: async (id) => tabs.find((t) => t.id === id) || null,
    },
    scripting: {
      insertCSS: async ({ target, css }) => {
        const arr = injected.get(target.tabId) || [];
        arr.push(css);
        injected.set(target.tabId, arr);
      },
      removeCSS: async ({ target, css }) => {
        const arr = injected.get(target.tabId) || [];
        const idx = arr.indexOf(css);
        if (idx === -1) throw new Error('no such sheet');
        arr.splice(idx, 1);
        injected.set(target.tabId, arr);
      },
    },
  };
}

const STYLE = {
  meta: { name: 'Reds' },
  variables: [],
  css: 'body{color:red}',
  rawCode: '',
  match: ['*://example.com/*'],
  enabled: true,
};

describe('UserStyles persistent injection lifecycle', () => {
  let chrome;
  let engine;
  beforeEach(() => {
    chrome = makeChrome();
    engine = factory(chrome, console);
  });

  it('injects an enabled style into a matching tab on navigation', async () => {
    await engine.registerStyle({ ...STYLE });      // no tabs open yet -> no inject
    chrome._setTabs([{ id: 7, url: 'https://example.com/page' }]);
    await engine.onTabUpdated(7, 'https://example.com/page');
    expect(chrome._sheets(7)).toEqual(['body{color:red}']);
  });

  it('does not stack a duplicate sheet on a repeated onUpdated for the same document', async () => {
    await engine.registerStyle({ ...STYLE });
    chrome._setTabs([{ id: 7, url: 'https://example.com/page' }]);
    await engine.onTabUpdated(7, 'https://example.com/page');
    await engine.onTabUpdated(7, 'https://example.com/page');
    await engine.onTabUpdated(7, 'https://example.com/page');
    expect(chrome._sheets(7)).toHaveLength(1);
  });

  it('re-injects after a navigation (onTabNavigated resets the registry)', async () => {
    await engine.registerStyle({ ...STYLE });
    chrome._setTabs([{ id: 7, url: 'https://example.com/a' }]);
    await engine.onTabUpdated(7, 'https://example.com/a');
    expect(chrome._sheets(7)).toHaveLength(1);

    // Simulate a real commit: the new document starts with no injected CSS.
    chrome._clearDocument(7);
    engine.onTabNavigated(7);
    await engine.onTabUpdated(7, 'https://example.com/b');
    expect(chrome._sheets(7)).toEqual(['body{color:red}']);
  });

  it('removes a no-longer-matching sheet on an SPA route change (no document reset)', async () => {
    // Path-scoped style. On an SPA navigation the document is NOT reloaded, so
    // onTabNavigated is NOT called — onTabUpdated alone must drop the stale sheet.
    await engine.registerStyle({ ...STYLE, match: ['*://example.com/app/*'] });
    chrome._setTabs([{ id: 7, url: 'https://example.com/app/home' }]);
    await engine.onTabUpdated(7, 'https://example.com/app/home');
    expect(chrome._sheets(7)).toEqual(['body{color:red}']);

    // SPA route change to a non-matching path, same live document (no _clearDocument).
    await engine.onTabUpdated(7, 'https://example.com/settings/profile');
    expect(chrome._sheets(7)).toHaveLength(0);

    // Navigating back to a matching route re-injects.
    await engine.onTabUpdated(7, 'https://example.com/app/other');
    expect(chrome._sheets(7)).toEqual(['body{color:red}']);
  });

  it('does not inject into a non-matching tab', async () => {
    await engine.registerStyle({ ...STYLE });
    chrome._setTabs([{ id: 9, url: 'https://other.test/x' }]);
    await engine.onTabUpdated(9, 'https://other.test/x');
    expect(chrome._sheets(9)).toHaveLength(0);
  });

  it('removes the sheet from all tabs when a style is toggled off, then re-injects on enable', async () => {
    const id = await engine.registerStyle({ ...STYLE });
    chrome._setTabs([{ id: 7, url: 'https://example.com/p' }]);
    await engine.onTabUpdated(7, 'https://example.com/p');
    expect(chrome._sheets(7)).toHaveLength(1);

    await engine.toggleStyle(id, false);
    expect(chrome._sheets(7)).toHaveLength(0);

    await engine.toggleStyle(id, true);
    expect(chrome._sheets(7)).toEqual(['body{color:red}']);
  });

  it('onTabRemoved clears the per-tab registry so a later inject is treated as fresh', async () => {
    await engine.registerStyle({ ...STYLE });
    chrome._setTabs([{ id: 7, url: 'https://example.com/p' }]);
    await engine.onTabUpdated(7, 'https://example.com/p');
    engine.onTabRemoved(7);
    // Registry cleared: a repeated onTabUpdated (without a document reset) now
    // re-injects rather than deduping, proving the record was dropped.
    await engine.onTabUpdated(7, 'https://example.com/p');
    expect(chrome._sheets(7).length).toBeGreaterThan(1);
  });

  it('rehydrateOpenTabs re-applies enabled styles after a service-worker restart without duplicating an orphan', async () => {
    const store = {};
    const chromeA = makeChrome(store);
    const engineA = factory(chromeA, console);
    const id = await engineA.registerStyle({ ...STYLE });
    chromeA._setTabs([{ id: 7, url: 'https://example.com/p' }]);
    await engineA.onTabUpdated(7, 'https://example.com/p');
    expect(chromeA._sheets(7)).toEqual(['body{color:red}']);
    expect(id).toBeTruthy();

    // Simulate an SW restart: fresh engine, same persisted storage, and the tab
    // still carries the orphaned sheet the previous worker injected.
    const chromeB = makeChrome(store);
    chromeB._injected.set(7, ['body{color:red}']);
    chromeB._setTabs([{ id: 7, url: 'https://example.com/p' }]);
    const engineB = factory(chromeB, console);
    await engineB.rehydrateOpenTabs();
    expect(chromeB._sheets(7)).toEqual(['body{color:red}']);
  });
});
