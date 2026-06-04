import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';

import { createScriptTrustReceipt, sha256Hex } from '../src/background/trust-receipt.ts';
import { UpdateSystem } from '../src/background/update-checker.ts';

const originalCrypto = globalThis.crypto;

function makeMeta(overrides = {}) {
  return {
    name: 'Receipt Demo',
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
    updateURL: 'https://cdn.example.com/demo.meta.js',
    downloadURL: 'https://cdn.example.com/demo.user.js',
    supportURL: '',
    license: '',
    copyright: '',
    contributionURL: '',
    match: ['https://example.com/*'],
    include: [],
    exclude: [],
    excludeMatch: [],
    matchTop: [],
    excludeTop: [],
    'run-at': 'document-idle',
    'inject-into': 'auto',
    noframes: false,
    unwrap: false,
    sandbox: '',
    'run-in': '',
    grant: ['GM_xmlhttpRequest'],
    require: ['https://cdn.example.com/lib.js'],
    requireProvenance: [],
    requireIdentity: [],
    resource: { logo: 'https://cdn.example.com/logo.png' },
    connect: ['https://api.example.com/*'],
    'top-level-await': false,
    webRequest: null,
    priority: 0,
    weight: 1,
    antifeature: [],
    tag: [],
    compatible: [],
    incompatible: [],
    ...overrides,
  };
}

function makeScript(overrides = {}) {
  return {
    id: 'script_receipt',
    code: '// ==UserScript==\n// @name Receipt Demo\n// @version 1.0.0\n// ==/UserScript==\nconsole.log("old");',
    enabled: true,
    position: 0,
    meta: makeMeta(),
    settings: {},
    versionHistory: [],
    createdAt: 1000,
    updatedAt: 2000,
    ...overrides,
  };
}

function parseUserscriptForTest(code) {
  const version = code.includes('@version 2.0.0') ? '2.0.0' : '1.0.0';
  return {
    meta: makeMeta({ version }),
    code,
    metaBlock: '// ==UserScript==\n// ==/UserScript==',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  globalThis.parseUserscript = vi.fn(parseUserscriptForTest);
  globalThis.unregisterScript = vi.fn().mockResolvedValue();
  globalThis.registerScript = vi.fn().mockResolvedValue();
  globalThis.SettingsManager = { get: vi.fn().mockResolvedValue({ notifyOnUpdate: false }) };
});

afterEach(() => {
  Object.defineProperty(globalThis, 'crypto', { value: originalCrypto, configurable: true });
  delete globalThis.parseUserscript;
  delete globalThis.unregisterScript;
  delete globalThis.registerScript;
  delete globalThis.SettingsManager;
  delete globalThis.ScriptStorage;
});

describe('script trust receipts', () => {
  it('records source, hashes, host scope, dependencies, and diff summary', async () => {
    const previous = makeScript();
    const nextCode = '// ==UserScript==\n// @name Receipt Demo\n// @version 2.0.0\n// ==/UserScript==\nconsole.log("new");';

    const receipt = await createScriptTrustReceipt({
      operation: 'manual-update',
      code: nextCode,
      meta: makeMeta({ version: '2.0.0' }),
      sourceUrl: 'https://cdn.example.com/demo.user.js',
      previousScript: previous,
      rollbackIndex: 0,
    });

    expect(receipt.hashes.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(receipt.hashes.previousSha256).toBe(await sha256Hex(previous.code));
    expect(receipt.source.installHost).toBe('cdn.example.com');
    expect(receipt.grants).toEqual(['GM_xmlhttpRequest']);
    expect(receipt.hostScope.match).toEqual(['https://example.com/*']);
    expect(receipt.dependencies.requireCount).toBe(1);
    expect(receipt.dependencies.resource).toEqual([{ name: 'logo', url: 'https://cdn.example.com/logo.png' }]);
    expect(receipt.diff.previousVersion).toBe('1.0.0');
    expect(receipt.diff.nextVersion).toBe('2.0.0');
    expect(receipt.diff.addedLines).toBeGreaterThan(0);
    expect(receipt.rollback).toMatchObject({
      available: true,
      action: 'rollbackScript',
      scriptId: 'script_receipt',
      version: '1.0.0',
      historyIndex: 0,
    });
  });

  it('records declared @require provenance metadata without treating it as verified yet', async () => {
    const receipt = await createScriptTrustReceipt({
      operation: 'install',
      code: '// ==UserScript==\n// @name Receipt Demo\n// ==/UserScript==\nconsole.log("new");',
      meta: makeMeta({
        requireProvenance: ['https://cdn.example.com/lib.js.bundle'],
        requireIdentity: ['https://github.com/exampleuser (issuer: https://github.com/login/oauth)'],
      }),
      fetchDependencyBody: vi.fn(async () => 'library-body'),
    });

    expect(receipt.dependencies.require[0]).toMatchObject({
      url: 'https://cdn.example.com/lib.js',
      provenance: {
        bundleUrl: 'https://cdn.example.com/lib.js.bundle',
        identity: 'https://github.com/exampleuser (issuer: https://github.com/login/oauth)',
        status: 'declared',
        verification: 'not-yet-implemented',
      },
    });
  });

  it('applyUpdate stores a latest receipt and a rollback-point receipt', async () => {
    const oldScript = makeScript();
    const oldCode = oldScript.code;
    let savedScript = null;
    globalThis.ScriptStorage = {
      get: vi.fn().mockResolvedValue(oldScript),
      getAll: vi.fn().mockResolvedValue([oldScript]),
      set: vi.fn(async (_id, script) => { savedScript = script; }),
    };

    const nextCode = '// ==UserScript==\n// @name Receipt Demo\n// @version 2.0.0\n// ==/UserScript==\nconsole.log("new");';
    const result = await UpdateSystem.applyUpdate('script_receipt', nextCode, {
      force: true,
      sourceUrl: 'https://cdn.example.com/demo.user.js',
    });

    expect(result.success).toBe(true);
    expect(savedScript.trustReceipt.operation).toBe('manual-update');
    expect(savedScript.trustReceipt.rollback.available).toBe(true);
    expect(savedScript.trustReceipt.rollback.historyIndex).toBe(0);
    expect(savedScript.trustReceipt.hashes.sha256).toBe(await sha256Hex(nextCode));
    expect(savedScript.versionHistory).toHaveLength(1);
    expect(savedScript.versionHistory[0].code).toBe(oldCode);
    expect(savedScript.versionHistory[0].trustReceipt.hashes.sha256).toBe(await sha256Hex(oldCode));
  });
});
