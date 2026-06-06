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
    Reflect.deleteProperty(window, '__gmFrame');
    Reflect.deleteProperty(window, '__gmHtml');
    Reflect.deleteProperty(window, '__scriptRan');
    for (const k of [
      '__nullParent', '__detachedParent', '__noTag', '__numericTag',
      '__weirdTag', '__validCall', '__svTags', '__svTag', '__svTagType',
    ]) Reflect.deleteProperty(window, k);
  });

  it('sanitizes GM_addElement direct attributes and innerHTML URL attributes', async () => {
    const wrapped = buildWrappedScript(makeScript(`
window.__gmDirect = GM_addElement('a', {
  href: 'java\\nscript:alert(1)',
  onclick: 'window.__scriptRan = true',
  'data-id': 'javascript:not-a-url',
  textContent: 'direct'
});
window.__gmFrame = GM_addElement('iframe', {
  srcdoc: '<script>window.__scriptRan = true</script>'
});
window.__gmHtml = GM_addElement('div', {
  innerHTML: '<a href="\\u0000javascript:alert(1)" onclick="window.__scriptRan = true" data-id="javascript:not-a-url">html</a><img src="data:text/html,boom"><iframe srcdoc="<script>window.__scriptRan = true</script>"></iframe><script>window.__scriptRan = true</script>'
});
`));

    new Function(wrapped)();
    await flushWrappedScript();

    expect(window.__gmDirect).toBeInstanceOf(HTMLAnchorElement);
    expect(window.__gmDirect.textContent).toBe('direct');
    expect(window.__gmDirect.getAttribute('href')).toBeNull();
    expect(window.__gmDirect.getAttribute('onclick')).toBeNull();
    expect(window.__gmDirect.getAttribute('data-id')).toBe('javascript:not-a-url');
    expect(window.__gmFrame).toBeInstanceOf(HTMLIFrameElement);
    expect(window.__gmFrame.getAttribute('srcdoc')).toBeNull();

    const htmlAnchor = window.__gmHtml.querySelector('a');
    const htmlImage = window.__gmHtml.querySelector('img');
    const htmlFrame = window.__gmHtml.querySelector('iframe');
    expect(htmlAnchor.getAttribute('href')).toBeNull();
    expect(htmlAnchor.getAttribute('onclick')).toBeNull();
    expect(htmlAnchor.getAttribute('data-id')).toBe('javascript:not-a-url');
    expect(htmlImage.getAttribute('src')).toBeNull();
    expect(htmlFrame.getAttribute('srcdoc')).toBeNull();
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

  // Phase 38.1 — VM v2.37.0 + TM 5.5.6237 contract: GM_addElement returns
  // null (never throws) for any failure path. Pins so a future refactor that
  // swaps the try/return-null guards for a throw fails CI loudly.
  it('GM_addElement returns null instead of throwing on failure paths', async () => {
    const wrapped = buildWrappedScript(makeScript(`
window.__nullParent     = GM_addElement(null, 'div');
window.__detachedParent = GM_addElement({}, 'div');
window.__noTag          = GM_addElement(document.body, '');
window.__numericTag     = GM_addElement(document.body, 42);
window.__weirdTag       = GM_addElement(document.body, '<<<');
window.__validCall      = GM_addElement(document.body, 'span', { textContent: 'ok' });
`));

    new Function(wrapped)();
    await flushWrappedScript();

    expect(window.__nullParent).toBeNull();
    expect(window.__detachedParent).toBeNull();
    expect(window.__noTag).toBeNull();
    expect(window.__numericTag).toBeNull();
    expect(window.__weirdTag).toBeNull();
    expect(window.__validCall).toBeInstanceOf(HTMLSpanElement);
    expect(window.__validCall.textContent).toBe('ok');
  });

  // Phase 38.12 — VM v2.37.0 pluralized GM_info.script.tag → tags. Keep the
  // singular `tag` getter for back-compat with pre-2026 scripts.
  it('GM_info.script exposes both `tags` (plural array) and `tag` (singular alias for tags[0])', async () => {
    const script = makeScript(`
window.__svTags    = GM_info.script.tags;
window.__svTag     = GM_info.script.tag;
window.__svTagType = typeof GM_info.script.tag;
`);
    script.meta.tag = ['alpha', 'beta', 'gamma'];

    const wrapped = buildWrappedScript(script);
    new Function(wrapped)();
    await flushWrappedScript();

    expect(window.__svTags).toEqual(['alpha', 'beta', 'gamma']);
    expect(window.__svTag).toBe('alpha');
    expect(window.__svTagType).toBe('string');
  });

  it('GM_info.script.tag returns undefined when no tags are present', async () => {
    const script = makeScript(`
window.__svTags = GM_info.script.tags;
window.__svTag  = GM_info.script.tag;
`);
    // makeScript already sets tag: [] but be explicit.
    script.meta.tag = [];

    const wrapped = buildWrappedScript(script);
    new Function(wrapped)();
    await flushWrappedScript();

    expect(window.__svTags).toEqual([]);
    expect(window.__svTag).toBeUndefined();
  });

  it('window.onurlchange wrapper uses a page-scoped dispatcher instead of stacking history patches', () => {
    const script = makeScript('');
    script.meta.grant = ['window.onurlchange'];

    const wrapped = buildWrappedScript(script);

    expect(wrapped).toContain("Object.defineProperty(window, '__svUrlChangeBound__'");
    expect(wrapped).toContain("window.dispatchEvent(new CustomEvent('__sv_urlchange__', { detail }))");
    expect(wrapped).toContain("window.addEventListener('__sv_urlchange__', __svUrlChangeListener);");
    expect(wrapped).toContain("if (!_urlChangeHandlers.includes(args[1]))");
    expect(wrapped.match(/history\.pushState = function/g)).toHaveLength(1);
    expect(wrapped.match(/history\.replaceState = function/g)).toHaveLength(1);
  });

  // Hardening: the @unwrap banner used JSON.stringify(name).slice(1, -1)
  // and interpolated the result into a single-quoted JS string. A name
  // containing a literal single quote (e.g. "John's Script") leaked the
  // quote into the string body and produced invalid JS — the wrapper
  // failed to parse, the script never ran, and the dashboard surfaced a
  // misleading "script execution error" instead of "@unwrap is set".
  it('@unwrap banner handles script names containing apostrophes without breaking the wrapper', () => {
    const script = makeScript(`window.__unwrapRan = true;`);
    script.meta.name = "John's Tricky Script";
    script.meta.unwrap = true;

    const wrapped = buildWrappedScript(script);
    // Most importantly: the wrapper must parse. new Function() throws
    // SyntaxError on an unbalanced single quote; a passing parse is the
    // pin.
    expect(() => new Function(wrapped)).not.toThrow();

    // And the user code should still execute.
    new Function(wrapped)();
    expect(window.__unwrapRan).toBe(true);
    Reflect.deleteProperty(window, '__unwrapRan');
  });

  it('@unwrap banner handles double-quote, backslash, and unicode in script names', () => {
    const script = makeScript(`window.__unwrapRan = 'yes';`);
    // Real-world script names users have written. Each previously had a
    // distinct failure mode under the slice-based interpolation.
    script.meta.name = `Weird "quoted" \\back\\slash 漢字 \u2028 line-sep`;
    script.meta.unwrap = true;

    const wrapped = buildWrappedScript(script);
    expect(() => new Function(wrapped)).not.toThrow();
    new Function(wrapped)();
    expect(window.__unwrapRan).toBe('yes');
    Reflect.deleteProperty(window, '__unwrapRan');
  });

  // Hardening: GM_addElement with attrs passed as an array used to fall
  // into Object.entries which returns numeric-index pairs, silently
  // creating attributes like 0="value". TM/VM spec says attrs is an
  // object map; reject arrays explicitly.
  it('GM_addElement rejects array-shaped attrs (must be an object map per TM/VM contract)', async () => {
    const wrapped = buildWrappedScript(makeScript(`
window.__arrAttrs = GM_addElement(document.body, 'span', ['textContent', 'leak']);
`));
    new Function(wrapped)();
    await flushWrappedScript();

    // Element is still created and attached (defensive), but the array
    // attrs are dropped — no numeric-named attributes leak through.
    expect(window.__arrAttrs).toBeInstanceOf(HTMLSpanElement);
    expect(window.__arrAttrs.getAttribute('0')).toBeNull();
    expect(window.__arrAttrs.getAttribute('1')).toBeNull();
    expect(window.__arrAttrs.textContent).toBe('');
    Reflect.deleteProperty(window, '__arrAttrs');
  });
});
