// ScriptVault Test Setup
// Mocks Chrome extension APIs for vitest (jsdom environment)

import { vi } from 'vitest';
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

// Reset IDB between tests so each spec sees a clean store.
// (`fake-indexeddb/auto` installs the global; we rebuild it on demand below.)
import { IDBFactory } from 'fake-indexeddb';

// Mock chrome.* APIs
const storageMock = {};
const sessionStorageMock = {};

globalThis.chrome = {
  runtime: {
    id: 'test-extension-id',
    getManifest: () => ({ version: '2.0.0', name: 'ScriptVault' }),
    sendMessage: vi.fn().mockResolvedValue({}),
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    onInstalled: { addListener: vi.fn() },
    onMessageExternal: { addListener: vi.fn() },
    onUserScriptMessage: { addListener: vi.fn() },
    getURL: (path) => `chrome-extension://test-extension-id/${path}`,
  },
  storage: {
    local: {
      get: vi.fn((keys) => {
        if (keys === null || keys === undefined) return Promise.resolve({ ...storageMock });
        if (typeof keys === 'string') {
          // Real Chrome returns {} if key doesn't exist, {key: value} if it does
          return Promise.resolve(storageMock[keys] !== undefined ? { [keys]: storageMock[keys] } : {});
        }
        if (Array.isArray(keys)) {
          const result = {};
          keys.forEach(k => { if (storageMock[k] !== undefined) result[k] = storageMock[k]; });
          return Promise.resolve(result);
        }
        // Object with defaults
        if (typeof keys === 'object') {
          const result = { ...keys };
          for (const k of Object.keys(keys)) {
            if (storageMock[k] !== undefined) result[k] = storageMock[k];
          }
          return Promise.resolve(result);
        }
        return Promise.resolve({});
      }),
      set: vi.fn((items) => {
        Object.assign(storageMock, items);
        return Promise.resolve();
      }),
      remove: vi.fn((keys) => {
        const arr = Array.isArray(keys) ? keys : [keys];
        arr.forEach(k => delete storageMock[k]);
        return Promise.resolve();
      }),
      getBytesInUse: vi.fn().mockResolvedValue(0),
      clear: vi.fn(() => {
        for (const key of Object.keys(storageMock)) delete storageMock[key];
        return Promise.resolve();
      }),
      onChanged: { addListener: vi.fn() },
    },
    session: {
      get: vi.fn((keys) => {
        if (keys === null || keys === undefined) return Promise.resolve({ ...sessionStorageMock });
        if (typeof keys === 'string') {
          return Promise.resolve(sessionStorageMock[keys] !== undefined ? { [keys]: sessionStorageMock[keys] } : {});
        }
        if (Array.isArray(keys)) {
          const result = {};
          keys.forEach(k => { if (sessionStorageMock[k] !== undefined) result[k] = sessionStorageMock[k]; });
          return Promise.resolve(result);
        }
        if (typeof keys === 'object') {
          const result = { ...keys };
          for (const k of Object.keys(keys)) {
            if (sessionStorageMock[k] !== undefined) result[k] = sessionStorageMock[k];
          }
          return Promise.resolve(result);
        }
        return Promise.resolve({});
      }),
      set: vi.fn((items) => {
        Object.assign(sessionStorageMock, items);
        return Promise.resolve();
      }),
      remove: vi.fn((keys) => {
        const arr = Array.isArray(keys) ? keys : [keys];
        arr.forEach(k => delete sessionStorageMock[k]);
        return Promise.resolve();
      }),
    },
    onChanged: { addListener: vi.fn() },
  },
  tabs: {
    query: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    reload: vi.fn().mockResolvedValue(),
    remove: vi.fn().mockResolvedValue(),
    get: vi.fn().mockResolvedValue({ id: 1, url: 'https://example.com' }),
    sendMessage: vi.fn().mockResolvedValue({}),
    onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
    onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
    onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  action: {
    setBadgeText: vi.fn().mockResolvedValue(),
    setBadgeBackgroundColor: vi.fn().mockResolvedValue(),
    onClicked: { addListener: vi.fn() },
  },
  webNavigation: {
    onBeforeNavigate: { addListener: vi.fn() },
    onCommitted: { addListener: vi.fn() },
  },
  cookies: {
    getAll: vi.fn().mockResolvedValue([]),
    set: vi.fn().mockResolvedValue({}),
    remove: vi.fn().mockResolvedValue({}),
  },
  sidePanel: {
    setOptions: vi.fn().mockResolvedValue(),
  },
  commands: {
    onCommand: { addListener: vi.fn() },
  },
  notifications: {
    create: vi.fn().mockImplementation((...args) => {
      const id = typeof args[0] === 'string' ? args[0] : 'notif_' + Date.now();
      return Promise.resolve(id);
    }),
    clear: vi.fn().mockResolvedValue(true),
    onClicked: { addListener: vi.fn() },
    onClosed: { addListener: vi.fn() },
  },
  alarms: {
    create: vi.fn().mockResolvedValue(),
    clear: vi.fn().mockResolvedValue(),
    clearAll: vi.fn().mockResolvedValue(),
    get: vi.fn().mockResolvedValue(null),
    getAll: vi.fn().mockResolvedValue([]),
    onAlarm: { addListener: vi.fn() },
  },
  contextMenus: {
    create: vi.fn().mockReturnValue(1),
    removeAll: vi.fn().mockResolvedValue(),
    onClicked: { addListener: vi.fn() },
  },
  userScripts: {
    register: vi.fn().mockResolvedValue(),
    unregister: vi.fn().mockResolvedValue(),
    getScripts: vi.fn().mockResolvedValue([]),
    configureWorld: vi.fn().mockResolvedValue(),
    resetWorldConfiguration: vi.fn().mockResolvedValue(),
  },
  scripting: {
    insertCSS: vi.fn().mockResolvedValue(),
    removeCSS: vi.fn().mockResolvedValue(),
    executeScript: vi.fn().mockResolvedValue([]),
  },
  offscreen: {
    hasDocument: vi.fn().mockResolvedValue(false),
    createDocument: vi.fn().mockResolvedValue(),
  },
  downloads: {
    download: vi.fn(),
    search: vi.fn().mockResolvedValue([]),
    cancel: vi.fn().mockResolvedValue(),
    onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  i18n: {
    getMessage: vi.fn((key) => ''),
    getUILanguage: vi.fn(() => 'en'),
  },
  identity: {
    getAuthToken: vi.fn().mockResolvedValue('mock-token'),
    getRedirectURL: vi.fn((path = '') => `https://test-extension.chromiumapp.org/${path}`),
    launchWebAuthFlow: vi.fn().mockResolvedValue(null),
    removeCachedAuthToken: vi.fn().mockResolvedValue(),
  },
  permissions: {
    request: vi.fn().mockResolvedValue(true),
    addHostAccessRequest: vi.fn().mockResolvedValue(),
    getAll: vi.fn().mockResolvedValue({ permissions: [] }),
    contains: vi.fn().mockResolvedValue(false),
    remove: vi.fn().mockResolvedValue(true),
    onAdded: { addListener: vi.fn() },
    onRemoved: { addListener: vi.fn() },
  },
  declarativeNetRequest: {
    updateDynamicRules: vi.fn().mockResolvedValue(),
  },
};

// Helper to reset storage mock between tests
globalThis.__resetStorageMock = () => {
  for (const key of Object.keys(storageMock)) delete storageMock[key];
  for (const key of Object.keys(sessionStorageMock)) delete sessionStorageMock[key];
  // Also wipe IndexedDB so per-test seeding starts from a clean DB.
  globalThis.indexedDB = new IDBFactory();
};

// Mock crypto pieces that are absent in some Vitest worker pools.
if (!globalThis.crypto) {
  globalThis.crypto = {};
}
if (!globalThis.crypto.randomUUID) {
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    configurable: true,
    value: () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    }),
  });
}
// Some Vitest worker pools expose a partial (or no) SubtleCrypto. Fill in the
// primitives the source modules + their tests rely on (digest/importKey/sign/
// verify/exportKey/generateKey) without clobbering a real implementation when
// one is present. Native SubtleCrypto exposes its methods on the prototype, so
// `typeof base.method === 'function'` is the reliable presence check.
{
  const base = globalThis.crypto.subtle || {};
  const needsFill =
    typeof base.digest !== 'function' ||
    typeof base.importKey !== 'function' ||
    typeof base.sign !== 'function' ||
    typeof base.verify !== 'function';
  if (needsFill) {
    const filled = { ...base };
    const ensure = (name, factory) => {
      if (typeof filled[name] !== 'function') filled[name] = factory();
    };
    ensure('digest', () => vi.fn().mockResolvedValue(new ArrayBuffer(32)));
    ensure('importKey', () => vi.fn().mockResolvedValue({}));
    ensure('exportKey', () => vi.fn().mockResolvedValue(new ArrayBuffer(32)));
    ensure('sign', () => vi.fn().mockResolvedValue(new ArrayBuffer(64)));
    ensure('verify', () => vi.fn().mockResolvedValue(true));
    ensure('generateKey', () =>
      vi.fn().mockResolvedValue({ publicKey: {}, privateKey: {} }));
    Object.defineProperty(globalThis.crypto, 'subtle', {
      configurable: true,
      value: filled,
    });
  }
}

