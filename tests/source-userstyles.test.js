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

function createUserCSSDraft(match = 'https://example.com/*') {
  return `/* ==UserStyle==
@name Draft style
@namespace scriptvault
@version 1.0.0
@var color accent "Accent" #123456
@match ${match}
==/UserStyle== */
body { color: /*[[accent]]*/; }`;
}

function createAdvancedUserCSSDraft() {
  return `/* ==UserStyle==
@name Advanced palette
@namespace scriptvault
@version 1.0.0
@match https://example.com/*
@var color accent "Accent" hsl(260 75% 60%) @group brand
@var color accentAlias "Accent alias" hsl(260 75% 60%) @group brand
@var color surface "Surface" #ffffff @light hsl(0 0% 100%) @dark oklch(24% 0.02 255)
==/UserStyle== */
body { color: /*[[accent]]*/; border-color: var(--accentAlias); background: /*[[surface]]*/; }`;
}

describe('source userstyles module', () => {
  beforeEach(() => {
    globalThis.__resetStorageMock();
    vi.clearAllMocks();
    chrome.tabs.query.mockResolvedValue([
      { id: 1, url: 'https://example.com/page' },
    ]);
    chrome.tabs.get.mockResolvedValue({ id: 1, url: 'https://example.com/page' });
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

  it('previews a UserCSS draft without persisting it', async () => {
    const { UserStylesEngine } = await loadFreshUserStyles();

    const result = await UserStylesEngine.previewDraft(createUserCSSDraft(), { tabId: 1 });

    expect(result).toMatchObject({
      success: true,
      tabId: 1,
      styleName: 'Draft style',
    });
    expect(chrome.scripting.insertCSS).toHaveBeenCalledWith({
      target: { tabId: 1 },
      css: 'body { color: #123456; }',
    });
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  it.each(['Chrome', 'Firefox'])('renders advanced draft values identically for %s fixtures', async () => {
    const { UserStylesEngine } = await loadFreshUserStyles();

    const result = await UserStylesEngine.previewDraft(createAdvancedUserCSSDraft(), {
      tabId: 1,
      colorScheme: 'dark',
      values: { accent: 'oklab(70% -0.04 -0.12)' },
    });

    expect(result).toMatchObject({ success: true, styleName: 'Advanced palette' });
    expect(chrome.scripting.insertCSS).toHaveBeenLastCalledWith({
      target: { tabId: 1 },
      css: 'body { color: oklab(70% -0.04 -0.12); border-color: oklab(70% -0.04 -0.12); background: oklch(24% 0.02 255); }',
    });
  });

  it('persists linked palettes and round-trips conditional colors through UserCSS export', async () => {
    const { UserStylesEngine } = await loadFreshUserStyles();
    const imported = await UserStylesEngine.importUserCSS(createAdvancedUserCSSDraft());
    expect(imported.error).toBeUndefined();

    await UserStylesEngine.setVariables(imported.styleId, {
      accent: 'oklch(68% 0.2 250)',
      surface: { light: 'hsl(45 100% 96%)', dark: 'oklab(22% 0 -0.03)' },
    });
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      sv_userstyle_vars: expect.objectContaining({
        [imported.styleId]: expect.objectContaining({
          accent: 'oklch(68% 0.2 250)',
          accentAlias: 'oklch(68% 0.2 250)',
        }),
      }),
    });
    const configured = UserStylesEngine.getVariables(imported.styleId);
    expect(configured.find(variable => variable.name === 'accentAlias')?.current).toBe('oklch(68% 0.2 250)');
    expect(configured.find(variable => variable.name === 'surface')?.current).toEqual({
      light: 'hsl(45 100% 96%)',
      dark: 'oklab(22% 0 -0.03)',
    });

    const exported = UserStylesEngine.exportUserCSS(imported.styleId);
    expect(exported.error).toBeUndefined();
    expect(exported.code).toContain('@var color accent "Accent" oklch(68% 0.2 250) @group brand');
    expect(exported.code).toContain('@light hsl(45 100% 96%) @dark oklab(22% 0 -0.03)');

    const reimported = await UserStylesEngine.importUserCSS(exported.code);
    expect(reimported.error).toBeUndefined();
    const reparsed = UserStylesEngine.getStyle(reimported.styleId);
    expect(reparsed.variables.find(variable => variable.name === 'accent')?.group).toBe('brand');
    expect(reparsed.variables.find(variable => variable.name === 'surface')?.colorSchemes).toEqual({
      light: 'hsl(45 100% 96%)',
      dark: 'oklab(22% 0 -0.03)',
    });
  });

  it('rejects invalid persisted and preview color values before injection', async () => {
    const { UserStylesEngine } = await loadFreshUserStyles();
    const imported = await UserStylesEngine.importUserCSS(createAdvancedUserCSSDraft());

    await expect(UserStylesEngine.setVariables(imported.styleId, { accent: 'oklch(70% 0.2);body{}' }))
      .rejects.toThrow('unsafe CSS characters');
    const preview = await UserStylesEngine.previewDraft(createAdvancedUserCSSDraft(), {
      tabId: 1,
      values: { surface: { light: '#fff', dark: 'oklab(20% 0)' } },
    });
    expect(preview.error).toContain('requires three components');
  });

  it('removes an old UserCSS preview before applying a new draft', async () => {
    const { UserStylesEngine } = await loadFreshUserStyles();

    await UserStylesEngine.previewDraft(createUserCSSDraft(), { tabId: 1 });
    await UserStylesEngine.previewDraft(createUserCSSDraft('https://example.com/*').replace('#123456', '#abcdef'), { tabId: 1 });

    expect(chrome.scripting.removeCSS).toHaveBeenCalledWith({
      target: { tabId: 1 },
      css: 'body { color: #123456; }',
    });
    expect(chrome.scripting.insertCSS).toHaveBeenLastCalledWith({
      target: { tabId: 1 },
      css: 'body { color: #abcdef; }',
    });
  });

  it('clears a UserCSS draft preview on navigation', async () => {
    const { UserStylesEngine } = await loadFreshUserStyles();

    await UserStylesEngine.previewDraft(createUserCSSDraft(), { tabId: 1 });
    vi.clearAllMocks();
    await UserStylesEngine.onTabUpdated(1, 'https://example.com/next');

    expect(chrome.scripting.removeCSS).toHaveBeenCalledWith({
      target: { tabId: 1 },
      css: 'body { color: #123456; }',
    });
  });

  it('rejects a UserCSS preview when the active tab is outside @match scope', async () => {
    const { UserStylesEngine } = await loadFreshUserStyles();
    chrome.tabs.get.mockResolvedValue({ id: 1, url: 'https://example.com/page' });

    const result = await UserStylesEngine.previewDraft(createUserCSSDraft('https://other.example/*'), { tabId: 1 });

    expect(result.error).toContain('@match');
    expect(chrome.scripting.insertCSS).not.toHaveBeenCalled();
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
