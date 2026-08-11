import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseUserscript, parseUserSubscribe } from '../src/background/parser.ts';
import { handleGMNetworkMessage, isGMNetworkAction } from '../src/background/gm-network-handler.ts';

const BOUNDARY_SEEDS = Object.freeze({
  metadata: 0x534d4554,
  imports: 0x494d5054,
  messages: 0x4d534747,
  bridge: 0x42524447,
  network: 0x4e455457,
});
const FUZZ_CASES = 48;
const MAX_FUZZ_INPUT_BYTES = 128 * 1024;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function nextRandom(state) {
  state.value = (Math.imul(state.value, 1664525) + 1013904223) >>> 0;
  return state.value;
}

function choose(state, values) {
  return values[nextRandom(state) % values.length];
}

function fuzzCaseError(boundary, seed, index, error) {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`[fuzz boundary=${boundary} seed=0x${seed.toString(16)} case=${index}] ${message}`, {
    cause: error,
  });
}

async function runFuzzCase(boundary, seed, index, callback) {
  try {
    return await callback();
  } catch (error) {
    throw fuzzCaseError(boundary, seed, index, error);
  }
}

function makeUserscriptMutation(seed, index) {
  const state = { value: (seed ^ Math.imul(index + 1, 0x9e3779b9)) >>> 0 };
  const names = [
    'Fuzz Script',
    '名前 — тест — script',
    'emoji-🧪-✅',
    'control-\u0000-\u0001-\u001f',
    'combining-e\u0301',
  ];
  const name = choose(state, names);
  const description = index % 9 === 0
    ? 'x'.repeat(16 * 1024 + (nextRandom(state) % 2048))
    : choose(state, ['short', 'with\ttab', 'with\u2028separator', ''])
      + (index % 4 === 0 ? `-${nextRandom(state).toString(16)}` : '');
  const lines = [
    '// ==UserScript==',
    `// @name ${name}`,
    `// @namespace fuzz/${nextRandom(state).toString(16)}`,
    `// @version ${index % 5 === 0 ? 'not-semver' : `1.${index}.0`}`,
    `// @description ${description}`,
    `// @match ${choose(state, ['https://example.com/*', '*://*.example.test/*', 'not a pattern', ''])}`,
    `// @grant ${choose(state, ['none', 'GM_getValue', 'GM_xmlhttpRequest', ''])}`,
  ];
  if (index % 3 === 0) lines.push(`// @name duplicate-${index}`);
  if (index % 4 === 0) lines.push(`// @match https://duplicate-${index}.example/*, https://other.example/*`);
  if (index % 6 === 0) lines.push('// @name:__proto__ polluted');
  if (index % 7 === 0) lines.push('// @__proto__:en polluted');
  if (index % 8 === 0) lines.push(`// @resource key https://cdn.example/${nextRandom(state).toString(16)}.css`);
  if (index % 11 === 0) return `${lines.join('\n')}\nconsole.log('unterminated');`;
  return `${lines.join('\n')}\n// ==/UserScript==\nconsole.log('fuzz-${index}');`;
}

function makeSubscriptionMutation(seed, index) {
  const state = { value: (seed + index) >>> 0 };
  const scriptUrl = choose(state, [
    `https://cdn.example/${index}.user.js`,
    `https://cdn.example/${index}.user.js#fragment`,
    `javascript:alert(${index})`,
    'not a URL',
    '',
  ]);
  return [
    '// ==UserSubscribe==',
    `// @name ${choose(state, ['Fuzz feed', '订阅 — 🧪', ''])}`,
    `// @version ${index}.0.0`,
    `// @scriptUrl ${scriptUrl}`,
    index % 2 === 0 ? `// @scriptUrl https://cdn.example/${index}.user.js` : '',
    index % 5 === 0 ? '// @connect \u0000invalid' : '',
    '// ==/UserSubscribe==',
  ].join('\n');
}

