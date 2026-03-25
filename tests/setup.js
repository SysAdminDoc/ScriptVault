// ScriptVault Test Setup
// Mocks Chrome extension APIs for vitest (jsdom environment)

import { vi } from 'vitest';

// Mock chrome.* APIs
const storageMock = {};

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
        if (typeof keys === 'string') return Promise.resolve({ [keys]: storageMock[keys] });
        if (Array.isArray(keys)) {
          const result = {};
          keys.forEach(k => { if (storageMock[k] !== undefined) result[k] = storageMock[k]; });
          return Promise.resolve(result);
        }
        return Promise.resolve({ ...storageMock });
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
      onChanged: { addListener: vi.fn() },
    },
    session: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(),
      remove: vi.fn().mockResolvedValue(),
    },
    onChanged: { addListener: vi.fn() },
  },
  tabs: {
    query: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    reload: vi.fn().mockResolvedValue(),
    onActivated: { addListener: vi.fn() },
    onUpdated: { addListener: vi.fn() },
    onRemoved: { addListener: vi.fn() },
  },
  notifications: {
    create: vi.fn(),
    clear: vi.fn(),
    onClicked: { addListener: vi.fn() },
    onClosed: { addListener: vi.fn() },
  },
  alarms: {
    create: vi.fn(),
    clear: vi.fn(),
    get: vi.fn().mockResolvedValue(null),
    onAlarm: { addListener: vi.fn() },
  },
  contextMenus: {
    create: vi.fn(),
    removeAll: vi.fn(),
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
  },
  offscreen: {
    hasDocument: vi.fn().mockResolvedValue(false),
    createDocument: vi.fn().mockResolvedValue(),
  },
  downloads: {
    download: vi.fn(),
    onChanged: { addListener: vi.fn() },
  },
  i18n: {
    getMessage: vi.fn((key) => ''),
    getUILanguage: vi.fn(() => 'en'),
  },
  identity: {
    getAuthToken: vi.fn().mockResolvedValue('mock-token'),
  },
  permissions: {
    request: vi.fn().mockResolvedValue(true),
  },
  declarativeNetRequest: {
    updateDynamicRules: vi.fn().mockResolvedValue(),
  },
};

// Mock crypto.randomUUID
if (!globalThis.crypto?.randomUUID) {
  const origCrypto = globalThis.crypto || {};
  globalThis.crypto = {
    ...origCrypto,
    randomUUID: () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    }),
    subtle: origCrypto.subtle || {
      digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    },
  };
}
