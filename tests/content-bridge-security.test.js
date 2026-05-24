import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';

const contentBridgeCode = readFileSync(resolve(process.cwd(), 'content.js'), 'utf8');
const backgroundCoreCode = readFileSync(resolve(process.cwd(), 'background.core.js'), 'utf8');
const wrapperBuilderCode = readFileSync(resolve(process.cwd(), 'src/background/wrapper-builder.ts'), 'utf8');

function loadContentBridge() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'https://example.com/page',
    runScripts: 'outside-only',
  });
  const sendMessage = vi.fn().mockResolvedValue({ ok: true });
  const chromeMock = {
    runtime: {
      id: 'test-extension-id',
      sendMessage,
      onMessage: {
        addListener: vi.fn(),
      },
    },
  };

  const run = new dom.window.Function('chrome', contentBridgeCode);
  run(chromeMock);

  return {
    window: dom.window,
    chromeMock,
    channel: 'ScriptVault_test-extension-id',
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
  const start = backgroundCoreCode.indexOf('function normalizeConnectHost');
  const end = backgroundCoreCode.indexOf('if (chrome.runtime.onUserScriptMessage)', start);
  if (start === -1 || end === -1) {
    throw new Error('Unable to locate @connect helper functions in background.core.js');
  }
  const helperCode = backgroundCoreCode.slice(start, end);
  return new Function(`${helperCode}; return { evaluateConnectPolicy, normalizeConnectHost };`)();
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

  const factory = new Function(
    'chrome', 'handleMessage', 'debugLog',
    `${sliceCode}\nreturn { isExtensionSurfaceSender, isUserScriptAllowedAction, USER_SCRIPT_MESSAGING_AVAILABLE };`
  );
  const exports = factory(chromeMock, handleMessage, debugLog);

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