function assertSafeParserResult(result, input) {
  expect(result).toBeTruthy();
  expect(typeof result).toBe('object');
  if (result.meta) {
    expect(result.code).toBe(input);
    expect(Array.isArray(result.meta.match)).toBe(true);
    expect(Array.isArray(result.meta.grant)).toBe(true);
    expect(JSON.stringify(result).length).toBeLessThanOrEqual(MAX_FUZZ_INPUT_BYTES * 2);
  } else {
    expect(typeof result.error).toBe('string');
  }
}

function makeImportScript(name, version = '1.0.0', body = '') {
  return [
    '// ==UserScript==',
    `// @name ${name}`,
    `// @namespace fuzz/${name}`,
    `// @version ${version}`,
    '// @match https://example.com/*',
    '// @grant none',
    '// ==/UserScript==',
    body,
  ].join('\n');
}

const backgroundCoreCode = readFileSync(resolve(process.cwd(), 'background.core.js'), 'utf8');

function extractImportRuntimeCode() {
  const parserStart = backgroundCoreCode.indexOf('function parseUserscript');
  const parserEnd = backgroundCoreCode.indexOf('// URL Matching', parserStart);
  const importStart = backgroundCoreCode.indexOf('const ARCHIVE_MAX_SCRIPT_BYTES');
  const importEnd = backgroundCoreCode.indexOf('// Message Handlers', importStart);
  if ([parserStart, parserEnd, importStart, importEnd].some(index => index === -1)) {
    throw new Error('Unable to locate generated import runtime slices');
  }
  return `${backgroundCoreCode.slice(parserStart, parserEnd)}\n${backgroundCoreCode.slice(importStart, importEnd)}`;
}

function makeFakeFflate() {
  return {
    strToU8(value) {
      return encoder.encode(value);
    },
    strFromU8(bytes) {
      return decoder.decode(bytes);
    },
    unzipSync(bytes, options = {}) {
      const parsed = JSON.parse(decoder.decode(bytes));
      const files = {};
      for (const [name, raw] of Object.entries(parsed && typeof parsed === 'object' ? parsed : {})) {
        const entry = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
        const data = Array.isArray(raw) ? raw : entry.bytes || [];
        const fileBytes = Uint8Array.from(Array.isArray(data) ? data : []);
        const meta = {
          name,
          size: Array.isArray(raw) ? fileBytes.byteLength : entry.size ?? fileBytes.byteLength,
          originalSize: Array.isArray(raw) ? fileBytes.byteLength : entry.originalSize ?? fileBytes.byteLength,
          compression: Array.isArray(raw) ? 0 : entry.compression ?? 0,
        };
        if (options.filter && options.filter(meta) === false) continue;
        files[name] = fileBytes;
      }
      return files;
    },
  };
}

function archiveBytes(files) {
  return encoder.encode(JSON.stringify(files));
}

function createImportHarness() {
  const scriptCache = new Map();
  const valueCache = new Map();
  let generatedId = 0;
  const ScriptStorage = {
    getAll: vi.fn(async () => [...scriptCache.values()]),
    get: vi.fn(async id => scriptCache.get(id) || null),
    set: vi.fn(async (id, script) => {
      scriptCache.set(id, script);
      return script;
    }),
  };
  const ScriptValues = {
    getAll: vi.fn(async id => valueCache.get(id) || {}),
    setAll: vi.fn(async (id, values) => valueCache.set(id, values)),
  };
  const SettingsManager = {
    get: vi.fn(async () => ({})),
    set: vi.fn(async () => undefined),
  };
  const registerAllScripts = vi.fn(async () => undefined);
  const updateBadge = vi.fn(async () => undefined);
  const generateId = vi.fn(() => `script_fuzz_${++generatedId}`);
  const BackupScheduler = {};
  const body = `${extractImportRuntimeCode()}\nreturn { importScripts, importFromZip };`;
  let factory;
  try {
    const vm = require('node:vm');
    factory = vm.compileFunction(body, [
      'fflate',
      'ScriptStorage',
      'ScriptValues',
      'SettingsManager',
      'registerAllScripts',
      'updateBadge',
      'generateId',
      'BackupScheduler',
    ], { filename: resolve(process.cwd(), 'background.core.js') });
  } catch {
    factory = new Function(
      'fflate',
      'ScriptStorage',
      'ScriptValues',
      'SettingsManager',
      'registerAllScripts',
      'updateBadge',
      'generateId',
      'BackupScheduler',
      body,
    );
  }
  return {
    ...factory(
      makeFakeFflate(),
      ScriptStorage,
      ScriptValues,
      SettingsManager,
      registerAllScripts,
      updateBadge,
      generateId,
      BackupScheduler,
    ),
    ScriptStorage,
    ScriptValues,
    scriptCache,
  };
}

