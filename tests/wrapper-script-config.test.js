import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildWrappedScript } from '../src/background/wrapper-builder.ts';

function makeScript(code) {
  return {
    id: 'script_config_test',
    code: `// ==UserScript==
// @name Config Test
// @match https://example.com/*
// @grant none
// ==/UserScript==
${code}`,
    enabled: true,
    position: 0,
    settings: {
      userConfig: {
        theme: 'light',
        enabled: false,
      },
    },
    meta: {
      name: 'Config Test',
      namespace: 'scriptvault-tests',
      version: '1.0.0',
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
      module: '',
      noframes: false,
      unwrap: false,
      sandbox: '',
      'run-in': '',
      grant: ['none'],
      require: [],
      requireProvenance: [],
      requireIdentity: [],
      resource: {},
      connect: [],
      'top-level-await': false,
      webRequest: null,
      config: [
        { type: 'text', name: 'theme', label: 'Theme', default: 'dark', options: null },
        { type: 'checkbox', name: 'enabled', label: 'Enabled', default: true, options: null },
      ],
      priority: 0,
      weight: 0,
      antifeature: [],
      tag: [],
      compatible: [],
      incompatible: [],
    },
    createdAt: 1,
    updatedAt: 1,
  };
}

async function flushWrappedScript() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
}

describe('wrapper script author configuration shims', () => {
  beforeEach(() => {
    chrome.runtime.sendMessage.mockResolvedValue({});
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete window.__svScriptConfigResult;
    delete window.CAT_userConfig;
    delete window.GM_config;
  });

  it('exposes saved @var values through CAT_userConfig, GM_config, and GM_info.script.config', async () => {
    const wrapped = buildWrappedScript(makeScript(`
window.__svScriptConfigResult = {
  direct: CAT_userConfig.theme,
  catGet: CAT_userConfig.get('theme'),
  fallback: CAT_userConfig.get('missing', 'fallback'),
  gmGet: window.GM_config.get('enabled'),
  gmSet: window.GM_config.set('theme', 'dark'),
  info: GM_info.script.config.theme
};
`));

    new Function(wrapped)();
    await flushWrappedScript();

    expect(window.__svScriptConfigResult).toEqual({
      direct: 'light',
      catGet: 'light',
      fallback: 'fallback',
      gmGet: false,
      gmSet: false,
      info: 'light',
    });
  });

  it('does not overwrite a GM_config library loaded by @require', async () => {
    const wrapped = buildWrappedScript(
      makeScript(`
window.__svScriptConfigResult = {
  gmGet: window.GM_config.get('theme'),
  catGet: CAT_userConfig.get('theme')
};
`),
      [{ url: 'https://example.com/gm-config.js', code: 'var GM_config = { get: () => "from-require" };' }],
    );

    new Function(wrapped)();
    await flushWrappedScript();

    expect(window.__svScriptConfigResult).toEqual({
      gmGet: 'from-require',
      catGet: 'light',
    });
  });
});
