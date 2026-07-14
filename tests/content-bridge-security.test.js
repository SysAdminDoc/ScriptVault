import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildWrappedScript } from '../src/background/wrapper-builder.ts';

const contentBridgeCode = readFileSync(resolve(process.cwd(), 'content.js'), 'utf8');
const backgroundCoreCode = readFileSync(resolve(process.cwd(), 'background.core.js'), 'utf8');
const connectPolicyCode = readFileSync(resolve(process.cwd(), 'modules/connect-policy.js'), 'utf8');
const userScriptMessagePolicyCode = readFileSync(resolve(process.cwd(), 'modules/user-script-message-policy.js'), 'utf8');

function makeWrapperScript(code) {
  return {
    id: 'script_wrapper_bridge',
    code,
    enabled: true,
    position: 0,
    createdAt: 1,
    updatedAt: 1,
    settings: {},
    stats: { runs: 0, totalTime: 0, avgTime: 0, lastRun: 0, errors: 0 },
    versionHistory: [],
    meta: {
      name: 'Wrapper Bridge Contract',
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
      grant: ['GM_xmlhttpRequest'],
      require: [],
      resource: {},
      connect: ['cdn.example.com'],
      'top-level-await': false,
      webRequest: null,
      priority: 0,
      weight: 0,
      antifeature: [],
      tag: [],
      compatible: [],
      incompatible: [],
      config: [],
    },
  };
}

async function waitForWindowValue(key) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));
    if (window[key] !== undefined) return window[key];
  }
  throw new Error(`Wrapped userscript did not set window.${key}`);
}

function createBridgeWindow() {
  const listeners = new Map();
  const win = {
    setTimeout,
    clearTimeout,
    addEventListener: vi.fn((type, listener) => {
      const current = listeners.get(type) || [];
      current.push(listener);
      listeners.set(type, current);
    }),
    removeEventListener: vi.fn((type, listener) => {
      const current = listeners.get(type) || [];
      listeners.set(type, current.filter((item) => item !== listener));
    }),
    dispatchEvent: vi.fn((event) => {
      for (const listener of listeners.get(event.type) || []) {
        listener.call(win, event);
      }
      return true;
    }),
    postMessage: vi.fn((data, targetOrigin = '*') => {
      queueMicrotask(() => {
        win.dispatchEvent(new win.MessageEvent('message', { source: win, data, origin: targetOrigin }));
      });
    }),
  };
  win.MessageEvent = class MessageEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.source = init.source ?? null;
      this.data = init.data;
      this.origin = init.origin ?? '';
    }
  };
  return win;
}

function loadContentBridge() {
  const win = createBridgeWindow();
  const sendMessage = vi.fn().mockResolvedValue({ ok: true });
  const extensionId = `test-extension-id-${Math.random().toString(36).slice(2)}`;
  const chromeMock = {
    runtime: {
      id: extensionId,
      sendMessage,
      onMessage: {
        addListener: vi.fn(),
      },
    },
  };

  try { const vm = require('node:vm'); vm.compileFunction(contentBridgeCode, ['window', 'chrome'], { filename: resolve(process.cwd(), 'content.js') })(win, chromeMock); } catch { new Function('window', 'chrome', contentBridgeCode)(win, chromeMock); }

  return {
    window: win,
    chromeMock,
    channel: `ScriptVault_${extensionId}`,
  };
}

function waitForBridgeResponse(win, id) {
  return new Promise((resolvePromise, rejectPromise) => {
    const timeout = win.setTimeout(() => {
      win.removeEventListener('message', handler);
      rejectPromise(new Error(`Timed out waiting for bridge response ${id}`));
    }, 1000);

    function handler(event) {
      const msg = event.data;
      if (!msg || msg.direction !== 'to-userscript' || msg.id !== id) return;
      win.clearTimeout(timeout);
      win.removeEventListener('message', handler);
      resolvePromise(msg);
    }

    win.addEventListener('message', handler);
  });
}

