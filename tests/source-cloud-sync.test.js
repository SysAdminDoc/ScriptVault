import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalGlobals = {
  debugLog: globalThis.debugLog,
  parseUserscript: globalThis.parseUserscript,
  ScriptAnalyzer: globalThis.ScriptAnalyzer,
  CloudSyncProviders: globalThis.CloudSyncProviders,
  SettingsManager: globalThis.SettingsManager,
  ScriptStorage: globalThis.ScriptStorage,
  registerScript: globalThis.registerScript,
  unregisterScript: globalThis.unregisterScript,
  updateBadge: globalThis.updateBadge,
};

async function loadFreshCloudSync(initialScripts, remoteData) {
  vi.resetModules();

  const scriptState = initialScripts.map((script) => structuredClone(script));
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
    })),
    set: vi.fn(async () => {}),
  };

  const provider = {
    download: vi.fn(async () => structuredClone(remoteData)),
    upload: vi.fn(async () => {}),
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
  vi.stubGlobal('registerScript', registerScript);
  vi.stubGlobal('unregisterScript', unregisterScript);
  vi.stubGlobal('updateBadge', updateBadge);

  const mod = await import('../src/background/cloud-sync.ts');
  return {
    CloudSync: mod.CloudSync,
    ScriptStorage,
    SettingsManager,
    provider,
    registerScript,
    unregisterScript,
    updateBadge,
    scriptState,
  };
}

beforeEach(() => {
  globalThis.__resetStorageMock();
  vi.clearAllMocks();
});

afterEach(() => {
  for (const [key, value] of Object.entries(originalGlobals)) {
    globalThis[key] = value;
  }
});

describe('source cloud sync module', () => {
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
});
