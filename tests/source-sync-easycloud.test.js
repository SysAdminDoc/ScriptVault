import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalFetch = globalThis.fetch;
const originalRegisterScript = globalThis.registerScript;
const originalUnregisterScript = globalThis.unregisterScript;
const originalUpdateBadge = globalThis.updateBadge;

async function loadFreshEasyCloud(initialScripts = []) {
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
    set: vi.fn(async () => {}),
  };

  const registerScript = vi.fn().mockResolvedValue();
  const unregisterScript = vi.fn().mockResolvedValue();
  const updateBadge = vi.fn().mockResolvedValue();

  globalThis.registerScript = registerScript;
  globalThis.unregisterScript = unregisterScript;
  globalThis.updateBadge = updateBadge;

  vi.doMock('../src/modules/storage.ts', () => ({
    ScriptStorage,
    SettingsManager,
  }));

  const mod = await import('../src/modules/sync-easycloud.ts');
  return {
    EasyCloudSync: mod.EasyCloudSync,
    SettingsManager,
    ScriptStorage,
    scriptState,
    registerScript,
    unregisterScript,
    updateBadge,
  };
}

beforeEach(() => {
  globalThis.__resetStorageMock();
  vi.clearAllMocks();
  globalThis.fetch = originalFetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.registerScript = originalRegisterScript;
  globalThis.unregisterScript = originalUnregisterScript;
  globalThis.updateBadge = originalUpdateBadge;
});

describe('source easycloud sync module', () => {
  it('schedules debounce sync work through chrome alarms after a script save', async () => {
    const { EasyCloudSync } = await loadFreshEasyCloud();

    EasyCloudSync.notifyScriptSaved('script-1');

    expect(chrome.alarms.create).toHaveBeenCalledWith(
      'easycloud-debounce-sync',
      expect.objectContaining({
        delayInMinutes: 5000 / 60000,
      }),
    );
  });

  it('runs a sync when the debounce alarm fires', async () => {
    chrome.storage.local.set({
      easycloud_connected: false,
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ files: [] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ files: [] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ id: 'drive-file-id' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    globalThis.fetch = fetchMock;

    const { EasyCloudSync, SettingsManager } = await loadFreshEasyCloud();
    await EasyCloudSync.init();

    const alarmHandler = chrome.alarms.onAlarm.addListener.mock.calls.at(-1)?.[0];
    expect(typeof alarmHandler).toBe('function');

    alarmHandler({ name: 'easycloud-debounce-sync' });

    expect(chrome.identity.getAuthToken).toHaveBeenCalledWith(
      expect.objectContaining({ interactive: false }),
    );
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-token',
          }),
        }),
      );
      expect(SettingsManager.set).toHaveBeenCalledWith('lastSync', expect.any(Number));
    });
  });

  it('clears pending debounce alarms on disconnect', async () => {
    const { EasyCloudSync } = await loadFreshEasyCloud();

    await EasyCloudSync.disconnect();

    expect(chrome.alarms.clear).toHaveBeenCalledWith('easycloud-periodic-sync');
    expect(chrome.alarms.clear).toHaveBeenCalledWith('easycloud-debounce-sync');
  });

  it('removes tombstoned local scripts and refreshes runtime registration during sync', async () => {
    await chrome.storage.local.set({
      easycloud_connected: true,
      syncTombstones: {},
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ files: [{ id: 'drive-file-id' }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            version: 1,
            timestamp: 50,
            deviceId: 'remote-device',
            scripts: [],
            tombstones: { script_alpha: 12345 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ id: 'drive-file-id' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    globalThis.fetch = fetchMock;

    const harness = await loadFreshEasyCloud([
      {
        id: 'script_alpha',
        code: '// ==UserScript==\n// @name Alpha\n// ==/UserScript==',
        meta: { name: 'Alpha' },
        enabled: true,
        position: 0,
        settings: {},
        createdAt: 1,
        updatedAt: 1,
      },
    ]);
    const {
      EasyCloudSync,
      ScriptStorage,
      scriptState,
      unregisterScript,
      updateBadge,
    } = harness;

    const result = await EasyCloudSync.sync();

    expect(result.success).toBe(true);
    expect(ScriptStorage.delete).toHaveBeenCalledWith('script_alpha');
    expect(unregisterScript).toHaveBeenCalledWith('script_alpha');
    expect(updateBadge).toHaveBeenCalledTimes(1);
    expect(scriptState).toEqual([]);
  });
});
