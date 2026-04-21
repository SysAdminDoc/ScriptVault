import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import { NetworkLog } from '../src/bg/netlog.ts';

beforeEach(() => {
  globalThis.__resetStorageMock();
  NetworkLog.clear();
  NetworkLog._maxEntries = 2000;
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function loadFreshWorkspaceManager(scripts) {
  vi.resetModules();

  const scriptList = scripts.map((script) => ({ ...script }));
  const scriptCache = Object.fromEntries(scriptList.map((script) => [script.id, script]));
  const save = vi.fn().mockResolvedValue();
  const getAll = vi.fn().mockImplementation(async () => scriptList);
  // activate() uses ScriptStorage.set() per script (matches bg/workspaces.js
  // rollback-safe pattern). Mock set to also update the live scriptList/cache
  // so downstream assertions observe the mutation.
  const set = vi.fn().mockImplementation(async (id, script) => {
    scriptCache[id] = script;
    const idx = scriptList.findIndex((s) => s.id === id);
    if (idx >= 0) scriptList[idx] = script;
  });
  const registerAllScripts = vi.fn().mockResolvedValue();
  const updateBadge = vi.fn().mockResolvedValue();

  vi.doMock('../src/modules/storage.ts', () => ({
    ScriptStorage: {
      cache: scriptCache,
      getAll,
      save,
      set,
    },
  }));
  vi.doMock('../src/background/registration.ts', () => ({ registerAllScripts }));
  vi.doMock('../src/background/badge.ts', () => ({ updateBadge }));

  const mod = await import('../src/bg/workspaces.ts');
  return {
    WorkspaceManager: mod.WorkspaceManager,
    scriptCache,
    scriptList,
    save,
    set,
    registerAllScripts,
    updateBadge,
  };
}

async function loadFreshSigningModule() {
  vi.resetModules();

  const settingsState = { trustedSigningKeys: {} };
  const get = vi.fn(async () => structuredClone(settingsState));
  const set = vi.fn(async (key, value) => {
    if (typeof key === 'object') {
      Object.assign(settingsState, key);
    } else {
      settingsState[key] = value;
    }
    return structuredClone(settingsState);
  });

  vi.doMock('../src/modules/storage.ts', () => ({
    SettingsManager: { get, set },
  }));

  const mod = await import('../src/bg/signing.ts');
  return { ScriptSigning: mod.ScriptSigning, settingsState, get, set };
}

describe('source network log module', () => {
  it('stores newest entries first and filters them correctly', () => {
    NetworkLog.add({ url: 'https://first.example/api', method: 'GET', scriptId: 'alpha', status: 200, responseSize: 128 });
    NetworkLog.add({ url: 'https://second.example/api', method: 'POST', scriptId: 'beta', error: 'timeout' });

    const all = NetworkLog.getAll();
    const errors = NetworkLog.getAll({ status: 'error' });
    const stats = NetworkLog.getStats();

    expect(all[0].url).toContain('second.example');
    expect(errors).toHaveLength(1);
    expect(stats.totalRequests).toBe(2);
    expect(stats.totalErrors).toBe(1);
    expect(stats.byScript.alpha.bytes).toBe(128);
  });

  it('clears by script id without touching other entries', () => {
    NetworkLog.add({ url: 'https://a.example', scriptId: 'alpha' });
    NetworkLog.add({ url: 'https://b.example', scriptId: 'beta' });

    NetworkLog.clear('alpha');

    expect(NetworkLog.getAll({ limit: 10 })).toHaveLength(1);
    expect(NetworkLog.getAll({ limit: 10 })[0].scriptId).toBe('beta');
  });
});

describe('source workspace manager module', () => {
  it('creates and saves a workspace snapshot from the live script list', async () => {
    const { WorkspaceManager } = await loadFreshWorkspaceManager([
      { id: 'alpha', enabled: true, updatedAt: 1 },
      { id: 'beta', enabled: false, updatedAt: 1 },
    ]);

    const workspace = await WorkspaceManager.create('Focus');

    expect(workspace.name).toBe('Focus');
    expect(workspace.snapshot).toEqual({ alpha: true, beta: false });
    expect((await WorkspaceManager.getAll()).list).toHaveLength(1);
  });

  it('activates a workspace, persists changed script states, and refreshes registrations', async () => {
    const harness = await loadFreshWorkspaceManager([
      { id: 'alpha', enabled: true, updatedAt: 1 },
      { id: 'beta', enabled: true, updatedAt: 1 },
    ]);
    const { WorkspaceManager, scriptCache, set, registerAllScripts, updateBadge } = harness;

    const workspace = await WorkspaceManager.create('Minimal');
    workspace.snapshot.beta = false;

    const result = await WorkspaceManager.activate(workspace.id);

    expect(result).toEqual({ success: true, name: 'Minimal' });
    expect(scriptCache.beta.enabled).toBe(false);
    // Only beta's state actually changed, so set() should be invoked once
    // (alpha stays enabled). rollback-safe per-script write path.
    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith('beta', expect.objectContaining({ id: 'beta', enabled: false }));
    expect(registerAllScripts).toHaveBeenCalledTimes(1);
    expect(updateBadge).toHaveBeenCalledTimes(1);
    expect((await WorkspaceManager.getAll()).active).toBe(workspace.id);
  });
});

describe('source signing module', () => {
  it('stores trusted keys via the real SettingsManager-backed source path', async () => {
    const { ScriptSigning } = await loadFreshSigningModule();

    await ScriptSigning.trustKey('pub_key_123', 'Trusted Author');
    const trusted = await ScriptSigning.getTrustedKeys();
    await ScriptSigning.untrustKey('pub_key_123');

    expect(trusted.pub_key_123.name).toBe('Trusted Author');
    expect((await ScriptSigning.getTrustedKeys()).pub_key_123).toBeUndefined();
  });

  it('verifies signatures and reports trust using mocked crypto primitives', async () => {
    const { ScriptSigning, settingsState } = await loadFreshSigningModule();
    settingsState.trustedSigningKeys.trusted_pub = { name: 'Known Signer', addedAt: 1 };

    vi.spyOn(globalThis.crypto.subtle, 'importKey').mockResolvedValue({} );
    vi.spyOn(globalThis.crypto.subtle, 'verify').mockResolvedValue(true);

    const result = await ScriptSigning.verifyScript('console.log("ok")', {
      signature: 'YWJj',
      publicKey: 'trusted_pub',
      timestamp: 123,
    });

    expect(result).toEqual({
      valid: true,
      trusted: true,
      trustedName: 'Known Signer',
      publicKey: 'trusted_pub',
      timestamp: 123,
    });
  });

  it('embeds signatures into userscript metadata using the real source helper', async () => {
    const { ScriptSigning } = await loadFreshSigningModule();
    vi.spyOn(ScriptSigning, 'signScript').mockResolvedValue({
      signature: 'sig',
      publicKey: 'pub',
      algorithm: 'Ed25519',
      timestamp: 42,
    });

    const signed = await ScriptSigning.signAndEmbedInCode([
      '// ==UserScript==',
      '// @name Demo',
      '// ==/UserScript==',
      'console.log("demo");',
    ].join('\n'));

    expect(signed).toContain('// @signature sig|pub|42');
    expect(ScriptSigning.extractSignatureFromCode(signed)).toEqual({
      signature: 'sig',
      publicKey: 'pub',
      timestamp: 42,
    });
  });
});
