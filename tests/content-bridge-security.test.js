import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const contentBridgeCode = readFileSync(resolve(process.cwd(), 'content.js'), 'utf8');
const backgroundCoreCode = readFileSync(resolve(process.cwd(), 'background.core.js'), 'utf8');
const connectPolicyCode = readFileSync(resolve(process.cwd(), 'modules/connect-policy.js'), 'utf8');
const userScriptMessagePolicyCode = readFileSync(resolve(process.cwd(), 'modules/user-script-message-policy.js'), 'utf8');
const wrapperBuilderCode = readFileSync(resolve(process.cwd(), 'src/background/wrapper-builder.ts'), 'utf8');

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
    postMessage: vi.fn((data) => {
      queueMicrotask(() => {
        win.dispatchEvent(new win.MessageEvent('message', { source: win, data }));
      });
    }),
  };
  win.MessageEvent = class MessageEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.source = init.source ?? null;
      this.data = init.data;
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

function loadConnectPolicyHelpers() {
  const _body = `${connectPolicyCode}; return ConnectPolicy;`;
  try { const vm = require('node:vm'); return vm.compileFunction(_body, [], { filename: resolve(process.cwd(), 'modules/connect-policy.js') })(); } catch { return new Function(_body)(); }
}

function loadUserScriptMessagePolicy() {
  const _body = `${userScriptMessagePolicyCode}\nreturn UserScriptMessagePolicy;`;
  try { const vm = require('node:vm'); return vm.compileFunction(_body, [], { filename: resolve(process.cwd(), 'modules/user-script-message-policy.js') })(); } catch { return new Function(_body)(); }
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
  const chromeMock = {
    runtime: {
      id: 'gate-extension-id',
      onMessage: {
        addListener: (fn) => onMessageListeners.push(fn),
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
  const UserScriptMessagePolicy = loadUserScriptMessagePolicy();
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
      action: 'reportExecTime',
      data: { scriptId: 'script_alpha', time: 12 },
    });
  });

  it('keeps generated wrapper fallbacks telemetry-only and preserves GM_loadScript context', () => {
    for (const source of [backgroundCoreCode, wrapperBuilderCode]) {
      expect(source).toContain('function canUsePostMessageBridge(action)');
      expect(source).toContain('ScriptVault requires Chrome userScripts messaging for GM API calls.');
      expect(source).toContain("sendToBackground('GM_loadScript', { scriptId, url, timeout: options.timeout })");
    }
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
    const { onMessageListeners, handleMessageCalls } = loadUserScriptMessagingGate({ hasUserScriptMessage: false });
    const tabSender = {
      id: 'gate-extension-id',
      url: 'https://example.com/page',
      tab: { id: 7 },
    };
    const response = await invokeListener(
      onMessageListeners[0],
      { action: 'GM_setValue', data: { scriptId: 's', key: 'k', value: 1 } },
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

    const userScriptSender = { id: 'gate-extension-id', url: 'https://example.com/page' };
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