function waitForPageMessage(win, predicate) {
  return new Promise((resolvePromise, rejectPromise) => {
    const timeout = win.setTimeout(() => {
      win.removeEventListener('message', handler);
      rejectPromise(new Error('Timed out waiting for page message'));
    }, 1000);

    function handler(event) {
      if (!predicate(event.data)) return;
      win.clearTimeout(timeout);
      win.removeEventListener('message', handler);
      resolvePromise(event.data);
    }

    win.addEventListener('message', handler);
  });
}

function loadConnectPolicyHelpers() {
  const _body = `${connectPolicyCode}; return ConnectPolicy;`;
  try { const vm = require('node:vm'); return vm.compileFunction(_body, [], { filename: resolve(process.cwd(), 'modules/connect-policy.js') })(); } catch { return new Function(_body)(); }
}

function loadUserScriptMessagePolicy(chromeMock = globalThis.chrome) {
  const _body = `${userScriptMessagePolicyCode}\nreturn UserScriptMessagePolicy;`;
  try { const vm = require('node:vm'); return vm.compileFunction(_body, ['chrome'], { filename: resolve(process.cwd(), 'modules/user-script-message-policy.js') })(chromeMock); } catch { return new Function('chrome', _body)(chromeMock); }
}

// Pull the user-script messaging gate (constants + helpers + onMessage/onUserScriptMessage
// listeners) out of background.core.js so we can drive both senders without booting the
// full SW. The slice runs end-to-end so the listener registrations execute against the
// supplied chrome mock and we can capture them.
function loadUserScriptMessagingGate({ hasUserScriptMessage = true } = {}) {
  // Background source is checked in with CRLF line endings on Windows; normalize so
  // the slice search and the eval'd code both use LF.
  const source = backgroundCoreCode.replace(/\r\n/g, '\n');
  const start = source.indexOf('// USER_SCRIPT world message listener');
  const debugMarker = "debugLog('User script message listener registered');";
  const debugIdx = source.indexOf(debugMarker, start);
  if (start === -1 || debugIdx === -1) {
    throw new Error('Unable to locate user-script messaging gate in background.core.js');
  }
  // Capture up to the closing `}` that ends the `if (chrome.runtime.onUserScriptMessage)` block.
  const closingBraceIdx = source.indexOf('}', debugIdx + debugMarker.length);
  if (closingBraceIdx === -1) {
    throw new Error('Unable to locate closing brace of onUserScriptMessage block');
  }
  const sliceCode = source.slice(start, closingBraceIdx + 1);

  const onMessageListeners = [];
  const onUserScriptListeners = [];
  const localStorage = {};
  const chromeMock = {
    runtime: {
      id: 'gate-extension-id',
      onMessage: {
        addListener: (fn) => onMessageListeners.push(fn),
      },
    },
    storage: {
      local: {
        get: async key => ({ [key]: localStorage[key] }),
        set: async entries => Object.assign(localStorage, entries),
      },
    },
  };
  if (hasUserScriptMessage) {
    chromeMock.runtime.onUserScriptMessage = {
      addListener: (fn) => onUserScriptListeners.push(fn),
    };
  }

  // Stub the handleMessage and debugLog symbols the slice references — we
  // only care that the gate decides what reaches handleMessage, not what
  // handleMessage itself does.
  const handleMessageCalls = [];
  const handleMessage = async (message, sender) => {
    handleMessageCalls.push({ message, sender });
    return { handled: true, action: message?.action };
  };
  const debugLog = () => {};
  const UserScriptMessagePolicy = loadUserScriptMessagePolicy(chromeMock);
  const ConnectPolicy = loadConnectPolicyHelpers();

  const _factoryBody = `${sliceCode}\nreturn { isExtensionSurfaceSender, isUserScriptAllowedAction, USER_SCRIPT_MESSAGING_AVAILABLE };`;
  const _factoryParams = ['chrome', 'handleMessage', 'debugLog', 'UserScriptMessagePolicy', 'ConnectPolicy'];
  const _factoryArgs = [chromeMock, handleMessage, debugLog, UserScriptMessagePolicy, ConnectPolicy];
  let exports;
  try { const vm = require('node:vm'); exports = vm.compileFunction(_factoryBody, _factoryParams, { filename: resolve(process.cwd(), 'background.core.js') })(..._factoryArgs); } catch { exports = new Function(..._factoryParams, _factoryBody)(..._factoryArgs); }

  return {
    chromeMock,
    onMessageListeners,
    onUserScriptListeners,
    handleMessageCalls,
    helpers: exports,
    userScriptMessagePolicy: UserScriptMessagePolicy,
  };
}

