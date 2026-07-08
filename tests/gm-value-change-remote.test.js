import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { buildWrappedScript } from '../src/background/wrapper-builder.ts';

const ROOT = process.cwd();
let messageListeners = [];
let remoteValue;

function readSource(path) {
  return readFileSync(resolve(ROOT, path), 'utf8');
}

function makeScript(code) {
  return {
    id: 'script_value_remote',
    code: `// ==UserScript==
// @name GM Value Remote Test
// @namespace scriptvault-tests
// @version 1.0.0
// @grant GM_addValueChangeListener
// ==/UserScript==
${code}`,
    enabled: true,
    position: 0,
    createdAt: 1,
    updatedAt: 1,
    settings: {},
    meta: {
      name: 'GM Value Remote Test',
      namespace: 'scriptvault-tests',
      version: '1.0.0',
      description: '',
      author: '',
      match: [],
      include: [],
      exclude: [],
      excludeMatch: [],
      matchTop: [],
      excludeTop: [],
      grant: ['GM_addValueChangeListener'],
      require: [],
      requireProvenance: [],
      requireIdentity: [],
      resource: {},
      'run-at': 'document-idle',
      noframes: false,
      icon: '',
      icon64: '',
      homepage: '',
      homepageURL: '',
      website: '',
      source: '',
      updateURL: '',
      downloadURL: '',
      supportURL: '',
      connect: [],
      antifeature: [],
      unwrap: false,
      'inject-into': 'auto',
      module: '',
      sandbox: '',
      tag: [],
      'run-in': '',
      'top-level-await': false,
      license: '',
      copyright: '',
      contributionURL: '',
      compatible: [],
      incompatible: [],
      webRequest: null,
      config: [],
      priority: 0,
      weight: 0,
      crontab: '',
      esm: false,
    },
  };
}

function postValueChanged(data) {
  remoteValue = data.newValue;
  const event = {
    source: window,
    data: {
      channel: 'ScriptVault_test-extension-id',
      direction: 'to-userscript',
      type: 'valueChanged',
      scriptId: 'script_value_remote',
      key: 'count',
      ...data,
    },
  };
  for (const listener of messageListeners) {
    listener(event);
  }
}

async function waitForUserscriptBody() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (Array.isArray(window.__scriptVaultRemoteEvents)) return;
  }
  throw new Error('wrapped userscript body did not run');
}

describe('GM value-change remote semantics', () => {
  beforeEach(() => {
    messageListeners = [];
    remoteValue = undefined;
    chrome.runtime.sendMessage.mockImplementation((message) => {
      if (message.action === 'GM_getValue') return Promise.resolve(remoteValue);
      return Promise.resolve({});
    });
    const addEventListener = window.addEventListener.bind(window);
    vi.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
      if (type === 'message') messageListeners.push(listener);
      return addEventListener(type, listener, options);
    });
    delete window.__scriptVaultRemoteEvents;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('passes remote=false through wrapper callbacks for origin-tab writes', async () => {
    const wrapped = buildWrappedScript(makeScript(`
window.__scriptVaultRemoteEvents = [];
GM_addValueChangeListener('count', (name, oldValue, newValue, remote) => {
  window.__scriptVaultRemoteEvents.push([name, oldValue, newValue, remote]);
});
`), [], { count: 1 });

    try { const vm = require('node:vm'); vm.compileFunction(wrapped, [], { filename: resolve(ROOT, 'src/background/wrapper-builder.ts') })(); } catch { new Function(wrapped)(); }
    expect(messageListeners.length).toBeGreaterThan(0);
    await waitForUserscriptBody();
    expect(window.__scriptVaultRemoteEvents).toEqual([]);
    postValueChanged({ oldValue: 1, newValue: 2, remote: false });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(window.__scriptVaultRemoteEvents).toEqual([
      ['count', 1, 2, false],
    ]);
  });

  it('defaults wrapper callbacks to remote=true when the bridge omits the flag', async () => {
    const wrapped = buildWrappedScript(makeScript(`
window.__scriptVaultRemoteEvents = [];
GM_addValueChangeListener('count', (name, oldValue, newValue, remote) => {
  window.__scriptVaultRemoteEvents.push([name, oldValue, newValue, remote]);
});
`), [], { count: 2 });

    try { const vm = require('node:vm'); vm.compileFunction(wrapped, [], { filename: resolve(ROOT, 'src/background/wrapper-builder.ts') })(); } catch { new Function(wrapped)(); }
    expect(messageListeners.length).toBeGreaterThan(0);
    await waitForUserscriptBody();
    expect(window.__scriptVaultRemoteEvents).toEqual([]);
    postValueChanged({ oldValue: 2, newValue: 3 });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(window.__scriptVaultRemoteEvents).toEqual([
      ['count', 2, 3, true],
    ]);
  });

  it('keeps background tab fan-out and wrapper remote guards aligned', () => {
    for (const path of ['src/modules/storage.ts', 'modules/storage.js']) {
      const source = readSource(path);
      expect(source).toContain('const isOriginTab = senderTabId !== null && tab.id === senderTabId;');
      expect(source).toContain('remote: !isOriginTab');
    }

    for (const path of ['src/background/wrapper-builder.ts', 'src/background/core.ts', 'background.core.js']) {
      const source = readSource(path);
      expect(source).toContain("sendToBackground('GM_getValue', { scriptId, key: msg.key })");
      expect(source).toContain('listener.callback(msg.key, oldValue, newValue, msg.remote !== false);');
    }
  });
});
