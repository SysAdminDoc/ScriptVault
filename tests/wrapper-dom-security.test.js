import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildWrappedScript } from '../src/background/wrapper-builder.ts';

const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
  debug: console.debug,
};
let originalFetch;
let originalWebSocket;
let originalSendBeaconDescriptor;
let originalXMLHttpRequest;

function makeScript(code) {
  const meta = {
    name: 'DOM Security Test',
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
    grant: ['GM_addElement'],
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
    id: 'script_dom_security',
    enabled: true,
    position: 0,
    createdAt: 1,
    updatedAt: 1,
    settings: {},
    stats: { runs: 0, totalTime: 0, avgTime: 0, lastRun: 0, errors: 0 },
    versionHistory: [],
    meta,
    code: `// ==UserScript==
// @name DOM Security Test
// @match https://example.com/*
// @grant GM_addElement
// ==/UserScript==
${code}`,
  };
}

async function flushWrappedScript() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
}

describe('wrapper DOM API hardening', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    vi.clearAllMocks();

    originalFetch = window.fetch;
    originalWebSocket = window.WebSocket;
    originalXMLHttpRequest = window.XMLHttpRequest;
    originalSendBeaconDescriptor = Object.getOwnPropertyDescriptor(window.navigator, 'sendBeacon');

    window.fetch = vi.fn(() => Promise.resolve(new Response('', { status: 204 })));
    window.XMLHttpRequest = window.XMLHttpRequest || class FakeXMLHttpRequest {};
    window.WebSocket = class FakeWebSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;
      addEventListener() {}
      send() {}
    };
    Object.defineProperty(window.navigator, 'sendBeacon', {
      configurable: true,
      value: vi.fn(() => true),
    });
    chrome.runtime.sendMessage.mockResolvedValue({});
  });

  afterEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.info = originalConsole.info;
    console.debug = originalConsole.debug;
    window.fetch = originalFetch;
    window.WebSocket = originalWebSocket;
    window.XMLHttpRequest = originalXMLHttpRequest;
    if (originalSendBeaconDescriptor) {
      Object.defineProperty(window.navigator, 'sendBeacon', originalSendBeaconDescriptor);
    } else {
      Reflect.deleteProperty(window.navigator, 'sendBeacon');
    }
    Reflect.deleteProperty(window, '__gmDirect');
    Reflect.deleteProperty(window, '__gmHtml');
    Reflect.deleteProperty(window, '__scriptRan');
  });

  it('sanitizes GM_addElement direct attributes and innerHTML URL attributes', async () => {
    const wrapped = buildWrappedScript(makeScript(`
window.__gmDirect = GM_addElement('a', {
  href: 'java\\nscript:alert(1)',
  onclick: 'window.__scriptRan = true',
  'data-id': 'javascript:not-a-url',
  textContent: 'direct'
});
window.__gmHtml = GM_addElement('div', {
  innerHTML: '<a href="\\u0000javascript:alert(1)" onclick="window.__scriptRan = true" data-id="javascript:not-a-url">html</a><img src="data:text/html,boom"><script>window.__scriptRan = true</script>'
});
`));

    new Function(wrapped)();
    await flushWrappedScript();

    expect(window.__gmDirect).toBeInstanceOf(HTMLAnchorElement);
    expect(window.__gmDirect.textContent).toBe('direct');
    expect(window.__gmDirect.getAttribute('href')).toBeNull();
    expect(window.__gmDirect.getAttribute('onclick')).toBeNull();
    expect(window.__gmDirect.getAttribute('data-id')).toBe('javascript:not-a-url');

    const htmlAnchor = window.__gmHtml.querySelector('a');
    const htmlImage = window.__gmHtml.querySelector('img');
    expect(htmlAnchor.getAttribute('href')).toBeNull();
    expect(htmlAnchor.getAttribute('onclick')).toBeNull();
    expect(htmlAnchor.getAttribute('data-id')).toBe('javascript:not-a-url');
    expect(htmlImage.getAttribute('src')).toBeNull();
    expect(window.__gmHtml.querySelector('script')).toBeNull();
    expect(window.__scriptRan).toBeUndefined();
  });

  it('does not abort script execution when optional network globals are unavailable', async () => {
    window.fetch = undefined;
    window.XMLHttpRequest = undefined;
    window.WebSocket = undefined;
    Reflect.deleteProperty(window.navigator, 'sendBeacon');

    const wrapped = buildWrappedScript(makeScript(`
window.__gmDirect = GM_addElement('div', { textContent: 'ran' });
`));

    new Function(wrapped)();
    await flushWrappedScript();

    expect(window.__gmDirect).toBeInstanceOf(HTMLDivElement);
    expect(window.__gmDirect.textContent).toBe('ran');
  });
});
