import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function loadShippedBuildWrappedScript() {
  const source = readFileSync(resolve(process.cwd(), 'background.core.js'), 'utf8');
  const functionStart = source.indexOf('function buildWrappedScript(script,');
  expect(functionStart, 'buildWrappedScript in background.core.js').toBeGreaterThan(-1);
  const functionEnd = source.indexOf('\n}\n\n// Helper: Check if a pattern is a valid match pattern', functionStart);
  expect(functionEnd, 'end of buildWrappedScript in background.core.js').toBeGreaterThan(functionStart);

  const scriptSourceMaps = {
    neutralizeSourceDirectives: value => value,
    markSourceSegment: (_index, value) => value,
    finalizeWrappedSource: value => value
      .replace('__SV_GENERATED_SOURCE_URL__', JSON.stringify('scriptvault://generated'))
      .replace('__SV_RUNTIME_LOCATION_SEGMENTS__', '[]'),
    deterministicRequireSourceUrl: (_scriptId, index, url) => `scriptvault://require/${index}/${url}`,
    createBundledSourceSegment: () => null,
    deterministicScriptSourceUrl: (scriptId, name) => `scriptvault://script/${scriptId}/${name}`,
  };
  const scriptConfig = { normalizeValues: () => ({}) };
  const localLibraries = { getLocalLibraryRequireScripts: () => [] };
  const factory = new Function(
    'ScriptSourceMaps',
    'ScriptConfig',
    'LocalLibraries',
    'chrome',
    `${source.slice(functionStart, functionEnd + 2)}; return buildWrappedScript;`
  );
  return factory(scriptSourceMaps, scriptConfig, localLibraries, globalThis.chrome);
}

const buildWrappedScript = loadShippedBuildWrappedScript();

