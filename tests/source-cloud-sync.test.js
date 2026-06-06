import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalGlobals = {
  crypto: globalThis.crypto,
  debugLog: globalThis.debugLog,
  parseUserscript: globalThis.parseUserscript,
  ScriptAnalyzer: globalThis.ScriptAnalyzer,
  CloudSyncProviders: globalThis.CloudSyncProviders,
  SettingsManager: globalThis.SettingsManager,
  ScriptStorage: globalThis.ScriptStorage,
  ScriptValues: globalThis.ScriptValues,
  registerScript: globalThis.registerScript,
  unregisterScript: globalThis.unregisterScript,
  updateBadge: globalThis.updateBadge,
};

async function loadFreshCloudSync(initialScripts, remoteData, settingsOverride = {}, valuesByScript = {}) {
  vi.resetModules();

  const scriptState = initialScripts.map((script) => structuredClone(script));
  const valueState = structuredClone(valuesByScript);
  let remoteStore = remoteData == null ? null : structuredClone(remoteData);
  const ScriptStorage = {
    getAll: vi.fn(async () => structuredClone(scriptState)),
    get: vi.fn(async (id) => scriptState.find((script) => script.id === id) ?? null),
    set: vi.fn(async (_id, script) => {
      const idx = scriptState.findIndex((entry) => entry.id === script.id);
      if (idx >= 0) {
        scriptState[idx] = structuredClone(script);
      } else {
        scriptState.push(structuredClone(script));
      }
    }),
    delete: vi.fn(async (id) => {
      const idx = scriptState.findIndex((entry) => entry.id === id);
      if (idx >= 0) {
        scriptState.splice(idx, 1);
      }
    }),
  };

  const SettingsManager = {
    get: vi.fn(async () => ({
      syncEnabled: true,
      syncProvider: 'googledrive',
      lastSync: 0,
      ...settingsOverride,
    })),
    set: vi.fn(async () => {}),
  };

  const ScriptValues = {
    getAll: vi.fn(async (scriptId) => structuredClone(valueState[scriptId] || {})),
    setAll: vi.fn(async (scriptId, values) => {
      valueState[scriptId] = structuredClone(values || {});
    }),
  };

  const provider = {
    name: 'Google Drive',
    supportsDryRun: true,
    download: vi.fn(async () => structuredClone(remoteStore)),
    upload: vi.fn(async (data) => {
      remoteStore = structuredClone(data);
    }),
  };

  const registerScript = vi.fn().mockResolvedValue();
  const unregisterScript = vi.fn().mockResolvedValue();
  const updateBadge = vi.fn().mockResolvedValue();

  vi.stubGlobal('debugLog', vi.fn());
  vi.stubGlobal('parseUserscript', vi.fn((code) => ({
    meta: { name: code.includes('Remote Beta') ? 'Remote Beta' : 'Script' },
    code,
    metaBlock: '',
  })));
  vi.stubGlobal('ScriptAnalyzer', { _ensureOffscreen: vi.fn().mockResolvedValue() });
  vi.stubGlobal('CloudSyncProviders', { googledrive: provider });
  vi.stubGlobal('SettingsManager', SettingsManager);
  vi.stubGlobal('ScriptStorage', ScriptStorage);
  vi.stubGlobal('ScriptValues', ScriptValues);
  vi.stubGlobal('registerScript', registerScript);
  vi.stubGlobal('unregisterScript', unregisterScript);
  vi.stubGlobal('updateBadge', updateBadge);

  const mod = await import('../src/background/cloud-sync.ts');
  return {
    CloudSync: mod.CloudSync,
    ScriptStorage,
    SettingsManager,
    ScriptValues,
    provider,
    registerScript,
    unregisterScript,
    updateBadge,
    scriptState,
    valueState,
    getRemoteData: () => structuredClone(remoteStore),
  };
}

beforeEach(() => {
  globalThis.__resetStorageMock();
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  vi.clearAllMocks();
});

