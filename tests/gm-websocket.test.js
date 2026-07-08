import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildWrappedScript } from '../src/background/wrapper-builder.ts';

function makeScript(code, grant = ['GM_webSocket']) {
  const meta = {
    name: 'GM WebSocket Test',
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
    'run-at': 'document-idle',
    'inject-into': 'auto',
    noframes: false,
    unwrap: false,
    sandbox: '',
    'run-in': '',
    grant,
    require: [],
    resource: {},
    connect: ['api.example.com'],
    'top-level-await': false,
    webRequest: null,
    priority: 0,
    antifeature: [],
    tag: [],
    compatible: [],
    incompatible: [],
  };

  return {
    id: 'script_ws',
    enabled: true,
    position: 0,
    createdAt: 1,
    updatedAt: 1,
    settings: {},
    stats: { runs: 0, totalTime: 0, avgTime: 0, lastRun: 0, errors: 0 },
    versionHistory: [],
    meta,
    code: `// ==UserScript==
// @name GM WebSocket Test
// @match https://example.com/*
// @connect api.example.com
// @grant ${grant[0] || 'none'}
// ==/UserScript==
${code}`,
  };
}

async function flushWrappedScript() {
  await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));
  await Promise.resolve();
}

function postWebSocketEvent(eventType, extra = {}) {
  const eventId = `evt_${eventType}_${Date.now()}`;
  const bridgeData = eventType === 'message' ? { eventId } : {
    requestId: 'ws_test',
    scriptId: 'script_ws',
    type: eventType,
    ...extra,
  };
  if (eventType === 'message') {
    bridgeData.eventId = eventId;
  }
  window.dispatchEvent(new MessageEvent('message', {
    source: window,
    data: {
      channel: 'ScriptVault_test-extension-id',
      direction: 'to-userscript',
      type: 'webSocketEvent',
      requestId: 'ws_test',
      scriptId: 'script_ws',
      eventType,
      data: bridgeData,
    },
  }));
}

describe('GM_webSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Reflect.deleteProperty(window, '__ws');
    Reflect.deleteProperty(window, '__wsEvents');
    Reflect.deleteProperty(window, '__wsDenied');
  });

  it('exposes a WebSocket-like handle and relays background events', async () => {
    const calls = [];
    chrome.runtime.sendMessage.mockImplementation((message) => {
      calls.push(message);
      if (message.action === 'GM_webSocket') return Promise.resolve({ requestId: 'ws_test' });
      if (message.action === 'GM_webSocket_send') return Promise.resolve({ success: true });
      if (message.action === 'GM_webSocket_close') return Promise.resolve({ success: true });
      if (message.action === 'GM_webSocket_takeEvent') {
        return Promise.resolve({ success: true, event: { payload: 'pong', origin: '' } });
      }
      return Promise.resolve({});
    });

    const wrapped = buildWrappedScript(makeScript(`
window.__wsEvents = [];
window.__ws = GM_webSocket({
  url: 'wss://api.example.com/socket',
  protocols: ['scriptvault'],
  onopen(event) { window.__wsEvents.push('open:' + event.type + ':' + this.protocol); },
  onmessage(event) { window.__wsEvents.push('message:' + event.data); },
  onclose(event) { window.__wsEvents.push('close:' + event.code + ':' + event.reason); },
});
window.__ws.addEventListener('open', () => window.__wsEvents.push('open-listener'));
`));

    new Function(wrapped)();
    await flushWrappedScript();

    expect(calls).toContainEqual({
      action: 'GM_webSocket',
      data: {
        scriptId: 'script_ws',
        url: 'wss://api.example.com/socket',
        protocols: ['scriptvault'],
        binaryType: 'arraybuffer',
      },
    });

    postWebSocketEvent('open', { protocol: 'scriptvault' });
    await flushWrappedScript();
    expect(window.__ws.readyState).toBe(window.__ws.OPEN);
    expect(window.__wsEvents).toEqual(['open:open:scriptvault', 'open-listener']);

    expect(window.__ws.send('hello')).toBe(true);
    await flushWrappedScript();
    expect(calls).toContainEqual({
      action: 'GM_webSocket_send',
      data: {
        scriptId: 'script_ws',
        requestId: 'ws_test',
        payload: 'hello',
      },
    });

    postWebSocketEvent('message', { payload: 'pong' });
    await flushWrappedScript();
    expect(window.__wsEvents).toContain('message:pong');

    window.__ws.close(1000, 'done');
    await flushWrappedScript();
    expect(calls).toContainEqual({
      action: 'GM_webSocket_close',
      data: {
        scriptId: 'script_ws',
        requestId: 'ws_test',
        code: 1000,
        reason: 'done',
      },
    });

    postWebSocketEvent('close', { code: 1000, reason: 'done', wasClean: true });
    await flushWrappedScript();
    expect(window.__ws.readyState).toBe(window.__ws.CLOSED);
    expect(window.__wsEvents).toContain('close:1000:done');
  });

  it('denies wrapper use without an explicit GM_webSocket grant', async () => {
    chrome.runtime.sendMessage.mockResolvedValue({});

    const wrapped = buildWrappedScript(makeScript(`
window.__wsDenied = [];
GM_webSocket({
  url: 'wss://api.example.com/socket',
  onerror(event) { window.__wsDenied.push(event.message); },
});
`, ['none']));

    new Function(wrapped)();
    await flushWrappedScript();

    expect(window.__wsDenied).toEqual(['Permission denied']);
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({
      action: 'GM_webSocket',
    }));
  });

  it('keeps the background WebSocket bridge behind grant, @connect, and internal-host guards', () => {
    const core = readFileSync(resolve(process.cwd(), 'src/background/core.ts'), 'utf8');
    const networkHandler = readFileSync(resolve(process.cwd(), 'src/background/gm-network-handler.ts'), 'utf8');
    const bridge = readFileSync(resolve(process.cwd(), 'content.js'), 'utf8');
    const wrapper = readFileSync(resolve(process.cwd(), 'src/background/wrapper-builder.ts'), 'utf8');

    expect(core).toContain("case 'GM_webSocket':");
    expect(core).toContain('return await GMNetworkHandler.handleGMNetworkMessage(action, data, sender);');
    expect(networkHandler).toContain("scriptHasGrant(wsScript, ['GM_webSocket', 'GM.webSocket'])");
    expect(networkHandler).toContain('const connectPolicy = evaluateConnectPolicy(wsScript, wsUrl);');
    expect(networkHandler).toContain("const wsPreCheck = InternalHostGuard.classifyFetchUrl(wsUrl, ['ws:', 'wss:']);");
    expect(networkHandler).toContain("internalXhrError('GM_webSocket URL rejected', wsPreCheck)");
    expect(core).toContain('closeGMWebSocketsForTab(tabId);');
    expect(bridge).toContain("message.action === 'webSocketEvent'");
    expect(wrapper).toContain("sendToBackground('GM_webSocket_send'");
    expect(wrapper).toContain("sendToBackground('GM_webSocket_close'");
  });
});