const publicApiCode = readFileSync(resolve(process.cwd(), 'modules/public-api.js'), 'utf8');
let publicApiFactory;
try {
  const vm = require('node:vm');
  publicApiFactory = vm.compileFunction(
    `${publicApiCode}\nreturn PublicAPI;`,
    ['chrome', 'console', 'crypto', 'fetch', 'ScriptStorage', 'AbortController'],
    { filename: resolve(process.cwd(), 'modules/public-api.js') },
  );
} catch {
  publicApiFactory = new Function(
    'chrome',
    'console',
    'crypto',
    'fetch',
    'ScriptStorage',
    'AbortController',
    `${publicApiCode}\nreturn PublicAPI;`,
  );
}

function createPublicApiHarness() {
  const ScriptStorage = {
    getAll: vi.fn(async () => []),
    get: vi.fn(async () => null),
    set: vi.fn(async () => undefined),
  };
  const api = publicApiFactory(
    globalThis.chrome,
    console,
    globalThis.crypto,
    vi.fn(async () => ({ ok: true })),
    ScriptStorage,
    globalThis.AbortController,
  );
  return { api, ScriptStorage };
}

function createBridgeWindow() {
  const listeners = new Map();
  const posted = [];
  const windowObject = {
    setTimeout,
    clearTimeout,
    addEventListener(type, listener) {
      const current = listeners.get(type) || [];
      current.push(listener);
      listeners.set(type, current);
    },
    removeEventListener(type, listener) {
      listeners.set(type, (listeners.get(type) || []).filter(item => item !== listener));
    },
    dispatchEvent(event) {
      for (const listener of listeners.get(event.type) || []) listener.call(windowObject, event);
      return true;
    },
    postMessage: vi.fn((data, targetOrigin = '*') => {
      posted.push({ data, targetOrigin });
      queueMicrotask(() => windowObject.dispatchEvent(new windowObject.MessageEvent('message', {
        source: windowObject,
        data,
        origin: targetOrigin,
      })));
    }),
  };
  windowObject.MessageEvent = class MessageEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.source = init.source ?? null;
      this.data = init.data;
      this.origin = init.origin ?? '';
    }
  };
  return { windowObject, posted };
}

function loadContentBridgeFuzzHarness() {
  const contentCode = readFileSync(resolve(process.cwd(), 'content.js'), 'utf8');
  const { windowObject, posted } = createBridgeWindow();
  const onMessageListeners = [];
  const sendMessage = vi.fn(async message => (
    message.action === 'getChainDomEventTriggers' ? { eventTypes: [] } : { ok: true }
  ));
  const chromeMock = {
    runtime: {
      id: 'fuzz-bridge-extension',
      sendMessage,
      onMessage: { addListener: listener => onMessageListeners.push(listener) },
    },
  };
  const documentMock = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  const locationMock = { href: 'https://fuzz.example/page' };
  try {
    const vm = require('node:vm');
    vm.compileFunction(contentCode, ['window', 'chrome', 'document', 'location'], {
      filename: resolve(process.cwd(), 'content.js'),
    })(windowObject, chromeMock, documentMock, locationMock);
  } catch {
    new Function('window', 'chrome', 'document', 'location', contentCode)(
      windowObject,
      chromeMock,
      documentMock,
      locationMock,
    );
  }
  sendMessage.mockClear();
  posted.length = 0;
  return { windowObject, chromeMock, onMessageListeners, sendMessage, posted };
}

