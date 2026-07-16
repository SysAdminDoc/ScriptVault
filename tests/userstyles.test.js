import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const code = readFileSync(resolve(process.cwd(), 'modules/userstyles.js'), 'utf8');
const _body = code + '\nreturn UserStylesEngine;';
let _compiledFn;
try { const vm = require('node:vm'); _compiledFn = vm.compileFunction(_body, ['chrome', 'console'], { filename: resolve(process.cwd(), 'modules/userstyles.js') }); } catch { _compiledFn = new Function('chrome', 'console', _body); }

function createFreshUserStylesEngine() {
  return _compiledFn(globalThis.chrome, console);
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
@var color surface "Surface" #ffffff @light #ffffff @dark oklch(24% 0.02 255)
==/UserStyle== */
body { color: /*[[accent]]*/; border-color: var(--accentAlias); background: /*[[surface]]*/; }`;
}

let UserStylesEngine;

describe('UserStylesEngine runtime module', () => {
  beforeEach(() => {
    globalThis.__resetStorageMock();
    chrome.tabs.query.mockResolvedValue([
      { id: 1, url: 'https://example.com/page' },
    ]);
    chrome.tabs.get.mockResolvedValue({ id: 1, url: 'https://example.com/page' });
    UserStylesEngine = createFreshUserStylesEngine();
    vi.clearAllMocks();
  });

  it('removes the previously injected CSS when variables change', async () => {
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

  it('preserves scoped match directives when converting UserCSS to a userscript', () => {
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

  it('previews a UserCSS draft without persisting it', async () => {
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

  it('renders linked palettes and forced color-scheme values in the generated runtime', async () => {
    const result = await UserStylesEngine.previewDraft(createAdvancedUserCSSDraft(), {
      tabId: 1,
      colorScheme: 'dark',
      values: { accent: 'oklch(68% 0.2 250)' },
    });

    expect(result.success).toBe(true);
    expect(chrome.scripting.insertCSS).toHaveBeenLastCalledWith({
      target: { tabId: 1 },
      css: 'body { color: oklch(68% 0.2 250); border-color: oklch(68% 0.2 250); background: oklch(24% 0.02 255); }',
    });
  });

  it('renders automatic color-scheme values from the OS preference without relying on page color-scheme', async () => {
    const result = await UserStylesEngine.previewDraft(createAdvancedUserCSSDraft(), {
      tabId: 1,
      colorScheme: 'auto',
    });

    expect(result.success).toBe(true);
    const css = chrome.scripting.insertCSS.mock.calls.at(-1)?.[0]?.css;
    expect(css).toContain('background: #ffffff;');
    expect(css).toContain('@media (prefers-color-scheme: dark) {');
    expect(css).toContain('background: oklch(24% 0.02 255);');
    expect(css).not.toContain('light-dark(');
  });

  it('refreshes stored match patterns when full UserCSS metadata is edited', async () => {
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

describe('UserStyles wiring status (persistent install intentionally not wired)', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/modules/userstyles.ts'), 'utf8');
  const readme = readFileSync(resolve(process.cwd(), 'README.md'), 'utf8');

  it('preserves the complete persistent-install engine surface for the future wire', () => {
    const engine = createFreshUserStylesEngine();
    for (const method of [
      'registerStyle', 'unregisterStyle', 'toggleStyle', 'updateCSS',
      'getStyles', 'getStyle', 'importUserCSS', 'importStylusBackup',
      'isUserCSSUrl', 'onTabUpdated', 'onTabRemoved',
    ]) {
      expect(typeof engine[method]).toBe('function');
    }
  });

  it('documents the wiring status so the persistent surface is not mistaken for live code', () => {
    expect(source).toContain('WIRING STATUS');
    expect(source).toContain('NOT wired yet (persistent-install surface');
  });

  it('does not over-claim persistent installation in the README', () => {
    expect(readme).toContain('live draft preview');
    // The shipped UserCSS surface is preview + configuration, not persistent
    // per-tab installation. Guard against a doc claim the runtime cannot back.
    expect(readme).not.toMatch(/install(ed)? user\s?styles? (that )?persist/i);
  });
});
