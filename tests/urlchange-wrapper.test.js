import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildWrappedScript } from '../src/background/wrapper-builder.ts';

const frames = [];

function makeScript(code) {
  const meta = {
    name: 'URL Change Test',
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
    match: ['http://localhost:3000/*'],
    include: [],
    exclude: [],
    excludeMatch: [],
    'run-at': 'document-idle',
    'inject-into': 'auto',
    noframes: false,
    unwrap: false,
    sandbox: '',
    'run-in': '',
    grant: ['window.onurlchange'],
    require: [],
    resource: {},
    connect: [],
    'top-level-await': false,
    webRequest: null,
    priority: 0,
    antifeature: [],
    tag: [],
    compatible: [],
    incompatible: [],
  };

  return {
    id: 'script_urlchange',
    enabled: true,
    position: 0,
    createdAt: 1,
    updatedAt: 1,
    settings: {},
    stats: { runs: 0, totalTime: 0, avgTime: 0, lastRun: 0, errors: 0 },
    versionHistory: [],
    meta,
    code: `// ==UserScript==
// @name URL Change Test
// @match http://localhost:3000/*
// @grant window.onurlchange
// ==/UserScript==
${code}`,
  };
}

function createFrame() {
  const iframe = document.createElement('iframe');
  iframe.src = window.location.href;
  document.body.appendChild(iframe);
  frames.push(iframe);
  const win = iframe.contentWindow;
  win.history.replaceState({}, '', '/start');
  win.chrome = chrome;
  win.fetch = vi.fn(() => Promise.resolve(new win.Response('', { status: 204 })));
  win.XMLHttpRequest = win.XMLHttpRequest || class FakeXMLHttpRequest {};
  win.WebSocket = class FakeWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    addEventListener() {}
    send() {}
  };
  Object.defineProperty(win.navigator, 'sendBeacon', {
    configurable: true,
    value: vi.fn(() => true),
  });
  return win;
}

function installNavigation(win) {
  const listeners = [];
  Object.defineProperty(win, 'navigation', {
    configurable: true,
    value: {
      addEventListener(type, listener) {
        if (type === 'navigate') listeners.push(listener);
      },
    },
  });
  return listeners;
}

function installFrameScheduler(win) {
  const callbacks = [];
  Object.defineProperty(win, 'requestAnimationFrame', {
    configurable: true,
    value(callback) {
      callbacks.push(callback);
      return callbacks.length;
    },
  });
  return callbacks;
}

async function flushUrlChange(win, frameCallbacks) {
  await win.Promise.resolve();
  while (frameCallbacks.length > 0) {
    const callback = frameCallbacks.shift();
    callback(0);
    await win.Promise.resolve();
  }
  await new Promise((resolve) => win.setTimeout(resolve, 0));
  await win.Promise.resolve();
}

function runWrapped(win, code) {
  const wrapped = buildWrappedScript(makeScript(code));
  new win.Function(wrapped)();
  return wrapped;
}

describe('window.onurlchange wrapper contract', () => {
  afterEach(() => {
    while (frames.length > 0) {
      frames.pop().remove();
    }
    vi.clearAllMocks();
  });

  it('dedupes repeated Navigation API notifications for one URL transition', async () => {
    const win = createFrame();
    const navigationListeners = installNavigation(win);
    const frameCallbacks = installFrameScheduler(win);
    const nativeReplaceState = win.history.replaceState.bind(win.history);
    const wrapped = runWrapped(win, `
window.__urlEvents = [];
window.__urlHandler = detail => window.__urlEvents.push(detail);
window.addEventListener('urlchange', window.__urlHandler);
window.addEventListener('urlchange', window.__urlHandler);
`);

    expect(wrapped).toContain('function __scheduleUrlChangeCheck(reason)');
    expect(wrapped).toContain("history.pushState = function()");
    expect(wrapped).toContain("__scheduleUrlChangeCheck('pushState')");
    expect(wrapped).toContain("__scheduleUrlChangeCheck('replaceState')");
    expect(wrapped).toContain("window.addEventListener('popstate', () => __scheduleUrlChangeCheck('popstate'))");
    expect(wrapped).toContain('requestAnimationFrame(frameCheck)');
    expect(navigationListeners).toHaveLength(1);
    await flushUrlChange(win, frameCallbacks);

    navigationListeners[0](new win.Event('navigate'));
    nativeReplaceState({}, '', '/first');
    navigationListeners[0](new win.Event('navigate'));
    await flushUrlChange(win, frameCallbacks);

    expect(win.__urlEvents).toEqual([{
      oldUrl: 'http://localhost:3000/start',
      url: 'http://localhost:3000/first',
    }]);

    win.removeEventListener('urlchange', win.__urlHandler);
    nativeReplaceState({}, '', '/removed');
    navigationListeners[0](new win.Event('navigate'));
    await flushUrlChange(win, frameCallbacks);
    expect(win.__urlEvents).toHaveLength(1);
  });

  it('falls back to history, popstate, and hashchange without Navigation API', async () => {
    const win = createFrame();
    const frameCallbacks = installFrameScheduler(win);
    const nativeReplaceState = win.history.replaceState.bind(win.history);
    runWrapped(win, `
window.__urlEvents = [];
window.onurlchange = detail => window.__urlEvents.push(detail);
`);
    await flushUrlChange(win, frameCallbacks);

    nativeReplaceState({}, '', '/from-popstate');
    win.dispatchEvent(new win.PopStateEvent('popstate'));
    await flushUrlChange(win, frameCallbacks);

    nativeReplaceState({}, '', '/from-hash#one');
    win.dispatchEvent(new win.HashChangeEvent('hashchange'));
    await flushUrlChange(win, frameCallbacks);

    expect(win.__urlEvents).toEqual([
      { oldUrl: 'http://localhost:3000/start', url: 'http://localhost:3000/from-popstate' },
      { oldUrl: 'http://localhost:3000/from-popstate', url: 'http://localhost:3000/from-hash#one' },
    ]);
  });
});
