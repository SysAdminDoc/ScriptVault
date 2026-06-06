import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

import { buildBackgroundWrappedScript } from '../src/background/background-wrapper.ts';

function script({ grant = ['GM_getValue', 'GM_setValue', 'GM_notification', 'GM_log'], code = '', meta = {} } = {}) {
  const metaBlock = [
    '// ==UserScript==',
    '// @name Background Wrapper Test',
    '// @namespace scriptvault.test',
    '// @version 1.0.0',
    '// @background',
    '// @crontab */5 * * * *',
    ...grant.map((item) => `// @grant ${item}`),
    '// ==/UserScript==',
  ].join('\n');
  return {
    id: 'background_wrapper_test',
    enabled: true,
    position: 0,
    createdAt: 1,
    updatedAt: 1,
    settings: {},
    stats: { runs: 0, totalTime: 0, avgTime: 0, lastRun: 0, errors: 0 },
    versionHistory: [],
    meta: {
      name: 'Background Wrapper Test',
      namespace: 'scriptvault.test',
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
      match: [],
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
      grant,
      require: [],
      requireProvenance: [],
      requireIdentity: [],
      resource: {},
      connect: [],
      'top-level-await': false,
      webRequest: null,
      config: [],
      priority: 0,
      weight: 0,
      background: true,
      crontab: '*/5 * * * *',
      antifeature: [],
      tag: [],
      compatible: [],
      incompatible: [],
      ...meta,
    },
    code: `${metaBlock}\n${code}`,
  };
}

describe('background wrapper scaffold', () => {
  it('rejects non-background scripts, @require, and DOM/page/tab grants', () => {
    expect(() => buildBackgroundWrappedScript(script({ meta: { background: false } }))).toThrow('@background');
    expect(() => buildBackgroundWrappedScript(script({ meta: { require: ['https://cdn.example.com/lib.js'] } }))).toThrow('@require');
    expect(() => buildBackgroundWrappedScript(script({ grant: ['GM_getValue', 'GM_addElement', 'GM_openInTab'] }))).toThrow('GM_addElement, GM_openInTab');
  });

  it('emits a DOM-less wrapper with blocked page globals and reviewed GM APIs only', () => {
    const wrapped = buildBackgroundWrappedScript(script());

    expect(wrapped).toContain("source: 'scriptvault-background-runner'");
    expect(wrapped).toContain("const window = __blockedGlobal('window');");
    expect(wrapped).toContain("const document = __blockedGlobal('document');");
    expect(wrapped).toContain("const GM_addElement = __blockedApi(\"GM_addElement\");");
    expect(wrapped).toContain('function GM_xmlhttpRequest(details)');
    expect(wrapped).toContain('function GM_notification(details, ondone)');
    expect(wrapped).not.toContain('window.GM_');
    expect(wrapped).not.toContain('document.createElement');
  });

  it('runs storage, logging, and notification calls through background messages', async () => {
    const sendMessage = vi.fn(async (payload) => ({ ok: true, action: payload.action }));
    const log = vi.fn();
    const wrapped = buildBackgroundWrappedScript(script({
      code: [
        'GM_log(GM_info.script.name);',
        'GM_setValue("count", GM_getValue("count", 0) + 1);',
        'GM_notification({ title: "done", text: String(GM_getValue("count")) });',
      ].join('\n'),
    }), { preloadedStorage: { count: 1 } });

    vm.runInNewContext(wrapped, {
      chrome: { runtime: { sendMessage } },
      console: { log },
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(log).toHaveBeenCalledWith('[ScriptVault background]', 'Background Wrapper Test');
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      source: 'scriptvault-background-runner',
      scriptId: 'background_wrapper_test',
      action: 'GM_setValue',
      data: { key: 'count', value: 2 },
    }));
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      action: 'GM_notification',
      data: { title: 'done', text: '2' },
    }));
  });

  it('fails closed when script code reaches DOM globals', () => {
    const sendMessage = vi.fn(async () => ({ ok: true }));
    const wrapped = buildBackgroundWrappedScript(script({
      code: 'document.body;',
    }));

    expect(() => vm.runInNewContext(wrapped, {
      chrome: { runtime: { sendMessage } },
      console: { log: vi.fn() },
    })).toThrow('document.body is unavailable in @background scripts');
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      action: 'backgroundScriptError',
      data: { message: 'document.body is unavailable in @background scripts' },
    }));
  });
});
