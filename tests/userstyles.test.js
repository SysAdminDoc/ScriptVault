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

let UserStylesEngine;

describe('UserStylesEngine runtime module', () => {
  beforeEach(() => {
    globalThis.__resetStorageMock();
    chrome.tabs.query.mockResolvedValue([
      { id: 1, url: 'https://example.com/page' },
    ]);
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