function invokeListener(listener, message, sender) {
  return new Promise((resolvePromise) => {
    const ret = listener(message, sender, (response) => resolvePromise(response));
    if (ret === false) {
      // Synchronous reject path already invoked sendResponse before returning.
    }
  });
}

describe('content script bridge security boundary', () => {
  it('does not expose privileged GM APIs through page-visible postMessage', async () => {
    const { window: win, chromeMock, channel } = loadContentBridge();

    expect(win.__ScriptVault_ChannelID__).toBeUndefined();
    expect(win.__ScriptVault_BridgeReady__).toBe(true);
    chromeMock.runtime.sendMessage.mockClear();

    const blocked = waitForBridgeResponse(win, 'attack');
    win.dispatchEvent(new win.MessageEvent('message', {
      source: win,
      data: {
        channel,
        direction: 'to-background',
        id: 'attack',
        action: 'GM_xmlhttpRequest',
        data: { url: 'https://attacker.example/collect' },
      },
    }));

    await expect(blocked).resolves.toMatchObject({
      success: false,
      error: 'Action not permitted via page-visible bridge',
    });
    expect(chromeMock.runtime.sendMessage).not.toHaveBeenCalled();

    const allowed = waitForBridgeResponse(win, 'telemetry');
    win.dispatchEvent(new win.MessageEvent('message', {
      source: win,
      data: {
        channel,
        direction: 'to-background',
        id: 'telemetry',
        action: 'reportExecTime',
        data: { scriptId: 'script_alpha', time: 12 },
      },
    }));

    await expect(allowed).resolves.toMatchObject({
      success: true,
      result: { ok: true },
    });
    expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
      action: 'recordBridgeTelemetry',
      data: { kind: 'execution-time', duration: 12 },
    });
  });

  it('relays trusted PublicAPI page messages without rebouncing responses', async () => {
    const { window: win, chromeMock } = loadContentBridge();
    const request = {
      type: 'scriptvault:isInstalled',
      name: 'Unknown Script',
    };
    const response = {
      type: 'scriptvault:isInstalled:response',
      installed: false,
    };
    chromeMock.runtime.sendMessage.mockResolvedValueOnce({ response });

    const pageResponse = waitForPageMessage(win, msg => msg?.type === 'scriptvault:isInstalled:response');
    win.dispatchEvent(new win.MessageEvent('message', {
      source: win,
      origin: 'https://trusted.example',
      data: request,
    }));

    await expect(pageResponse).resolves.toEqual(response);
    expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
      action: 'publicApi_handleWebMessage',
      origin: 'https://trusted.example',
      message: request,
    });

    chromeMock.runtime.sendMessage.mockClear();
    win.dispatchEvent(new win.MessageEvent('message', {
      source: win,
      origin: 'https://trusted.example',
      data: response,
    }));
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(chromeMock.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it('executes generated GM_loadScript through authenticated runtime messaging and refuses bridge fallback', async () => {
    const originalChrome = globalThis.chrome;
    const originalFetch = window.fetch;
    const originalXhr = window.XMLHttpRequest;
    const originalWebSocket = window.WebSocket;
    const originalBeacon = Object.getOwnPropertyDescriptor(window.navigator, 'sendBeacon');
    const postMessage = vi.spyOn(window, 'postMessage');
    const scriptAuthToken = 'a'.repeat(64);

    try {
      const sendMessage = vi.fn(async message => {
        if (message.action === 'GM_getValues') return {};
        if (message.action === 'GM_loadScript') {
          return { code: 'window.__svLoadedDependency = "direct-runtime";' };
        }
        return {};
      });
      globalThis.chrome = {
        runtime: {
          id: 'wrapper-extension-id',
          getManifest: () => ({ version: '3.20.0' }),
          sendMessage,
        },
      };
      const wrapped = buildWrappedScript(makeWrapperScript(`
GM_loadScript('https://cdn.example.com/library.js', { timeout: 2500 })
  .then(() => { window.__svLoadResult = window.__svLoadedDependency; })
  .catch(error => { window.__svLoadResult = error.message; });
`), [], {}, [], [], '', scriptAuthToken);

      new Function(wrapped)();
      await expect(waitForWindowValue('__svLoadResult')).resolves.toBe('direct-runtime');
      expect(sendMessage).toHaveBeenCalledWith({
        action: 'GM_loadScript',
        data: {
          scriptId: 'script_wrapper_bridge',
          url: 'https://cdn.example.com/library.js',
          timeout: 2500,
          scriptAuthToken,
        },
      });

      delete window.__svLoadResult;
      delete window.__svLoadedDependency;
      postMessage.mockClear();
      sendMessage.mockImplementation(async message => {
        if (message.action === 'GM_loadScript') throw new Error('messaging unavailable');
        if (message.action === 'GM_getValues') return {};
        return {};
      });
      const fallbackWrapped = buildWrappedScript(makeWrapperScript(`
GM_loadScript('https://cdn.example.com/fallback.js')
  .then(() => { window.__svLoadResult = 'unexpected success'; })
  .catch(error => { window.__svLoadResult = error.message; });
`), [], {}, [], [], '', scriptAuthToken);

      new Function(fallbackWrapped)();
      await expect(waitForWindowValue('__svLoadResult')).resolves.toContain(
        'ScriptVault requires Chrome userScripts messaging for GM API calls.',
      );
      expect(postMessage.mock.calls.some(([message]) => message?.action === 'GM_loadScript')).toBe(false);
    } finally {
      globalThis.chrome = originalChrome;
      window.fetch = originalFetch;
      window.XMLHttpRequest = originalXhr;
      window.WebSocket = originalWebSocket;
      if (originalBeacon) {
        Object.defineProperty(window.navigator, 'sendBeacon', originalBeacon);
      } else {
        Reflect.deleteProperty(window.navigator, 'sendBeacon');
      }
      delete window.__svLoadResult;
      delete window.__svLoadedDependency;
      postMessage.mockRestore();
    }
  });

  it('rejects generated malformed bridge messages without reaching extension privileges', async () => {
    const { window: win, chromeMock, channel } = loadContentBridge();
    chromeMock.runtime.sendMessage.mockClear();
    let seed = 0x51a7c0de;
    const next = () => {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      return seed;
    };
    const invalidActions = Array.from({ length: 64 }, (_, index) => {
      const candidates = [
        `GM_${next().toString(36)}`,
        `factoryReset${index}`,
        `reportExecTime ${index}`,
        index % 2 ? null : { action: 'reportExecTime' },
      ];
      return candidates[next() % candidates.length];
    });

    for (const [index, action] of invalidActions.entries()) {
      const id = `mutation-${index}`;
      const response = waitForBridgeResponse(win, id);
      win.dispatchEvent(new win.MessageEvent('message', {
        source: win,
        data: {
          channel,
          direction: 'to-background',
          id,
          action,
          data: { scriptId: 'victim', code: 'privileged' },
        },
      }));
      await expect(response, `mutation ${index}`).resolves.toMatchObject({
        success: false,
        error: 'Action not permitted via page-visible bridge',
      });
    }

    expect(chromeMock.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it('redacts sensitive background event payloads before posting to the page-visible bridge', () => {
    const { window: win, chromeMock, channel } = loadContentBridge();
    const listener = chromeMock.runtime.onMessage.addListener.mock.calls[0][0];
    const sendResponse = vi.fn();

    listener({
      action: 'xhrEvent',
      data: {
        requestId: 'xhr_1',
        scriptId: 'script_1',
        type: 'progress',
        response: 'secret-body',
        responseText: 'secret-text',
        responseHeaders: 'set-cookie: secret=1',
        responseXML: '<secret />',
        loaded: 10,
      },
    }, {}, sendResponse);
    const xhrPost = win.postMessage.mock.calls.at(-1)[0];
    expect(xhrPost).toMatchObject({
      channel,
      direction: 'to-userscript',
      type: 'xhrEvent',
      data: expect.objectContaining({ requestId: 'xhr_1', loaded: 10 }),
    });
    expect(xhrPost.data).not.toHaveProperty('response');
    expect(xhrPost.data).not.toHaveProperty('responseText');
    expect(xhrPost.data).not.toHaveProperty('responseHeaders');
    expect(xhrPost.data).not.toHaveProperty('responseXML');

    listener({
      action: 'webSocketEvent',
      data: {
        requestId: 'ws_1',
        scriptId: 'script_1',
        type: 'message',
        eventId: 'evt_1',
        payload: 'secret-message',
      },
    }, {}, sendResponse);
    const wsPost = win.postMessage.mock.calls.at(-1)[0];
    expect(wsPost.data).toEqual(expect.objectContaining({ requestId: 'ws_1', eventId: 'evt_1' }));
    expect(wsPost.data).not.toHaveProperty('payload');

    listener({
      action: 'valueChanged',
      data: {
        scriptId: 'script_1',
        key: 'token',
        oldValue: 'old-secret',
        newValue: 'new-secret',
        remote: true,
      },
    }, {}, sendResponse);
    const valuePost = win.postMessage.mock.calls.at(-1)[0];
    expect(valuePost).toMatchObject({
      type: 'valueChanged',
      key: 'token',
      remote: true,
    });
    expect(valuePost).not.toHaveProperty('oldValue');
    expect(valuePost).not.toHaveProperty('newValue');
  });

  it('normalizes @connect hosts before allowing privileged network calls', () => {
    const { evaluateConnectPolicy, normalizeConnectHost } = loadConnectPolicyHelpers();
    const script = {
      meta: {
        name: 'Connect Test',
        match: ['https://*.example.org/*'],
        include: [],
        connect: ['*.api.example.com', 'https://cdn.example.net/assets/*', 'self', 'localhost'],
      },
    };

    expect(normalizeConnectHost('https://*.Example.com/path')).toBe('example.com');
    expect(evaluateConnectPolicy(script, 'https://v1.api.example.com/data')).toMatchObject({ allowed: true });
    expect(evaluateConnectPolicy(script, 'https://cdn.example.net/assets/lib.js')).toMatchObject({ allowed: true });
    expect(evaluateConnectPolicy(script, 'https://app.example.org/page')).toMatchObject({ allowed: true });
    expect(evaluateConnectPolicy(script, 'http://127.0.0.1:8080/health')).toMatchObject({ allowed: true });
    expect(evaluateConnectPolicy(script, 'https://attacker.example/data')).toMatchObject({
      allowed: false,
      error: 'Connection to attacker.example blocked by @connect policy',
    });
    expect(evaluateConnectPolicy(script, 'not a url')).toMatchObject({
      allowed: false,
      error: 'Invalid URL',
    });
  });

  it('limits privileged network calls to script host scope unless @connect widens it', () => {
    const { evaluateConnectPolicy, isScriptHostScopeAllowed } = loadConnectPolicyHelpers();
    const scopedScript = {
      meta: {
        name: 'Scoped',
        match: ['https://example.com/*'],
        include: [],
        connect: [],
      },
      settings: {},
    };

    expect(isScriptHostScopeAllowed(scopedScript, 'https://example.com/api')).toBe(true);
    expect(evaluateConnectPolicy(scopedScript, 'https://example.com/api')).toMatchObject({ allowed: true });
    expect(evaluateConnectPolicy(scopedScript, 'https://other.com/api')).toMatchObject({
      allowed: false,
      error: 'Connection to other.com blocked by script host scope',
    });

    expect(evaluateConnectPolicy({
      ...scopedScript,
      meta: { ...scopedScript.meta, connect: ['other.com'] },
    }, 'https://other.com/api')).toMatchObject({ allowed: true });
  });

  it('keeps cookie host scope separate from @connect unless the high-privilege override is enabled', () => {
    const { evaluateScriptHostScopePolicy } = loadConnectPolicyHelpers();
    const scopedScript = {
      meta: {
        name: 'Cookie Scope',
        match: ['https://example.com/*'],
        include: [],
        connect: ['other.com'],
      },
      settings: {},
    };

    expect(evaluateScriptHostScopePolicy(scopedScript, 'https://example.com/', 'Cookie access', {})).toMatchObject({ allowed: true });
    expect(evaluateScriptHostScopePolicy(scopedScript, 'https://other.com/', 'Cookie access', {})).toMatchObject({
      allowed: false,
      error: 'Cookie access to other.com blocked by script host scope',
    });
    expect(evaluateScriptHostScopePolicy(scopedScript, 'https://other.com/', 'Cookie access', {
      allowHighPrivilegeScriptApis: true,
    })).toMatchObject({ allowed: true });
  });

  it('keeps internal GM_xhr blocked unless explicitly opted in', () => {
    const { shouldAllowInternalXhr } = loadConnectPolicyHelpers();
    const internalCheck = { ok: false, reason: 'ipv4-internal' };
    const wildcardScript = {
      meta: {
        name: 'Wildcard Connect',
        connect: ['*'],
      },
    };
    const localhostScript = {
      meta: {
        name: 'Local Dev',
        connect: ['localhost'],
      },
    };

    expect(shouldAllowInternalXhr(wildcardScript, 'http://127.0.0.1:8080/health', { allowInternalXhr: false }, internalCheck)).toBe(false);
    expect(shouldAllowInternalXhr(localhostScript, 'http://127.0.0.1:8080/health', { allowInternalXhr: false }, internalCheck)).toBe(true);
    expect(shouldAllowInternalXhr(wildcardScript, 'http://169.254.169.254/latest/meta-data/', { allowInternalXhr: false }, internalCheck)).toBe(false);
    expect(shouldAllowInternalXhr(wildcardScript, 'http://169.254.169.254/latest/meta-data/', { allowInternalXhr: true }, internalCheck)).toBe(true);
  });
});

describe('runtime.onMessage user-script gate (Chrome <131 / Firefox fallback)', () => {
  it('rejects tab-origin actions that are not in the user-script allowlist', async () => {
    const { onMessageListeners, handleMessageCalls } = loadUserScriptMessagingGate({ hasUserScriptMessage: false });
    expect(onMessageListeners).toHaveLength(1);

    const tabSender = {
      id: 'gate-extension-id',
      url: 'https://victim.example/page',
      tab: { id: 99 },
    };
    const response = await invokeListener(onMessageListeners[0], { action: 'factoryReset' }, tabSender);
    expect(response).toEqual({ error: 'Action not permitted from non-extension context' });
    expect(handleMessageCalls).toHaveLength(0);
  });

  it('allows GM_* actions from tab-origin senders (user-script fallback path)', async () => {
    const { onMessageListeners, handleMessageCalls, userScriptMessagePolicy } = loadUserScriptMessagingGate({ hasUserScriptMessage: false });
    const tabSender = {
      id: 'gate-extension-id',
      url: 'https://example.com/page',
      tab: { id: 7 },
    };
    const scriptAuthToken = await userScriptMessagePolicy.getScriptAuthToken('s');
    const response = await invokeListener(
      onMessageListeners[0],
      { action: 'GM_setValue', data: { scriptId: 's', scriptAuthToken, key: 'k', value: 1 } },
      tabSender
    );
    expect(response).toEqual({ handled: true, action: 'GM_setValue' });
    expect(handleMessageCalls).toHaveLength(1);
  });

  it('allows extension-surface senders to call any handleMessage action', async () => {
    const { onMessageListeners, handleMessageCalls } = loadUserScriptMessagingGate({ hasUserScriptMessage: true });
    const dashboardSender = {
      id: 'gate-extension-id',
      url: 'chrome-extension://gate-extension-id/pages/dashboard.html',
      tab: { id: 12 },
    };
    const response = await invokeListener(
      onMessageListeners[0],
      { action: 'factoryReset' },
      dashboardSender
    );
    expect(response).toEqual({ handled: true, action: 'factoryReset' });
    expect(handleMessageCalls).toHaveLength(1);
  });

  it('allows Firefox moz-extension pages from this extension to call privileged actions', async () => {
    const { onMessageListeners, handleMessageCalls } = loadUserScriptMessagingGate({ hasUserScriptMessage: true });
    const dashboardSender = {
      id: 'gate-extension-id',
      url: 'moz-extension://12345678-1234-1234-1234-123456789abc/pages/dashboard.html',
      tab: { id: 14 },
    };
    const response = await invokeListener(
      onMessageListeners[0],
      { action: 'saveScript', code: '// ==UserScript==\n// @name x\n// ==/UserScript==' },
      dashboardSender
    );
    expect(response).toEqual({ handled: true, action: 'saveScript' });
    expect(handleMessageCalls).toHaveLength(1);
  });

  it('does not trust moz-extension-looking URLs from other extension senders', async () => {
    const { onMessageListeners, handleMessageCalls } = loadUserScriptMessagingGate({ hasUserScriptMessage: true });
    const spoofed = {
      id: 'other-extension-id',
      url: 'moz-extension://12345678-1234-1234-1234-123456789abc/pages/dashboard.html',
      tab: { id: 14 },
    };
    const response = await invokeListener(
      onMessageListeners[0],
      { action: 'factoryReset' },
      spoofed
    );
    expect(response).toEqual({ error: 'Action not permitted from non-extension context' });
    expect(handleMessageCalls).toHaveLength(0);
  });

  it('rejects spoofed sender.url that does not match this extension origin', async () => {
    const { onMessageListeners, handleMessageCalls } = loadUserScriptMessagingGate({ hasUserScriptMessage: true });
    const spoofed = {
      id: 'gate-extension-id',
      url: 'chrome-extension://OTHER-EXTENSION-ID/pages/dashboard.html',
      tab: { id: 12 },
    };
    const response = await invokeListener(
      onMessageListeners[0],
      { action: 'factoryReset' },
      spoofed
    );
    expect(response).toEqual({ error: 'Action not permitted from non-extension context' });
    expect(handleMessageCalls).toHaveLength(0);
  });

  it('registers the dedicated onUserScriptMessage listener when the API exists', async () => {
    const { onUserScriptListeners, handleMessageCalls, helpers } = loadUserScriptMessagingGate({ hasUserScriptMessage: true });
    expect(helpers.USER_SCRIPT_MESSAGING_AVAILABLE).toBe(true);
    expect(onUserScriptListeners).toHaveLength(1);

    const userScriptSender = { id: 'gate-extension-id', url: 'https://example.com/page', userScriptId: 'script-1' };
    const blocked = await invokeListener(
      onUserScriptListeners[0],
      { action: 'factoryReset' },
      userScriptSender
    );
    expect(blocked).toEqual({ error: 'Action not permitted from user script' });

    const allowed = await invokeListener(
      onUserScriptListeners[0],
      { action: 'GM_xmlhttpRequest', data: { url: 'https://example.com/' } },
      userScriptSender
    );
    expect(allowed).toEqual({ handled: true, action: 'GM_xmlhttpRequest' });
    expect(handleMessageCalls).toHaveLength(1);
  });

  it('does not register the dedicated listener and reports unavailable on older runtimes', () => {
    const { onUserScriptListeners, helpers } = loadUserScriptMessagingGate({ hasUserScriptMessage: false });
    expect(helpers.USER_SCRIPT_MESSAGING_AVAILABLE).toBe(false);
    expect(onUserScriptListeners).toHaveLength(0);
  });
});