afterEach(() => {
  for (const [key, value] of Object.entries(originalGlobals)) {
    if (key === 'crypto') {
      Object.defineProperty(globalThis, 'crypto', { value, configurable: true });
    } else {
      globalThis[key] = value;
    }
  }
});

describe('source cloud sync module', () => {
  it('does not resurrect a deleted script after local state is wiped and resynced from a remote tombstone', async () => {
    await chrome.storage.local.set({ syncTombstones: {} });

    const harness = await loadFreshCloudSync(
      [
        {
          id: 'script_alpha',
          code: '// ==UserScript==\n// @name Alpha\n// ==/UserScript==\nconsole.log("alpha");',
          enabled: true,
          position: 0,
          meta: { name: 'Alpha' },
          settings: {},
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      null,
    );
    const { CloudSync, ScriptStorage, provider, scriptState, getRemoteData } = harness;

    await expect(CloudSync.sync()).resolves.toEqual({ success: true });
    expect(getRemoteData().scripts.map((script) => script.id)).toEqual(['script_alpha']);

    await ScriptStorage.delete('script_alpha');
    await chrome.storage.local.set({ syncTombstones: { script_alpha: 2222 } });
    vi.clearAllMocks();

    await expect(CloudSync.sync()).resolves.toEqual({ success: true });
    expect(scriptState).toEqual([]);
    expect(getRemoteData()).toEqual(
      expect.objectContaining({
        scripts: [],
        tombstones: { script_alpha: 2222 },
      }),
    );

    await chrome.storage.local.set({ syncTombstones: {} });
    vi.clearAllMocks();

    await expect(CloudSync.sync()).resolves.toEqual({ success: true });
    expect(scriptState).toEqual([]);
    expect(ScriptStorage.set).not.toHaveBeenCalledWith('script_alpha', expect.anything());
    expect(provider.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        scripts: [],
        tombstones: { script_alpha: 2222 },
      }),
      expect.objectContaining({ syncProvider: 'googledrive' }),
    );
    await expect(chrome.storage.local.get('syncTombstones')).resolves.toEqual({
      syncTombstones: { script_alpha: 2222 },
    });
  });

  it('deletes tombstoned local scripts and refreshes runtime registration for synced changes', async () => {
    await chrome.storage.local.set({
      syncTombstones: {},
    });

    const harness = await loadFreshCloudSync(
      [
        {
          id: 'script_alpha',
          code: '// local alpha',
          enabled: true,
          position: 0,
          meta: { name: 'Alpha' },
          settings: {},
          createdAt: 1,
          updatedAt: 1,
        },
        {
          id: 'script_beta',
          code: '// local beta',
          enabled: true,
          position: 1,
          meta: { name: 'Beta' },
          settings: {},
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      {
        version: 1,
        timestamp: 10,
        scripts: [
          {
            id: 'script_beta',
            code: '// Remote Beta',
            enabled: false,
            position: 1,
            settings: {},
            updatedAt: 10,
          },
        ],
        tombstones: { script_alpha: 12345 },
      },
    );
    const {
      CloudSync,
      ScriptStorage,
      SettingsManager,
      provider,
      unregisterScript,
      registerScript,
      updateBadge,
      scriptState,
    } = harness;

    const result = await CloudSync.sync();

    expect(result).toEqual({ success: true });
    expect(ScriptStorage.delete).toHaveBeenCalledWith('script_alpha');
    expect(ScriptStorage.set).toHaveBeenCalledWith(
      'script_beta',
      expect.objectContaining({
        id: 'script_beta',
        code: '// Remote Beta',
        enabled: false,
        syncBaseCode: '// Remote Beta',
      }),
    );
    expect(unregisterScript).toHaveBeenCalledWith('script_alpha');
    expect(unregisterScript).toHaveBeenCalledWith('script_beta');
    expect(registerScript).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: 'script_beta' }),
    );
    expect(updateBadge).toHaveBeenCalledTimes(1);
    expect(provider.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        tombstones: { script_alpha: 12345 },
        scripts: [
          expect.objectContaining({
            id: 'script_beta',
            enabled: false,
          }),
        ],
      }),
      expect.objectContaining({ syncProvider: 'googledrive' }),
    );
    expect(SettingsManager.set).toHaveBeenCalledWith('lastSync', expect.any(Number));
    expect(scriptState).toEqual([
      expect.objectContaining({
        id: 'script_beta',
        code: '// Remote Beta',
        enabled: false,
      }),
    ]);
  });

  it('syncs only allowlisted per-script settings and keeps local-only flags local', async () => {
    await chrome.storage.local.set({
      syncTombstones: {},
    });

    const harness = await loadFreshCloudSync(
      [
        {
          id: 'script_settings',
          code: '// local settings',
          enabled: true,
          position: 0,
          meta: { name: 'Settings' },
          settings: {
            runAt: 'document-idle',
            notes: 'local note',
            syncValues: true,
            userModified: false,
            sourceIdentityChanged: true,
            _failedRequires: ['https://cdn.example.com/missing.js'],
            localWorkspaceBindingId: 'binding-local',
            localFilePath: 'C:\\Users\\--\\secret\\local.user.js',
          },
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      {
        version: 1,
        timestamp: 10,
        scripts: [
          {
            id: 'script_settings',
            code: '// Remote Settings',
            enabled: true,
            position: 0,
            settings: {
              runAt: 'document-start',
              syncValues: true,
              userMatches: ['https://example.com/*'],
              userModified: true,
              mergeConflict: true,
              _registrationError: 'remote registration failed',
            },
            updatedAt: 10,
          },
        ],
        tombstones: {},
      },
    );
    const { CloudSync, ScriptStorage, provider, scriptState, getRemoteData } = harness;

    await expect(CloudSync.sync()).resolves.toEqual({ success: true });

    expect(ScriptStorage.set).toHaveBeenCalledWith(
      'script_settings',
      expect.objectContaining({
        settings: expect.objectContaining({
          runAt: 'document-start',
          notes: 'local note',
          sourceIdentityChanged: true,
          _failedRequires: ['https://cdn.example.com/missing.js'],
          userMatches: ['https://example.com/*'],
        }),
      }),
    );
    expect(scriptState[0].settings).not.toMatchObject({
      mergeConflict: true,
      _registrationError: 'remote registration failed',
    });

    const uploaded = getRemoteData();
    expect(provider.upload).toHaveBeenCalled();
    expect(uploaded.scripts[0].settings).toEqual({
      runAt: 'document-start',
      notes: 'local note',
      syncValues: true,
      userMatches: ['https://example.com/*'],
    });
    expect(uploaded.scripts[0]).not.toHaveProperty('values');
    expect(uploaded.scripts[0]).not.toHaveProperty('storage');
    expect(JSON.stringify(uploaded)).not.toContain('binding-local');
    expect(JSON.stringify(uploaded)).not.toContain('secret\\\\local.user.js');
  });

  it('uploads capped GM value bundles only for opted-in scripts', async () => {
    await chrome.storage.local.set({
      syncTombstones: {},
    });

    const harness = await loadFreshCloudSync(
      [
        {
          id: 'script_values',
          code: '// ==UserScript==\n// @name Values\n// ==/UserScript==\n',
          enabled: true,
          position: 0,
          meta: { name: 'Values' },
          settings: { syncValues: true },
          createdAt: 1,
          updatedAt: 1,
        },
        {
          id: 'script_local_only_values',
          code: '// ==UserScript==\n// @name Local Values\n// ==/UserScript==\n',
          enabled: true,
          position: 1,
          meta: { name: 'Local Values' },
          settings: {},
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      null,
      {},
      {
        script_values: {
          alpha: { enabled: true },
          token: 'sync-token',
        },
        script_local_only_values: {
          token: 'local-only-token',
        },
      },
    );
    const { CloudSync, ScriptValues, getRemoteData } = harness;

    await expect(CloudSync.sync()).resolves.toEqual({ success: true });

    const uploaded = getRemoteData();
    expect(ScriptValues.getAll).toHaveBeenCalledWith('script_values');
    expect(ScriptValues.getAll).not.toHaveBeenCalledWith('script_local_only_values');
    expect(uploaded.valueBundles).toEqual({
      script_values: expect.objectContaining({
        schema: 'scriptvault-gm-value-sync/v1',
        scriptId: 'script_values',
        keyCount: 2,
        values: {
          alpha: { enabled: true },
          token: 'sync-token',
        },
      }),
    });
    expect(uploaded.scripts.find((script) => script.id === 'script_values')).not.toHaveProperty('values');
    expect(uploaded.scripts.find((script) => script.id === 'script_values')).not.toHaveProperty('storage');
    expect(JSON.stringify(uploaded)).not.toContain('local-only-token');
  });

  it('previews sync conflicts and direction without writing local or remote data', async () => {
    const harness = await loadFreshCloudSync(
      [
        {
          id: 'script_conflict',
          code: '// local edit',
          enabled: true,
          position: 0,
          meta: { name: 'Conflict Script' },
          settings: {},
          syncBaseCode: '// base',
          createdAt: 1,
          updatedAt: 20,
        },
        {
          id: 'script_local_only',
          code: '// local only',
          enabled: true,
          position: 1,
          meta: { name: 'Local Only' },
          settings: {},
          createdAt: 1,
          updatedAt: 5,
        },
        {
          id: 'script_local_newer',
          code: '// local newer',
          enabled: true,
          position: 2,
          meta: { name: 'Local Newer' },
          settings: {},
          syncBaseCode: '// local newer',
          createdAt: 1,
          updatedAt: 30,
        },
        {
          id: 'script_remote_newer',
          code: '// local older',
          enabled: true,
          position: 3,
          meta: { name: 'Remote Newer' },
          settings: {},
          syncBaseCode: '// local older',
          createdAt: 1,
          updatedAt: 10,
        },
      ],
      {
        version: 1,
        timestamp: 40,
        scripts: [
          {
            id: 'script_conflict',
            code: '// remote edit',
            enabled: true,
            position: 0,
            settings: {},
            updatedAt: 25,
          },
          {
            id: 'script_remote_only',
            code: '// remote only',
            enabled: true,
            position: 1,
            settings: {},
            updatedAt: 15,
          },
          {
            id: 'script_local_newer',
            code: '// remote older',
            enabled: true,
            position: 2,
            settings: {},
            updatedAt: 10,
          },
          {
            id: 'script_remote_newer',
            code: '// remote newer',
            enabled: true,
            position: 3,
            settings: {},
            updatedAt: 35,
          },
        ],
        tombstones: {},
      },
    );
    const { CloudSync, ScriptStorage, SettingsManager, provider } = harness;

    const preview = await CloudSync.preview('googledrive');

    expect(preview).toEqual(
      expect.objectContaining({
        success: true,
        dryRun: true,
        noWrites: true,
        provider: 'googledrive',
        providerLabel: 'Google Drive',
        remoteFound: true,
        summary: expect.objectContaining({
          localScripts: 4,
          remoteScripts: 4,
          localOnly: 1,
          remoteOnly: 1,
          localNewer: 1,
          remoteNewer: 1,
          conflicts: 1,
          wouldUpload: true,
          wouldDownload: true,
        }),
      }),
    );
    expect(preview.conflicts).toEqual([
      expect.objectContaining({
        id: 'script_conflict',
        name: 'Conflict Script',
        reason: 'Both local and remote changed since the last sync base',
      }),
    ]);
    expect(provider.download).toHaveBeenCalledTimes(1);
    expect(provider.upload).not.toHaveBeenCalled();
    expect(ScriptStorage.set).not.toHaveBeenCalled();
    expect(ScriptStorage.delete).not.toHaveBeenCalled();
    expect(SettingsManager.set).not.toHaveBeenCalled();
  });

  it('previews GM value-bundle counts without uploading provider data', async () => {
    const harness = await loadFreshCloudSync(
      [
        {
          id: 'script_values',
          code: '// ==UserScript==\n// @name Values\n// ==/UserScript==\n',
          enabled: true,
          position: 0,
          meta: { name: 'Values' },
          settings: { syncValues: true },
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      {
        version: 1,
        timestamp: 10,
        scripts: [],
        tombstones: {},
        valueBundles: {
          remote_values: {
            schema: 'scriptvault-gm-value-sync/v1',
            scriptId: 'remote_values',
            keyCount: 1,
            bytes: 100,
            values: { remote: true },
          },
        },
      },
      {},
      {
        script_values: {
          mode: 'sync',
        },
      },
    );
    const { CloudSync, ScriptStorage, SettingsManager, provider } = harness;

    const preview = await CloudSync.preview('googledrive');

    expect(preview.summary).toEqual(
      expect.objectContaining({
        localValueOptIns: 1,
        localValueBundles: 1,
        remoteValueBundles: 1,
        remoteValueBundlesApplicable: 0,
        remoteValueBundlesApplyReady: 0,
        remoteValueBundlesConflictBlocked: 0,
        remoteValueBundlesIgnored: 1,
        remoteValueBundleWarnings: 0,
        valueBundleWarnings: 0,
        valueBundleApplyEnabled: true,
        valueBundleApplyMode: 'empty-local-only',
        wouldUploadValues: true,
        wouldApplyValues: false,
      }),
    );
    expect(provider.upload).not.toHaveBeenCalled();
    expect(ScriptStorage.set).not.toHaveBeenCalled();
    expect(harness.ScriptValues.setAll).not.toHaveBeenCalled();
    expect(SettingsManager.set).not.toHaveBeenCalled();
  });

  it('previews remote GM value bundles that pass the opt-in apply gate without writing values', async () => {
    const harness = await loadFreshCloudSync(
      [],
      {
        version: 1,
        timestamp: 10,
        scripts: [
          {
            id: 'script_remote_values',
            code: '// ==UserScript==\n// @name Remote Values\n// ==/UserScript==\n',
            enabled: true,
            position: 0,
            settings: { syncValues: true },
            updatedAt: 10,
          },
        ],
        tombstones: {},
        valueBundles: {
          script_remote_values: {
            schema: 'scriptvault-gm-value-sync/v1',
            scriptId: 'script_remote_values',
            keyCount: 1,
            bytes: 100,
            values: { theme: 'remote' },
          },
        },
      },
    );
    const { CloudSync, ScriptStorage, ScriptValues, provider } = harness;

    const preview = await CloudSync.preview('googledrive');

    expect(preview.summary).toEqual(
      expect.objectContaining({
        remoteOnly: 1,
        remoteValueBundles: 1,
        remoteValueBundlesApplicable: 1,
        remoteValueBundlesApplyReady: 1,
        remoteValueBundlesConflictBlocked: 0,
        remoteValueBundlesIgnored: 0,
        remoteValueBundleWarnings: 0,
        valueBundleApplyEnabled: true,
        valueBundleApplyMode: 'empty-local-only',
        wouldApplyValues: true,
      }),
    );
    expect(provider.upload).not.toHaveBeenCalled();
    expect(ScriptStorage.set).not.toHaveBeenCalled();
    expect(ScriptValues.setAll).not.toHaveBeenCalled();
  });

  it('previews blocked GM value-bundle merge details without identifiers or values', async () => {
    const harness = await loadFreshCloudSync(
      [
        {
          id: 'script_values',
          code: '// ==UserScript==\n// @name Values\n// ==/UserScript==\n',
          enabled: true,
          position: 0,
          meta: { name: 'Values' },
          settings: { syncValues: true },
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      {
        version: 1,
        timestamp: 10,
        scripts: [
          {
            id: 'script_values',
            code: '// ==UserScript==\n// @name Values\n// ==/UserScript==\n',
            enabled: true,
            position: 0,
            settings: { syncValues: true },
            updatedAt: 10,
          },
        ],
        tombstones: {},
        valueBundles: {
          script_values: {
            schema: 'scriptvault-gm-value-sync/v1',
            scriptId: 'script_values',
            keyCount: 2,
            bytes: 100,
            values: {
              sharedKeyName: 'remote-value-456',
              remoteKeyName: true,
            },
          },
        },
      },
      {},
      {
        script_values: {
          sharedKeyName: 'local-value-123',
          localKeyName: true,
        },
      },
    );
    const { CloudSync, ScriptValues, provider } = harness;

    const preview = await CloudSync.preview('googledrive');

    expect(preview.summary).toEqual(
      expect.objectContaining({
        remoteValueBundlesApplicable: 1,
        remoteValueBundlesApplyReady: 0,
        remoteValueBundlesConflictBlocked: 1,
        wouldApplyValues: false,
      }),
    );
    expect(preview.valueBundleConflicts).toEqual([
      expect.objectContaining({
        reason: 'local-values-present',
        localKeyCount: 2,
        remoteKeyCount: 2,
        overlappingKeyCount: 1,
        localOnlyKeyCount: 1,
        remoteOnlyKeyCount: 1,
      }),
    ]);
    expect(preview.valueBundleConflicts[0].localBytes).toBeGreaterThan(0);
    expect(preview.valueBundleConflicts[0].remoteBytes).toBeGreaterThan(0);
    const serializedPreview = JSON.stringify(preview.valueBundleConflicts);
    expect(serializedPreview).not.toContain('script_values');
    expect(serializedPreview).not.toContain('Values');
    expect(serializedPreview).not.toContain('sharedKeyName');
    expect(serializedPreview).not.toContain('localKeyName');
    expect(serializedPreview).not.toContain('remoteKeyName');
    expect(serializedPreview).not.toContain('local-value-123');
    expect(serializedPreview).not.toContain('remote-value-456');
    expect(provider.upload).not.toHaveBeenCalled();
    expect(ScriptValues.setAll).not.toHaveBeenCalled();
  });

  it('preserves remote GM value bundles during sync when local values are non-empty', async () => {
    await chrome.storage.local.set({
      syncTombstones: {},
    });

    const harness = await loadFreshCloudSync(
      [
        {
          id: 'script_values',
          code: '// ==UserScript==\n// @name Values\n// ==/UserScript==\n// local',
          enabled: true,
          position: 0,
          meta: { name: 'Values' },
          settings: { syncValues: true },
          syncBaseCode: '// ==UserScript==\n// @name Values\n// ==/UserScript==\n// local',
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      {
        version: 1,
        timestamp: 20,
        scripts: [
          {
            id: 'script_values',
            code: '// ==UserScript==\n// @name Values\n// ==/UserScript==\n// remote',
            enabled: true,
            position: 0,
            settings: { syncValues: true },
            updatedAt: 20,
          },
        ],
        tombstones: {},
        valueBundles: {
          script_values: {
            schema: 'scriptvault-gm-value-sync/v1',
            scriptId: 'script_values',
            keyCount: 1,
            bytes: 100,
            values: { token: 'remote-token' },
          },
        },
      },
      {},
      {
        script_values: {
          token: 'local-token',
        },
      },
    );
    const { CloudSync, ScriptValues, getRemoteData, scriptState } = harness;

    await expect(CloudSync.sync()).resolves.toEqual({
      success: true,
      valueBundleSync: {
        applied: 0,
        preserved: 1,
        conflictBlocked: 1,
        skippedUnavailable: 0,
        failures: 0,
      },
    });

    expect(ScriptValues.setAll).not.toHaveBeenCalled();
    expect(scriptState[0].code).toContain('// remote');
    expect(getRemoteData().valueBundles.script_values.values).toEqual({
      token: 'remote-token',
    });
    expect(JSON.stringify(getRemoteData())).not.toContain('local-token');
  });

  it('applies remote GM value bundles during sync when local values are empty', async () => {
    await chrome.storage.local.set({
      syncTombstones: {},
    });

    const harness = await loadFreshCloudSync(
      [
        {
          id: 'script_values',
          code: '// ==UserScript==\n// @name Values\n// ==/UserScript==\n// local',
          enabled: true,
          position: 0,
          meta: { name: 'Values' },
          settings: { syncValues: true },
          syncBaseCode: '// ==UserScript==\n// @name Values\n// ==/UserScript==\n// local',
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      {
        version: 1,
        timestamp: 20,
        scripts: [
          {
            id: 'script_values',
            code: '// ==UserScript==\n// @name Values\n// ==/UserScript==\n// remote',
            enabled: true,
            position: 0,
            settings: { syncValues: true },
            updatedAt: 20,
          },
        ],
        tombstones: {},
        valueBundles: {
          script_values: {
            schema: 'scriptvault-gm-value-sync/v1',
            scriptId: 'script_values',
            keyCount: 1,
            bytes: 100,
            values: { token: 'remote-token' },
          },
        },
      },
      {},
      {
        script_values: {},
      },
    );
    const { CloudSync, ScriptValues, getRemoteData, scriptState, valueState } = harness;

    await expect(CloudSync.sync()).resolves.toEqual({
      success: true,
      valueBundleSync: {
        applied: 1,
        preserved: 0,
        conflictBlocked: 0,
        skippedUnavailable: 0,
        failures: 0,
      },
    });

    expect(ScriptValues.setAll).toHaveBeenCalledWith('script_values', { token: 'remote-token' });
    expect(valueState.script_values).toEqual({ token: 'remote-token' });
    expect(scriptState[0].code).toContain('// remote');
    expect(getRemoteData().valueBundles.script_values.values).toEqual({
      token: 'remote-token',
    });
  });

  it('uploads encrypted v2 envelopes when sync encryption is enabled', async () => {
    await chrome.storage.local.set({
      syncTombstones: {},
    });

    const harness = await loadFreshCloudSync(
      [
        {
          id: 'script_secret',
          code: '// ==UserScript==\n// @name Secret\n// ==/UserScript==\nconst token = "secret-token";',
          enabled: true,
          position: 0,
          meta: { name: 'Secret' },
          settings: {},
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      null,
      {
        syncEncryptionEnabled: true,
        syncEncryptionPassphrase: 'vault passphrase',
        syncEncryptionKdfIterations: 2,
      },
    );
    const { CloudSync, getRemoteData } = harness;

    await expect(CloudSync.sync()).resolves.toEqual({ success: true });

    const uploaded = getRemoteData();
    expect(uploaded).toEqual(
      expect.objectContaining({
        version: 2,
        encrypted: true,
        algorithm: 'AES-256-GCM',
        kdf: 'PBKDF2-SHA-256',
      }),
    );
    expect(uploaded).not.toHaveProperty('scripts');
    expect(JSON.stringify(uploaded)).not.toContain('secret-token');
  });

  it('rejects encrypted remote envelopes with a wrong passphrase before writing local data', async () => {
    await chrome.storage.local.set({
      syncTombstones: {},
    });

    const firstHarness = await loadFreshCloudSync(
      [
        {
          id: 'script_secret',
          code: '// ==UserScript==\n// @name Secret\n// ==/UserScript==\nconst token = "secret-token";',
          enabled: true,
          position: 0,
          meta: { name: 'Secret' },
          settings: {},
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      null,
      {
        syncEncryptionEnabled: true,
        syncEncryptionPassphrase: 'correct passphrase',
        syncEncryptionKdfIterations: 2,
      },
    );
    await expect(firstHarness.CloudSync.sync()).resolves.toEqual({ success: true });

    const secondHarness = await loadFreshCloudSync(
      [],
      firstHarness.getRemoteData(),
      {
        syncEncryptionEnabled: true,
        syncEncryptionPassphrase: 'wrong passphrase',
        syncEncryptionKdfIterations: 2,
      },
    );

    await expect(secondHarness.CloudSync.sync()).resolves.toEqual({
      error: 'Unable to decrypt sync data. Check the sync encryption passphrase.',
    });
    expect(secondHarness.ScriptStorage.set).not.toHaveBeenCalled();
    expect(secondHarness.provider.upload).not.toHaveBeenCalled();
  });
});