describe('deterministic trust-boundary fuzz corpus', () => {
  it('keeps metadata and subscription parsers total, bounded, and pollution-free', async () => {
    const seed = BOUNDARY_SEEDS.metadata;
    for (let index = 0; index < FUZZ_CASES; index += 1) {
      await runFuzzCase('metadata', seed, index, () => {
        const code = makeUserscriptMutation(seed, index);
        const result = parseUserscript(code);
        assertSafeParserResult(result, code);

        const subscription = parseUserSubscribe(
          makeSubscriptionMutation(seed, index),
          index % 4 === 0 ? 'http://fuzz.example/feed' : 'https://fuzz.example/feed',
        );
        expect(subscription).toBeTruthy();
        expect(typeof subscription).toBe('object');
        expect({}.polluted).toBeUndefined();
        expect(Object.prototype.polluted).toBeUndefined();
      });
    }
    for (const [index, input] of [null, undefined, [], {}, 42].entries()) {
      await runFuzzCase('metadata-types', seed, index, () => {
        assertSafeParserResult(parseUserscript(input), input);
        const subscription = parseUserSubscribe(input);
        expect(subscription).toMatchObject({ error: expect.any(String) });
      });
    }
  });

  it('rejects malformed JSON and archive mutations without trusted or partial privilege state', async () => {
    const seed = BOUNDARY_SEEDS.imports;
    const invalidJsonInputs = [null, undefined, '', [], {}, { scripts: null }, { scripts: {} }];
    for (const [index, input] of invalidJsonInputs.entries()) {
      await runFuzzCase('imports-json', seed, index, async () => {
        const harness = createImportHarness();
        const result = await harness.importScripts(input);
        expect(result).toEqual(expect.any(Object));
        expect(harness.ScriptStorage.set).not.toHaveBeenCalled();
        expect({}.polluted).toBeUndefined();
      });
    }

    for (let index = 0; index < FUZZ_CASES; index += 1) {
      await runFuzzCase('imports-json', seed, index + invalidJsonInputs.length, async () => {
        const harness = createImportHarness();
        const code = makeUserscriptMutation(seed, index);
        const input = {
          scripts: [{
            id: index % 5 === 0 ? '__proto__' : `script_fuzz_${index}`,
            code,
            enabled: index % 3 !== 0,
            position: index % 7 === 0 ? 'not-a-number' : index,
          }, null, { id: 'script_invalid', code: index % 2 ? 42 : null }],
          settings: {
            __proto__: { polluted: true },
            notes: 'portable',
          },
        };
        const result = await harness.importScripts(input);
        expect(result).toEqual(expect.any(Object));
        for (const [, imported] of harness.ScriptStorage.set.mock.calls) {
          expect(imported.enabled).toBe(false);
          expect(imported.settings?._importTrust).toBeUndefined();
        }
        expect({}.polluted).toBeUndefined();
      });
    }

    const validCode = makeImportScript('Archive Fuzz', '1.0.0', '/* archive */');
    const validBytes = [...encoder.encode(validCode)];
    const archiveInputs = [
      null,
      undefined,
      '%%%not-base64%%%',
      Uint8Array.from([0, 1, 2, 255]),
      archiveBytes({ '../escape.user.js': validBytes }),
      archiveBytes({ 'nested.zip': { bytes: [1, 2], size: 2, originalSize: 2 } }),
      archiveBytes({ 'huge.user.js': { bytes: validBytes, size: 1, originalSize: 6 * 1024 * 1024 } }),
      archiveBytes({
        'archive.user.js': validBytes,
        'archive.options.json': [...encoder.encode('{ malformed')],
      }),
    ];
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      for (const [index, input] of archiveInputs.entries()) {
        await runFuzzCase('imports-archive', seed, index, async () => {
          const harness = createImportHarness();
          const result = await harness.importFromZip(input);
          expect(result).toEqual(expect.any(Object));
          for (const [, imported] of harness.ScriptStorage.set.mock.calls) {
            expect(imported.enabled).toBe(false);
            expect(imported.settings?._importTrust).toBeUndefined();
          }
        });
      }
    } finally {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it('keeps public API structured messages fail-closed and mutation-free', async () => {
    const seed = BOUNDARY_SEEDS.messages;
    const { api, ScriptStorage } = createPublicApiHarness();
    await api.init();
    await api.setPermissions({ installScript: 'allow' });
    const messages = [
      null,
      undefined,
      [],
      {},
      { action: null },
      { action: 42 },
      { action: `unknown-${seed}` },
      { action: 'installScript', code: 'not a userscript' },
      { action: 'installScript', code: 'x'.repeat(8192) },
      { action: 'getInstalledScripts', scriptId: { nested: true } },
    ];
    for (let index = 0; index < FUZZ_CASES; index += 1) {
      await runFuzzCase('public-api', seed, index, async () => {
        const message = messages[index % messages.length] || {
          action: `unknown-${nextRandom({ value: seed + index })}`,
        };
        const result = await api.handleExternalMessage(message, { origin: 'https://fuzz.example' });
        expect(result).toEqual(expect.any(Object));
        expect(ScriptStorage.set).not.toHaveBeenCalled();
      });
    }

    await api.setTrustedOrigins(['https://fuzz.example']);
    const webMessages = [
      null,
      {},
      { type: null },
      { type: {} },
      { type: 'not-scriptvault' },
      { type: 'scriptvault:unknown', requestId: 'fuzz' },
      { type: 'scriptvault:isInstalled', name: 'x'.repeat(4096) },
    ];
    for (let index = 0; index < FUZZ_CASES; index += 1) {
      await runFuzzCase('public-api-web', seed, index, async () => {
        const result = await api.handleWebMessagePayload(webMessages[index % webMessages.length], 'https://fuzz.example');
        expect(result === null || typeof result === 'object').toBe(true);
      });
    }

    for (const [index, message] of [null, [], {}, { type: null }, { type: 'scriptvault:mcp:unknown' }].entries()) {
      await runFuzzCase('public-api-mcp', seed, index, async () => {
        const result = await api.handleLocalMcpMessage(message, 'http://127.0.0.1:38123');
        expect(result).toEqual(expect.any(Object));
        expect(ScriptStorage.set).not.toHaveBeenCalled();
      });
    }
  });

  it('keeps page-visible bridge mutations out of privileged messaging', async () => {
    const seed = BOUNDARY_SEEDS.bridge;
    const harness = loadContentBridgeFuzzHarness();
    const channel = 'ScriptVault_fuzz-bridge-extension';
    const backgroundListener = harness.onMessageListeners[0];
    expect(() => backgroundListener(null, {}, vi.fn())).not.toThrow();
    expect(() => backgroundListener([], {}, vi.fn())).not.toThrow();

    const mutations = [
      null,
      42,
      {},
      { channel, direction: 'wrong', action: 'GM_xmlhttpRequest' },
      { channel, direction: 'to-background', id: 'a', action: `GM_${seed}` },
      { channel, direction: 'to-background', id: 'b', action: 'reportExecTime', data: null },
      { channel, direction: 'to-background', id: 'c', action: 'reportExecTime', data: { time: 'NaN' } },
      { channel, direction: 'to-background', id: 'd', action: 'reportExecError', data: { error: '' } },
      { channel, direction: 'to-background', id: 'e', action: 'netlog_record', data: { url: '' } },
    ];
    for (let index = 0; index < FUZZ_CASES; index += 1) {
      await runFuzzCase('page-bridge', seed, index, async () => {
        harness.posted.length = 0;
        const before = harness.sendMessage.mock.calls.length;
        const data = mutations[index % mutations.length];
        harness.windowObject.dispatchEvent(new harness.windowObject.MessageEvent('message', {
          source: harness.windowObject,
          data,
          origin: 'https://fuzz.example',
        }));
        await new Promise(resolvePromise => setTimeout(resolvePromise, 0));
        expect(harness.sendMessage.mock.calls.length).toBe(before);
        expect(harness.posted.length).toBeLessThanOrEqual(1);
        for (const post of harness.posted) {
          expect(post.data).not.toHaveProperty('scriptId');
          expect(post.data).not.toHaveProperty('code');
        }
      });
    }
  });

  it('keeps network boundary mutations total and reports deterministic errors/timeouts', async () => {
    const seed = BOUNDARY_SEEDS.network;
    const original = {
      ScriptStorage: globalThis.ScriptStorage,
      SettingsManager: globalThis.SettingsManager,
      XhrManager: globalThis.XhrManager,
      NetworkLog: globalThis.NetworkLog,
      InternalHostGuard: globalThis.InternalHostGuard,
      evaluateConnectPolicy: globalThis.evaluateConnectPolicy,
      shouldAllowInternalXhr: globalThis.shouldAllowInternalXhr,
      internalXhrError: globalThis.internalXhrError,
      prepareCookieRoutingForFetch: globalThis.prepareCookieRoutingForFetch,
      withCookieHeaderSessionRule: globalThis.withCookieHeaderSessionRule,
      fetch: globalThis.fetch,
      formatBytes: globalThis.formatBytes,
    };
    const requests = new Map();
    try {
      globalThis.ScriptStorage = { get: vi.fn(async () => null) };
      globalThis.SettingsManager = { get: vi.fn(async () => ({ xhrTimeout: 5 })) };
      globalThis.XhrManager = {
        create: vi.fn((_tabId, scriptId, data) => {
          const request = { id: `fuzz-xhr-${requests.size}`, scriptId, details: data, aborted: false };
          requests.set(request.id, request);
          return request;
        }),
        get: vi.fn(id => requests.get(id)),
        remove: vi.fn(id => requests.delete(id)),
        buildFetchOptions: vi.fn(() => ({})),
      };
      globalThis.NetworkLog = { add: vi.fn() };
      globalThis.InternalHostGuard = {
        classifyFetchUrl: vi.fn(() => ({ ok: true })),
        classifyResponseUrl: vi.fn(() => ({ ok: true })),
      };
      globalThis.evaluateConnectPolicy = vi.fn(() => ({ allowed: true }));
      globalThis.shouldAllowInternalXhr = vi.fn(() => false);
      globalThis.internalXhrError = vi.fn(label => `${label}: internal`);
      globalThis.prepareCookieRoutingForFetch = vi.fn(async () => ({ applies: false, cookieHeader: '' }));
      globalThis.withCookieHeaderSessionRule = vi.fn((_url, _cookie, callback) => callback());
      globalThis.formatBytes = vi.fn(bytes => `${bytes} B`);

      const malformed = [null, undefined, [], {}, { url: null }, { url: 42 }, { scriptId: null }];
      for (let index = 0; index < FUZZ_CASES; index += 1) {
        await runFuzzCase('network-message', seed, index, async () => {
          const action = index % 5 === 0 ? `GM_${nextRandom({ value: seed + index })}` : 'GM_xmlhttpRequest';
          const result = await handleGMNetworkMessage(action, malformed[index % malformed.length], null);
          expect(result).toEqual(expect.any(Object));
          expect(result.error || result.success === false || result.started === true).toBeTruthy();
        });
      }

      globalThis.ScriptStorage.get.mockResolvedValue({
        id: 'script-fuzz-network',
        meta: { name: 'Network Fuzz', connect: ['api.example.com'] },
      });
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('deterministic network failure'));
      await handleGMNetworkMessage('GM_xmlhttpRequest', {
        scriptId: 'script-fuzz-network',
        url: 'https://api.example.com/failure',
      }, { tab: { id: 1 } });
      await vi.waitFor(() => expect([...requests.values()][0]?.finalResult).toMatchObject({ done: true, type: 'error' }));

      globalThis.fetch = vi.fn((_url, options) => new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new Error('deterministic timeout')));
      }));
      await handleGMNetworkMessage('GM_xmlhttpRequest', {
        scriptId: 'script-fuzz-network',
        url: 'https://api.example.com/timeout',
        timeout: 1,
      }, { tab: { id: 1 } });
      await vi.waitFor(() => expect([...requests.values()][1]?.finalResult).toMatchObject({ done: true, type: 'timeout' }));
      expect(isGMNetworkAction('GM_xmlhttpRequest')).toBe(true);
      expect(isGMNetworkAction(`GM_${seed}`)).toBe(false);
    } finally {
      for (const [key, value] of Object.entries(original)) {
        if (value === undefined) Reflect.deleteProperty(globalThis, key);
        else globalThis[key] = value;
      }
    }
  });
});
