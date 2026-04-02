import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadFreshUserStyles() {
  vi.resetModules();
  return import('../src/modules/userstyles.ts');
}

function createVariableStyle() {
  return {
    meta: { name: 'Theme override' },
    css: 'body { color: /*[[accent]]*/; }',
    variables: [
      {
        type: 'color',
        name: 'accent',
        label: 'Accent',
        default: '#111111',
        options: null,
      },
    ],
    match: ['*://example.com/*'],
  };
}

describe('source userstyles module', () => {
  beforeEach(() => {
    globalThis.__resetStorageMock();
    vi.clearAllMocks();
    chrome.tabs.query.mockResolvedValue([
      { id: 1, url: 'https://example.com/page' },
    ]);
  });

  it('removes the previously injected CSS when variables change', async () => {
    const { UserStylesEngine } = await loadFreshUserStyles();

    const styleId = await UserStylesEngine.registerStyle(createVariableStyle());
    const originalCss = chrome.scripting.insertCSS.mock.calls.at(-1)?.[0]?.css;

    expect(originalCss).toContain('#111111');

    vi.clearAllMocks();
    chrome.tabs.query.mockResolvedValue([
      { id: 1, url: 'https://example.com/page' },
    ]);

    await UserStylesEngine.setVariables(styleId, { accent: '#ff5500' });

    expect(chrome.scripting.removeCSS).toHaveBeenCalledWith({
      target: { tabId: 1 },
      css: originalCss,
    });
    expect(chrome.scripting.insertCSS).toHaveBeenCalledWith({
      target: { tabId: 1 },
      css: 'body { color: #ff5500; }',
    });
  });

  it('removes the previously injected CSS when raw CSS changes', async () => {
    const { UserStylesEngine } = await loadFreshUserStyles();

    const styleId = await UserStylesEngine.registerStyle({
      meta: { name: 'Layout override' },
      css: 'body { background: black; }',
      match: ['*://example.com/*'],
    });
    const originalCss = chrome.scripting.insertCSS.mock.calls.at(-1)?.[0]?.css;

    expect(originalCss).toBe('body { background: black; }');

    vi.clearAllMocks();
    chrome.tabs.query.mockResolvedValue([
      { id: 1, url: 'https://example.com/page' },
    ]);

    await UserStylesEngine.updateCSS(styleId, 'body { background: white; }');

    expect(chrome.scripting.removeCSS).toHaveBeenCalledWith({
      target: { tabId: 1 },
      css: 'body { background: black; }',
    });
    expect(chrome.scripting.insertCSS).toHaveBeenCalledWith({
      target: { tabId: 1 },
      css: 'body { background: white; }',
    });
  });

  it('matches apex domains for wildcard subdomain patterns', async () => {
    const { UserStylesEngine } = await loadFreshUserStyles();

    chrome.tabs.query.mockResolvedValue([
      { id: 7, url: 'https://example.com/article' },
    ]);

    await UserStylesEngine.registerStyle({
      meta: { name: 'Imported Stylus style' },
      css: 'body { color: teal; }',
      match: ['*://*.example.com/*'],
    });

    expect(chrome.scripting.insertCSS).toHaveBeenCalledWith({
      target: { tabId: 7 },
      css: 'body { color: teal; }',
    });
  });

  it('avoids duplicate injections for overlapping tab updates on the same tab', async () => {
    const { UserStylesEngine } = await loadFreshUserStyles();

    chrome.tabs.query.mockResolvedValue([]);

    await UserStylesEngine.registerStyle({
      meta: { name: 'Navigation style' },
      css: 'body { color: navy; }',
      match: ['*://example.com/*'],
    });

    let resolveInsert;
    chrome.scripting.insertCSS.mockImplementationOnce(() => new Promise((resolve) => {
      resolveInsert = resolve;
    }));

    const firstUpdate = UserStylesEngine.onTabUpdated(11, 'https://example.com/page');
    const secondUpdate = UserStylesEngine.onTabUpdated(11, 'https://example.com/page');

    await vi.waitFor(() => {
      expect(chrome.scripting.insertCSS).toHaveBeenCalledTimes(1);
    });

    resolveInsert();
    await firstUpdate;
    await secondUpdate;

    expect(chrome.scripting.insertCSS).toHaveBeenCalledTimes(1);
  });

  it('preserves scoped match directives when converting UserCSS to a userscript', async () => {
    const { UserStylesEngine } = await loadFreshUserStyles();

    const source = `/* ==UserStyle==
@name Scoped style
@namespace scriptvault
@version 1.0.0
@match https://example.com/*
@match https://news.example.com/*
==/UserStyle== */
body { color: tomato; }`;

    const parsed = UserStylesEngine.parseUserCSS(source);
    const converted = UserStylesEngine.convertToUserscript(source);

    expect(parsed.match).toEqual([
      'https://example.com/*',
      'https://news.example.com/*',
    ]);
    expect(converted.script).toContain('// @match        https://example.com/*');
    expect(converted.script).toContain('// @match        https://news.example.com/*');
    expect(converted.script).not.toContain('// @match        *://*/*');
  });

  it('falls back to a wildcard match when UserCSS omits match metadata', async () => {
    const { UserStylesEngine } = await loadFreshUserStyles();

    const source = `/* ==UserStyle==
@name Global style
@namespace scriptvault
@version 1.0.0
==/UserStyle== */
body { color: tomato; }`;

    const parsed = UserStylesEngine.parseUserCSS(source);
    const converted = UserStylesEngine.convertToUserscript(source);

    expect(parsed.match).toEqual(['*://*/*']);
    expect(converted.script).toContain('// @match        *://*/*');
  });

  it('refreshes stored match patterns when full UserCSS metadata is edited', async () => {
    const { UserStylesEngine } = await loadFreshUserStyles();

    chrome.tabs.query.mockResolvedValue([]);

    const initialSource = `/* ==UserStyle==
@name Editable style
@namespace scriptvault
@version 1.0.0
@match https://example.com/*
==/UserStyle== */
body { color: tomato; }`;

    const updatedSource = `/* ==UserStyle==
@name Editable style
@namespace scriptvault
@version 1.0.1
@match https://docs.example.com/*
==/UserStyle== */
body { color: royalblue; }`;

    const initialParsed = UserStylesEngine.parseUserCSS(initialSource);
    const styleId = await UserStylesEngine.registerStyle({
      meta: initialParsed.meta,
      variables: initialParsed.variables,
      css: initialParsed.css,
      rawCode: initialSource,
      match: initialParsed.match,
    });

    await UserStylesEngine.updateCSS(styleId, updatedSource);

    expect(UserStylesEngine.getStyle(styleId)?.match).toEqual(['https://docs.example.com/*']);
  });
});
