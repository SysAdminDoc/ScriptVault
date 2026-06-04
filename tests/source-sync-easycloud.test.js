import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalCrypto = globalThis.crypto;
const originalFetch = globalThis.fetch;
const originalRegisterScript = globalThis.registerScript;
const originalUnregisterScript = globalThis.unregisterScript;
const originalUpdateBadge = globalThis.updateBadge;

async function loadFreshEasyCloud(initialScripts = [], settingsOverride = {}) {
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
      syncEncryptionEnabled: false,
      syncEncryptionPassphrase: '',
      ...settingsOverride,
    })),
    set: vi.fn(async () => {}),
  };

  const registerScript = vi.fn().mockResolvedValue();
  const unregisterScript = vi.fn().mockResolvedValue();
  const updateBadge = vi.fn().mockResolvedValue();

  globalThis.registerScript = registerScript;
  globalThis.unregisterScript = unregisterScript;
  globalThis.updateBadge = updateBadge;
  globalThis.ScriptStorage = ScriptStorage;
  globalThis.SettingsManager = SettingsManager;

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
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  globalThis.fetch = originalFetch;
});

afterEach(() => {
  Object.defineProperty(globalThis, 'crypto', { value: originalCrypto, configurable: true });
  globalThis.fetch = originalFetch;
  globalThis.registerScript = originalRegisterScript;
  globalThis.unregisterScript = originalUnregisterScript;
  globalThis.updateBadge = originalUpdateBadge;
  Reflect.deleteProperty(globalThis, 'ScriptStorage');
  Reflect.deleteProperty(globalThis, 'SettingsManager');
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

  it('uploads only sync-safe per-script settings to EasyCloud', async () => {
    await chrome.storage.local.set({
      easycloud_connected: true,
      syncTombstones: {},
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

    const { EasyCloudSync } = await loadFreshEasyCloud([
      {
        id: 'script_settings',
        code: '// ==UserScript==\n// @name Settings\n// ==/UserScript==',
        meta: { name: 'Settings' },
        enabled: true,
        position: 0,
        settings: {
          runAt: 'document-start',
          notes: 'portable note',
          userModified: true,
          mergeConflict: true,
          _registrationError: 'local registration failed',
        },
        createdAt: 1,
        updatedAt: 1,
      },
    ]);

    const result = await EasyCloudSync.sync();
    const uploadCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes('/upload/drive/v3/files?uploadType=multipart'),
    );

    expect(result.success).toBe(true);
    expect(uploadCall).toBeTruthy();
    const body = uploadCall[1].body;
    expect(body).toContain('"runAt":"document-start"');
    expect(body).toContain('"notes":"portable note"');
    expect(body).not.toContain('userModified');
    expect(body).not.toContain('mergeConflict');
    expect(body).not.toContain('_registrationError');
  });

  it('encrypts EasyCloud Drive uploads when sync encryption is enabled', async () => {
    await chrome.storage.local.set({
      easycloud_connected: true,
      syncTombstones: {},
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

    const { EasyCloudSync } = await loadFreshEasyCloud(
      [
        {
          id: 'script_secret',
          code: '// ==UserScript==\n// @name Secret\n// ==/UserScript==\nconst token = "easycloud-secret";',
          meta: { name: 'Secret' },
          enabled: true,
          position: 0,
          settings: {},
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      {
        syncEncryptionEnabled: true,
        syncEncryptionPassphrase: 'easycloud passphrase',
        syncEncryptionKdfIterations: 2,
      },
    );

    const result = await EasyCloudSync.sync();
    const uploadCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes('/upload/drive/v3/files?uploadType=multipart'),
    );

    expect(result.success).toBe(true);
    expect(uploadCall).toBeTruthy();
    const body = uploadCall[1].body;
    expect(body).toContain('"encrypted":true');
    expect(body).toContain('"algorithm":"AES-256-GCM"');
    expect(body).not.toContain('easycloud-secret');
  });
});
