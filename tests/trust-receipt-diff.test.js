import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { createScriptTrustReceipt, sha256Hex } from '../src/background/trust-receipt.ts';
import { UpdateSystem } from '../src/background/update-checker.ts';

const originalCrypto = globalThis.crypto;

function makeMeta(overrides = {}) {
  return {
    name: 'Receipt Diff Demo',
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
    updateURL: 'https://cdn.example.com/diff.meta.js',
    downloadURL: 'https://cdn.example.com/diff.user.js',
    supportURL: '',
    license: '',
    copyright: '',
    contributionURL: '',
    match: ['https://same.example/*', 'https://old.example/*'],
    include: [],
    exclude: [],
    excludeMatch: [],
    matchTop: [],
    excludeTop: [],
    'run-at': 'document-idle',
    'inject-into': 'auto',
    module: '',
    noframes: false,
    unwrap: false,
    sandbox: '',
    'run-in': '',
    grant: ['GM_xmlhttpRequest', 'GM_setValue'],
    require: ['https://cdn.example.com/shared.js', 'https://cdn.example.com/old-lib.js'],
    requireProvenance: [],
    requireIdentity: [],
    resource: {},
    connect: ['https://api.same.example/*', 'https://api.old.example/*'],
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
    id: 'script_diff',
    code: '// ==UserScript==\n// @name Receipt Diff Demo\n// @version 1.0.0\n// ==/UserScript==\nconsole.log("old");',
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

function makeNextMeta() {
  return makeMeta({
    version: '2.0.0',
    match: ['https://same.example/*', 'https://new.example/*'],
    grant: ['GM_setValue', 'GM_notification'],
    connect: ['https://api.same.example/*', 'https://api.new.example/*'],
    require: ['https://cdn.example.com/shared.js', 'https://cdn.example.com/new-lib.js'],
  });
}

function makeDependencyFetcher(bodies) {
  return vi.fn(async url => bodies[url] ?? null);
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
});

afterEach(() => {
  Object.defineProperty(globalThis, 'crypto', { value: originalCrypto, configurable: true });
  delete globalThis.parseUserscript;
  delete globalThis.unregisterScript;
  delete globalThis.registerScript;
  delete globalThis.SettingsManager;
  delete globalThis.ScriptStorage;
});

describe('trust receipt dependency and permission diffs', () => {
  it('records added, removed, and changed @require body hashes', async () => {
    const previousSharedHash = await sha256Hex('shared-v1');
    const previousOldHash = await sha256Hex('old-lib-v1');
    const previous = makeScript({
      trustReceipt: {
        schemaVersion: 1,
        operation: 'install',
        createdAt: 1000,
        source: { installUrl: '', installHost: '', updateUrl: '', downloadUrl: '', homepageUrl: '' },
        hashes: { sha256: await sha256Hex('old-code') },
        grants: [],
        hostScope: { match: [], include: [], exclude: [], excludeMatch: [], connect: [] },
        dependencies: {
          require: [
            { url: 'https://cdn.example.com/shared.js', sha256: previousSharedHash, bytes: 9 },
            { url: 'https://cdn.example.com/old-lib.js', sha256: previousOldHash, bytes: 10 },
          ],
          resource: [],
          requireCount: 2,
          resourceCount: 0,
        },
        diff: { previousVersion: '', nextVersion: '1.0.0', previousHash: '', nextHash: '', previousLines: 0, nextLines: 0, addedLines: 0, removedLines: 0 },
        rollback: { available: false, action: 'rollbackScript', scriptId: '', version: '', updatedAt: null, historyIndex: null },
        lineCount: 1,
      },
    });
    const fetchDependencyBody = makeDependencyFetcher({
      'https://cdn.example.com/shared.js': 'shared-v2',
      'https://cdn.example.com/new-lib.js': 'new-lib-v1',
    });

    const receipt = await createScriptTrustReceipt({
      operation: 'manual-update',
      code: '// ==UserScript==\n// @name Receipt Diff Demo\n// @version 2.0.0\n// ==/UserScript==\nconsole.log("new");',
      meta: makeNextMeta(),
      sourceUrl: 'https://cdn.example.com/diff.user.js',
      previousScript: previous,
      rollbackIndex: 0,
      fetchDependencyBody,
    });

    expect(fetchDependencyBody).toHaveBeenCalledWith('https://cdn.example.com/shared.js');
    expect(fetchDependencyBody).toHaveBeenCalledWith('https://cdn.example.com/new-lib.js');
    expect(fetchDependencyBody).not.toHaveBeenCalledWith('https://cdn.example.com/old-lib.js');
    expect(receipt.dependencies.require).toEqual([
      {
        url: 'https://cdn.example.com/shared.js',
        sha256: await sha256Hex('shared-v2'),
        bytes: 9,
      },
      {
        url: 'https://cdn.example.com/new-lib.js',
        sha256: await sha256Hex('new-lib-v1'),
        bytes: 10,
      },
    ]);
    expect(receipt.dependencyChanges.require).toEqual([
      {
        url: 'https://cdn.example.com/shared.js',
        change: 'changed',
        previousSha256: previousSharedHash,
        nextSha256: await sha256Hex('shared-v2'),
        previousBytes: 9,
        nextBytes: 9,
        previousError: undefined,
        nextError: undefined,
      },
      {
        url: 'https://cdn.example.com/old-lib.js',
        change: 'removed',
        previousSha256: previousOldHash,
        nextSha256: undefined,
        previousBytes: 10,
        nextBytes: undefined,
        previousError: undefined,
        nextError: undefined,
      },
      {
        url: 'https://cdn.example.com/new-lib.js',
        change: 'added',
        previousSha256: undefined,
        nextSha256: await sha256Hex('new-lib-v1'),
        previousBytes: undefined,
        nextBytes: 10,
        previousError: undefined,
        nextError: undefined,
      },
    ]);
  });

  it('records @grant, @connect, and @match permission diffs', async () => {
    const receipt = await createScriptTrustReceipt({
      operation: 'manual-update',
      code: '// ==UserScript==\n// @name Receipt Diff Demo\n// @version 2.0.0\n// ==/UserScript==\nconsole.log("new");',
      meta: makeNextMeta(),
      previousScript: makeScript(),
      fetchDependencyBody: makeDependencyFetcher({
        'https://cdn.example.com/shared.js': 'shared-v2',
        'https://cdn.example.com/old-lib.js': 'old-lib-v1',
        'https://cdn.example.com/new-lib.js': 'new-lib-v1',
      }),
    });

    expect(receipt.permissionChanges.grant).toEqual({
      added: ['GM_notification'],
      removed: ['GM_xmlhttpRequest'],
      unchanged: ['GM_setValue'],
    });
    expect(receipt.permissionChanges.connect).toEqual({
      added: ['https://api.new.example/*'],
      removed: ['https://api.old.example/*'],
      unchanged: ['https://api.same.example/*'],
    });
    expect(receipt.permissionChanges.match).toEqual({
      added: ['https://new.example/*'],
      removed: ['https://old.example/*'],
      unchanged: ['https://same.example/*'],
    });
  });

  it('applyUpdate persists dependency and permission diffs on the latest receipt', async () => {
    const oldCode = '// ==UserScript==\n// @name Receipt Diff Demo\n// @version 1.0.0\n// ==/UserScript==\nconsole.log("old");';
    const oldHash = await sha256Hex(oldCode);
    const oldScript = makeScript({
      code: oldCode,
      trustReceipt: {
        schemaVersion: 1,
        operation: 'install',
        createdAt: 1000,
        source: { installUrl: '', installHost: '', updateUrl: '', downloadUrl: '', homepageUrl: '' },
        hashes: { sha256: oldHash },
        grants: [],
        hostScope: { match: [], include: [], exclude: [], excludeMatch: [], connect: [] },
        dependencies: {
          require: [
            { url: 'https://cdn.example.com/shared.js', sha256: await sha256Hex('shared-v1'), bytes: 9 },
            { url: 'https://cdn.example.com/old-lib.js', sha256: await sha256Hex('old-lib-v1'), bytes: 10 },
          ],
          resource: [],
          requireCount: 2,
          resourceCount: 0,
        },
        diff: { previousVersion: '', nextVersion: '1.0.0', previousHash: '', nextHash: '', previousLines: 0, nextLines: 0, addedLines: 0, removedLines: 0 },
        rollback: { available: false, action: 'rollbackScript', scriptId: '', version: '', updatedAt: null, historyIndex: null },
        lineCount: 1,
      },
    });
    let savedScript = null;
    globalThis.parseUserscript = vi.fn(code => ({
      meta: code.includes('@version 2.0.0') ? makeNextMeta() : makeMeta(),
      code,
      metaBlock: '// ==UserScript==\n// ==/UserScript==',
    }));
    globalThis.unregisterScript = vi.fn().mockResolvedValue();
    globalThis.registerScript = vi.fn().mockResolvedValue();
    globalThis.SettingsManager = { get: vi.fn().mockResolvedValue({ notifyOnUpdate: false }) };
    globalThis.ScriptStorage = {
      get: vi.fn().mockResolvedValue(oldScript),
      getAll: vi.fn().mockResolvedValue([oldScript]),
      set: vi.fn(async (_id, script) => { savedScript = script; }),
    };

    const result = await UpdateSystem.applyUpdate(
      'script_diff',
      '// ==UserScript==\n// @name Receipt Diff Demo\n// @version 2.0.0\n// ==/UserScript==\nconsole.log("new");',
      {
        force: true,
        fetchDependencyBody: makeDependencyFetcher({
          'https://cdn.example.com/shared.js': 'shared-v2',
          'https://cdn.example.com/old-lib.js': 'old-lib-v1',
          'https://cdn.example.com/new-lib.js': 'new-lib-v1',
        }),
      },
    );

    expect(result.success).toBe(true);
    expect(savedScript.trustReceipt.dependencyChanges.require.map(change => change.change)).toEqual([
      'changed',
      'removed',
      'added',
    ]);
    expect(savedScript.trustReceipt.permissionChanges.grant.added).toEqual(['GM_notification']);
    expect(savedScript.trustReceipt.permissionChanges.connect.removed).toEqual(['https://api.old.example/*']);
    expect(savedScript.versionHistory[0].trustReceipt.hashes.sha256).toBe(oldHash);

  });
});

describe('dashboard trust-change review wiring', () => {
  const dashboard = readFileSync(resolve(process.cwd(), 'pages/dashboard.js'), 'utf8');
  const background = readFileSync(resolve(process.cwd(), 'background.core.js'), 'utf8');

  it('surfaces update trust diffs in the recent-updates banner', () => {
    expect(background).toContain('dependencyChanges: result.script?.trustReceipt?.dependencyChanges');
    expect(background).toContain('permissionChanges: result.script?.trustReceipt?.permissionChanges');
    expect(dashboard).toContain('Review changes');
    expect(dashboard).toContain('showRecentUpdateChangesModal');
    expect(dashboard).toContain('renderDependencyChangeRows');
    expect(dashboard).toContain('renderPermissionChangeGroup');
  });
});