/**
 * Load a generated JS module using vm.Script with a filename so v8
 * coverage can instrument the code. Falls back to new Function() if
 * vm.Script fails (e.g. sandboxed environments).
 *
 * @param {string} relativePath  Path relative to project root (e.g. 'modules/error-log.js')
 * @param {Record<string, unknown>} globals  Named globals to inject into the scope
 * @param {string} returnExpr  Expression to return from the module (e.g. '{ ErrorLog }')
 * @returns {unknown}  The evaluated return value
 */
globalThis.__loadGeneratedModule = function loadGeneratedModule(relativePath, globals = {}, returnExpr = '{}') {
  const root = process.cwd();
  const absPath = resolve(root, relativePath);
  const code = readFileSync(absPath, 'utf8');
  const body = code + '\nreturn ' + returnExpr + ';';
  const paramNames = Object.keys(globals);
  try {
    const fn = vm.compileFunction(body, paramNames, { filename: absPath });
    return fn(...Object.values(globals));
  } catch {
    const fn = new Function(...paramNames, body);
    return fn(...Object.values(globals));
  }
};

globalThis.__createModuleFactory = function createModuleFactory(relativePath, paramNames, returnExpr = '{}') {
  const root = process.cwd();
  const absPath = resolve(root, relativePath);
  const code = readFileSync(absPath, 'utf8');
  const body = code + '\nreturn ' + returnExpr + ';';
  try {
    return vm.compileFunction(body, paramNames, { filename: absPath });
  } catch {
    return new Function(...paramNames, body);
  }
};
