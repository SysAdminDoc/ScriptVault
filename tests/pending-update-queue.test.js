import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';

import { UpdateSystem } from '../src/background/update-checker.ts';

const originalCrypto = globalThis.crypto;

function makeMeta(overrides = {}) {
  return {
    name: 'Queued Script',
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
    updateURL: 'https://cdn.example.com/queued.meta.js',
    downloadURL: 'https://cdn.example.com/queued.user.js',
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
    module: '',
    noframes: false,
    unwrap: false,
    sandbox: '',
    'run-in': '',
    grant: ['GM_getValue'],
    require: [],
    resource: {},
    connect: [],
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

function makeScript(id, overrides = {}) {
  const meta = makeMeta(overrides.meta || {});
  return {
    id,
    code: makeCode(meta.name, meta.version),
    enabled: true,
    position: 0,
    meta,
    settings: {},
    versionHistory: [],
    createdAt: 1000,
    updatedAt: 2000,
    ...overrides,
    meta,
  };
}

function makeCode(name, version) {
  return [
    '// ==UserScript==',
    `// @name ${name}`,
    `// @version ${version}`,
    '// ==/UserScript==',
    `console.log(${JSON.stringify(version)});`,
  ].join('\n');
}

function parseQueuedCode(code) {
  const version = code.match(/@version\s+([^\n]+)/)?.[1]?.trim() || '1.0.0';
  const name = code.match(/@name\s+([^\n]+)/)?.[1]?.trim() || 'Queued Script';
  const grants = code.includes('GM_xmlhttpRequest')
    ? ['GM_getValue', 'GM_xmlhttpRequest']
    : ['GM_getValue'];
  return {
    meta: makeMeta({ name, version, grant: grants }),
    code,
    metaBlock: '// ==UserScript==\n// ==/UserScript==',
  };
}

function installStorage(scripts) {
  globalThis.ScriptStorage = {
    get: vi.fn(async id => scripts.get(id) || null),
    getAll: vi.fn(async () => Array.from(scripts.values())),
    set: vi.fn(async (id, script) => {
      scripts.set(id, script);
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.__resetStorageMock?.();
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  UpdateSystem._pendingUpdates = null;
  globalThis.parseUserscript = vi.fn(parseQueuedCode);
  globalThis.installFromCode = vi.fn(async code => ({
    success: true,
    script: {
      id: 'installed-from-subscription',
      code,
      meta: parseQueuedCode(code).meta,
      trustReceipt: {
        dependencyChanges: { require: [] },
        permissionChanges: null,
      },
    },
  }));
  globalThis.unregisterScript = vi.fn().mockResolvedValue();
  globalThis.registerScript = vi.fn().mockResolvedValue();
  globalThis.SettingsManager = {
    get: vi.fn().mockResolvedValue({ autoUpdate: true, autoUpdateMode: 'notify', notifyOnUpdate: false }),
    set: vi.fn().mockResolvedValue({}),
  };
});

afterEach(() => {
  Object.defineProperty(globalThis, 'crypto', { value: originalCrypto, configurable: true });
  UpdateSystem._pendingUpdates = null;
  delete globalThis.parseUserscript;
  delete globalThis.installFromCode;
  delete globalThis.unregisterScript;
  delete globalThis.registerScript;
  delete globalThis.SettingsManager;
  delete globalThis.ScriptStorage;
});

describe('pending update queue', () => {
  it('queues safe updates without applying them', async () => {
    const scripts = new Map([['safe', makeScript('safe')]]);
    installStorage(scripts);

    const result = await UpdateSystem.queueUpdates([{
      id: 'safe',
      name: 'Queued Script',
      currentVersion: '1.0.0',
      newVersion: '2.0.0',
      code: makeCode('Queued Script', '2.0.0'),
      sourceUrl: 'https://cdn.example.com/queued.user.js',
    }]);

    expect(result.queued).toBe(1);
    expect(result.pendingUpdates[0].safeToApply).toBe(true);
    expect(globalThis.registerScript).not.toHaveBeenCalled();

    const stored = await chrome.storage.local.get('pendingUpdates');
    expect(stored.pendingUpdates).toHaveLength(1);
  });

  it('marks permission-expanding updates for review', async () => {
    const scripts = new Map([['risky', makeScript('risky')]]);
    installStorage(scripts);

    const result = await UpdateSystem.queueUpdates([{
      id: 'risky',
      name: 'Queued Script',
      currentVersion: '1.0.0',
      newVersion: '2.0.0',
      code: `${makeCode('Queued Script', '2.0.0')}\nGM_xmlhttpRequest({ url: 'https://api.example.com' });`,
      sourceUrl: 'https://cdn.example.com/queued.user.js',
    }]);

    expect(result.pendingUpdates[0].safeToApply).toBe(false);
    expect(result.pendingUpdates[0].reviewReasons).toContain('Adds permissions or host scope');
  });

  it('marks provenance verification failures for review', () => {
    const reasons = UpdateSystem._getUpdateReviewReasons({
      permissionChanges: null,
      dependencyChanges: { require: [] },
      dependencies: {
        require: [{
          url: 'https://cdn.example.com/lib.js',
          provenance: {
            status: 'declared',
            verification: 'root-verification-failed',
          },
        }],
      },
    }, false);

    expect(reasons).toContain('Fails @require provenance verification');
  });

  it('applies only safe queued updates and leaves review items queued', async () => {
    const scripts = new Map([
      ['safe', makeScript('safe')],
      ['risky', makeScript('risky')],
    ]);
    installStorage(scripts);

    await UpdateSystem.queueUpdates([
      {
        id: 'safe',
        name: 'Safe',
        currentVersion: '1.0.0',
        newVersion: '2.0.0',
        code: makeCode('Safe', '2.0.0'),
        sourceUrl: 'https://cdn.example.com/queued.user.js',
      },
      {
        id: 'risky',
        name: 'Risky',
        currentVersion: '1.0.0',
        newVersion: '2.0.0',
        code: `${makeCode('Risky', '2.0.0')}\nGM_xmlhttpRequest({ url: 'https://api.example.com' });`,
        sourceUrl: 'https://cdn.example.com/queued.user.js',
      },
    ]);

    const result = await UpdateSystem.applySafePendingUpdates(['safe', 'risky']);

    expect(result.applied).toBe(1);
    expect(result.pendingUpdates.map(item => item.id)).toEqual(['risky']);
    expect(scripts.get('safe').meta.version).toBe('2.0.0');
    expect(globalThis.registerScript).toHaveBeenCalledTimes(1);
  });

  it('scheduled autoUpdate queues by default instead of applying', async () => {
    const scripts = new Map([['safe', makeScript('safe')]]);
    installStorage(scripts);
    const checkSpy = vi.spyOn(UpdateSystem, 'checkForUpdates').mockResolvedValue([{
      id: 'safe',
      name: 'Safe',
      currentVersion: '1.0.0',
      newVersion: '2.0.0',
      code: makeCode('Safe', '2.0.0'),
      sourceUrl: 'https://cdn.example.com/queued.user.js',
    }]);
    const applySpy = vi.spyOn(UpdateSystem, 'applyUpdate');

    await UpdateSystem.autoUpdate();

    expect(checkSpy).toHaveBeenCalledTimes(1);
    expect(applySpy).not.toHaveBeenCalled();
    expect(await UpdateSystem.getPendingUpdates()).toHaveLength(1);

    checkSpy.mockRestore();
    applySpy.mockRestore();
  });

  it('queues subscription installs for review and excludes them from apply-safe', async () => {
    const scripts = new Map();
    installStorage(scripts);

    const queueResult = await UpdateSystem.queueSubscriptionInstalls([{
      id: 'subscription_one',
      name: 'New Script',
      newVersion: '1.0.0',
      code: makeCode('New Script', '1.0.0'),
      sourceUrl: 'https://cdn.example.com/new.user.js',
      subscriptionId: 'feed-1',
      subscriptionName: 'Curated Feed',
    }]);

    expect(queueResult.queued).toBe(1);
    expect(queueResult.pendingUpdates[0]).toMatchObject({
      kind: 'subscription-install',
      safeToApply: false,
      reviewReasons: ['New script from subscription'],
      subscriptionId: 'feed-1',
      subscriptionName: 'Curated Feed',
    });

    const safeResult = await UpdateSystem.applySafePendingUpdates();
    expect(safeResult.applied).toBe(0);
    expect(safeResult.pendingUpdates).toHaveLength(1);
    expect(globalThis.installFromCode).not.toHaveBeenCalled();
  });

  it('applies a reviewed subscription install through installFromCode', async () => {
    const scripts = new Map();
    installStorage(scripts);

    await UpdateSystem.queueSubscriptionInstalls([{
      id: 'subscription_one',
      code: makeCode('New Script', '1.0.0'),
      sourceUrl: 'https://cdn.example.com/new.user.js',
      subscriptionId: 'feed-1',
      subscriptionName: 'Curated Feed',
    }]);

    const result = await UpdateSystem.applyPendingUpdate('subscription_one', { force: true });

    expect(result.success).toBe(true);
    expect(globalThis.installFromCode).toHaveBeenCalledWith(makeCode('New Script', '1.0.0'), {
      sourceUrl: 'https://cdn.example.com/new.user.js',
      operation: 'subscription-install',
    });
    expect(await UpdateSystem.getPendingUpdates()).toEqual([]);
  });
});