function makeScript(code, grant = ['GM_webSocket'], id = 'script_ws') {
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
    id,
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

function createQueuedLockManager() {
  const queue = [];
  const calls = [];
  let active = false;

  const pump = () => {
    if (active || queue.length === 0) return;
    active = true;
    const entry = queue.shift();
    Promise.resolve()
      .then(() => entry.callback({ name: entry.name, mode: entry.options.mode || 'exclusive' }))
      .then(
        value => entry.resolve(value),
        error => entry.reject(error),
      )
      .then(() => {
        active = false;
        pump();
      });
  };

  return {
    calls,
    request: vi.fn((name, options, callback) => {
      calls.push({ name, options, callback });
      return new Promise((resolve, reject) => {
        queue.push({ name, options, callback, resolve, reject });
        pump();
      });
    }),
  };
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

  it('serializes GM.withLock calls for one script and scopes names per script', async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, 'locks');
    const lockManager = createQueuedLockManager();
    Object.defineProperty(navigator, 'locks', { configurable: true, value: lockManager });

    try {
      const first = buildWrappedScript(makeScript(`
window.__lockOrder = [];
window.__firstLockResult = GM.withLock('refresh', async lock => {
  window.__lockOrder.push('first-enter');
  await new Promise(resolve => { window.__releaseFirst = resolve; });
  window.__lockOrder.push('first-exit');
  return lock.name;
});
`, ['GM_withLock'], 'script_lock_same'));
      const second = buildWrappedScript(makeScript(`
window.__secondLockResult = GM_withLock('refresh', async lock => {
  window.__lockOrder.push('second-enter');
  return lock.name;
});
`, ['GM.withLock'], 'script_lock_same'));

      new Function(first)();
      await flushWrappedScript();
      new Function(second)();
      await flushWrappedScript();

      expect(lockManager.request).toHaveBeenCalledTimes(2);
      expect(lockManager.calls.map(call => call.name)).toEqual([
        'ScriptVault:script_lock_same:refresh',
        'ScriptVault:script_lock_same:refresh',
      ]);
      expect(window.__lockOrder).toEqual(['first-enter']);

      window.__releaseFirst();
      await expect(window.__firstLockResult).resolves.toBe('ScriptVault:script_lock_same:refresh');
      await expect(window.__secondLockResult).resolves.toBe('ScriptVault:script_lock_same:refresh');
      expect(window.__lockOrder).toEqual(['first-enter', 'first-exit', 'second-enter']);

      const isolated = createQueuedLockManager();
      Object.defineProperty(navigator, 'locks', { configurable: true, value: isolated });
      const scriptA = buildWrappedScript(makeScript(`
window.__lockA = GM_withLock('refresh', lock => lock.name);
`, ['GM_withLock'], 'script_lock_a'));
      const scriptB = buildWrappedScript(makeScript(`
window.__lockB = GM.withLock('refresh', lock => lock.name);
`, ['GM.withLock'], 'script_lock_b'));
      new Function(scriptA)();
      new Function(scriptB)();
      await flushWrappedScript();

      expect(isolated.calls.map(call => call.name)).toEqual([
        'ScriptVault:script_lock_a:refresh',
        'ScriptVault:script_lock_b:refresh',
      ]);
      await expect(window.__lockA).resolves.toBe('ScriptVault:script_lock_a:refresh');
      await expect(window.__lockB).resolves.toBe('ScriptVault:script_lock_b:refresh');
    } finally {
      if (originalDescriptor) Object.defineProperty(navigator, 'locks', originalDescriptor);
      else Reflect.deleteProperty(navigator, 'locks');
      delete window.__lockOrder;
      delete window.__firstLockResult;
      delete window.__secondLockResult;
      delete window.__releaseFirst;
      delete window.__lockA;
      delete window.__lockB;
    }
  });

  it('releases a lock after callback errors and forwards abort signals', async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, 'locks');
    const lockManager = createQueuedLockManager();
    const controller = new AbortController();
    Object.defineProperty(navigator, 'locks', { configurable: true, value: lockManager });
    window.__lockSignal = controller.signal;

    try {
      const wrapped = buildWrappedScript(makeScript(`
window.__lockThrowResult = GM.withLock('refresh', () => {
  throw new Error('lock callback failed');
}).catch(error => error.message);
window.__lockRecoveryResult = GM_withLock('refresh', () => 'recovered', { signal: window.__lockSignal });
`, ['GM_withLock']));
      new Function(wrapped)();
      await flushWrappedScript();

      await expect(window.__lockThrowResult).resolves.toBe('lock callback failed');
      await expect(window.__lockRecoveryResult).resolves.toBe('recovered');
      expect(lockManager.calls[1].options.signal).toBe(controller.signal);
    } finally {
      if (originalDescriptor) Object.defineProperty(navigator, 'locks', originalDescriptor);
      else Reflect.deleteProperty(navigator, 'locks');
      delete window.__lockSignal;
      delete window.__lockThrowResult;
      delete window.__lockRecoveryResult;
    }
  });

  it('denies GM.withLock without an explicit grant', async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, 'locks');
    const lockManager = { request: vi.fn() };
    Object.defineProperty(navigator, 'locks', { configurable: true, value: lockManager });

    try {
      const wrapped = buildWrappedScript(makeScript(`
window.__lockDenied = GM.withLock('refresh', () => 'unexpected').catch(error => error.message);
`, ['none']));
      new Function(wrapped)();
      await flushWrappedScript();

      await expect(window.__lockDenied).resolves.toBe('GM.withLock requires @grant GM_withLock');
      expect(lockManager.request).not.toHaveBeenCalled();
    } finally {
      if (originalDescriptor) Object.defineProperty(navigator, 'locks', originalDescriptor);
      else Reflect.deleteProperty(navigator, 'locks');
      delete window.__lockDenied;
    }
  });

  it('keeps the background WebSocket bridge behind grant, @connect, and internal-host guards', () => {
    const core = readFileSync(resolve(process.cwd(), 'src/background/core.ts'), 'utf8');
    const networkHandler = readFileSync(resolve(process.cwd(), 'src/background/gm-network-handler.ts'), 'utf8');
    const bridge = readFileSync(resolve(process.cwd(), 'content.js'), 'utf8');
    const wrapper = readFileSync(resolve(process.cwd(), 'src/background/wrapper-builder.ts'), 'utf8');

    expect(core).toContain('GMNetworkHandler.GM_NETWORK_ACTIONS');
    expect(core).toContain('GMNetworkHandler.handleGMNetworkMessage(action, message, sender)');
    expect(networkHandler).toContain("'GM_webSocket'");
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
