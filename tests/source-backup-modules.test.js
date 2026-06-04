import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function makeFakeFflate() {
  return {
    strToU8(str) {
      return encoder.encode(str);
    },
    strFromU8(data) {
      return decoder.decode(data);
    },
    zipSync(files) {
      const serialized = Object.fromEntries(
        Object.entries(files).map(([name, bytes]) => [name, Array.from(bytes)]),
      );
      return encoder.encode(JSON.stringify(serialized));
    },
    unzipSync(data, opts = {}) {
      const parsed = JSON.parse(decoder.decode(data));
      const files = {};
      for (const [name, rawEntry] of Object.entries(parsed)) {
        const bytes = Array.isArray(rawEntry) ? rawEntry : rawEntry.bytes || [];
        const dataBytes = Uint8Array.from(bytes);
        const meta = {
          name,
          size: Array.isArray(rawEntry) ? dataBytes.byteLength : rawEntry.size ?? dataBytes.byteLength,
          originalSize: Array.isArray(rawEntry) ? dataBytes.byteLength : rawEntry.originalSize ?? dataBytes.byteLength,
          compression: Array.isArray(rawEntry) ? 0 : rawEntry.compression ?? 0,
        };
        if (opts.filter && opts.filter(meta) === false) continue;
        files[name] = dataBytes;
      }
      return files;
    },
  };
}

function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function fakeZipBytes(entries) {
  return encoder.encode(JSON.stringify(entries));
}

function textEntry(text, meta = {}) {
  return {
    bytes: Array.from(encoder.encode(text)),
    ...meta,
  };
}

function makeScript(id, name) {
  return {
    id,
    code: [
      '// ==UserScript==',
      `// @name ${name}`,
      `// @namespace scriptvault/${id}`,
      '// @version 1.0.0',
      '// @match https://example.com/*',
      '// ==/UserScript==',
      `console.log('${name}');`,
    ].join('\n'),
    enabled: true,
    position: 0,
    meta: {
      name,
      namespace: `scriptvault/${id}`,
      version: '1.0.0',
      description: `${name} script`,
      author: 'QA',
      icon: '',
      icon64: '',
      homepage: '',
      homepageURL: '',
      website: '',
      source: '',
      updateURL: '',
      downloadURL: '',
      supportURL: '',
      license: 'MIT',
      copyright: '',
      contributionURL: '',
      match: ['https://example.com/*'],
      include: [],
      exclude: [],
      excludeMatch: [],
      'run-at': 'document-idle',
      'inject-into': 'auto',
      noframes: false,
      unwrap: false,
      sandbox: '',
      'run-in': '',
      grant: ['none'],
      require: [],
      resource: {},
      connect: [],
      'top-level-await': false,
      webRequest: null,
      priority: 0,
      antifeature: [],
      tag: [],
      compatible: [],
      incompatible: [],
    },
    settings: {},
    stats: { runs: 0, totalTime: 0, avgTime: 0, errors: 0 },
    createdAt: 1,
    updatedAt: 1,
  };
}

async function loadFreshBackupSchedulerHarness(
  scripts,
  valuesByScript = {},
  settings = { enabled: true, layout: 'dark' },
) {
  vi.resetModules();

  const fakeFflate = makeFakeFflate();
  const importFromZip = vi.fn().mockResolvedValue({ imported: 1, skipped: 0, errors: [] });

  globalThis.fflate = fakeFflate;
  globalThis.importFromZip = importFromZip;

  const ScriptStorage = {
    getAll: vi.fn(async () => scripts.map((script) => structuredClone(script))),
  };
  const ScriptValues = {
    getAll: vi.fn(async (scriptId) => structuredClone(valuesByScript[scriptId] || {})),
  };
  const SettingsManager = {
    get: vi.fn(async () => structuredClone(settings)),
    set: vi.fn(async () => structuredClone(settings)),
  };
  const FolderStorage = {
    cache: null,
  };
  const WorkspaceManager = {
    _cache: null,
    _initPromise: null,
  };

  globalThis.ScriptStorage = ScriptStorage;
  globalThis.ScriptValues = ScriptValues;
  globalThis.SettingsManager = SettingsManager;
  globalThis.FolderStorage = FolderStorage;
  globalThis.WorkspaceManager = WorkspaceManager;

  vi.doMock('../src/modules/storage.ts', () => ({
    ScriptStorage,
    ScriptValues,
    SettingsManager,
    FolderStorage,
  }));

  const mod = await import('../src/modules/backup-scheduler.ts');
  return {
    BackupScheduler: mod.BackupScheduler,
    fakeFflate,
    importFromZip,
    SettingsManager,
  };
}

async function loadFreshImportExportHarness(
  existingScripts = [],
  storedValuesByScript = {},
  settings = { enabled: true },
) {
  vi.resetModules();

  const fakeFflate = makeFakeFflate();
  let generatedIdCounter = 1;

  globalThis.fflate = fakeFflate;
  globalThis.generateId = vi.fn(() => `generated_script_${generatedIdCounter++}`);
  globalThis.registerAllScripts = vi.fn().mockResolvedValue();
  globalThis.updateBadge = vi.fn().mockResolvedValue();

  const scriptCache = new Map(existingScripts.map((script) => [script.id, structuredClone(script)]));
  const valueCache = new Map(Object.entries(storedValuesByScript).map(([key, value]) => [key, structuredClone(value)]));

  const ScriptStorage = {
    getAll: vi.fn(async () => Array.from(scriptCache.values()).map((script) => structuredClone(script))),
    get: vi.fn(async (id) => structuredClone(scriptCache.get(id) || null)),
    set: vi.fn(async (id, script) => {
      scriptCache.set(id, structuredClone(script));
      return script;
    }),
  };
  const ScriptValues = {
    getAll: vi.fn(async (scriptId) => structuredClone(valueCache.get(scriptId) || {})),
    setAll: vi.fn(async (scriptId, values) => {
      valueCache.set(scriptId, structuredClone(values));
    }),
  };
  const SettingsManager = {
    get: vi.fn(async () => structuredClone(settings)),
    set: vi.fn(async () => ({ enabled: true })),
  };

  vi.doMock('../src/modules/storage.ts', () => ({
    ScriptStorage,
    ScriptValues,
    SettingsManager,
  }));

  const mod = await import('../src/background/import-export.ts');
  return {
    ...mod,
    fakeFflate,
    ScriptStorage,
    ScriptValues,
    SettingsManager,
    scriptCache,
    valueCache,
  };
}

beforeEach(() => {
  globalThis.__resetStorageMock();
  chrome.notifications.create.mockClear();
  chrome.notifications.clear.mockClear();
  chrome.tabs.create.mockClear();
  vi.clearAllMocks();
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'fflate');
  Reflect.deleteProperty(globalThis, 'importFromZip');
  Reflect.deleteProperty(globalThis, 'generateId');
  Reflect.deleteProperty(globalThis, 'registerAllScripts');
  Reflect.deleteProperty(globalThis, 'updateBadge');
  Reflect.deleteProperty(globalThis, 'ScriptStorage');
  Reflect.deleteProperty(globalThis, 'ScriptValues');
  Reflect.deleteProperty(globalThis, 'SettingsManager');
  Reflect.deleteProperty(globalThis, 'FolderStorage');
  Reflect.deleteProperty(globalThis, 'WorkspaceManager');
});

describe('source backup scheduler module', () => {
  it('stores script ids in backup metadata, reports them via inspect, and uses the correct notification icon', async () => {
    const script = makeScript('script_alpha', 'Alpha Script');
    const { BackupScheduler, fakeFflate } = await loadFreshBackupSchedulerHarness(
      [script],
      { script_alpha: { draft: true } },
    );

    await chrome.storage.local.set({
      backupSchedulerSettings: {
        enabled: true,
        scheduleType: 'manual',
        hour: 3,
        dayOfWeek: 0,
        maxBackups: 5,
        notifyOnSuccess: true,
        notifyOnFailure: true,
        warnOnStorageFull: false,
      },
    });

    const result = await BackupScheduler.createBackup('manual');
    const backups = await chrome.storage.local.get('autoBackups');
    const [backup] = backups.autoBackups;
    const archivedFiles = fakeFflate.unzipSync(base64ToBytes(backup.data));
    const options = JSON.parse(fakeFflate.strFromU8(archivedFiles['scripts/Alpha Script.options.json']));
    const inspected = await BackupScheduler.inspectBackup(result.backupId);

    expect(result.success).toBe(true);
    expect(options.scriptId).toBe('script_alpha');
    expect(inspected.scripts[0]).toMatchObject({
      id: 'script_alpha',
      name: 'Alpha Script',
      hasStorage: true,
    });
    expect(inspected.scriptsWithStorageCount).toBe(1);
    expect(chrome.notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        iconUrl: 'chrome-extension://test-extension-id/images/icon128.png',
      }),
    );
  });

  it('redacts credential-bearing global settings and stamps backup metadata', async () => {
    const script = makeScript('script_alpha', 'Alpha Script');
    const { BackupScheduler, fakeFflate } = await loadFreshBackupSchedulerHarness(
      [script],
      {},
      {
        enabled: true,
        theme: 'dark',
        webdavUsername: 'operator',
        webdavPassword: 'secret',
        dropboxToken: 'dropbox-access',
        s3AccessKeyId: 'AKIA_TEST',
        s3SecretKey: 's3-secret',
      },
    );

    await chrome.storage.local.set({
      backupSchedulerSettings: {
        enabled: true,
        scheduleType: 'manual',
        hour: 3,
        dayOfWeek: 0,
        maxBackups: 5,
        notifyOnSuccess: false,
        notifyOnFailure: true,
        warnOnStorageFull: false,
      },
    });

    const result = await BackupScheduler.createBackup('manual');
    const backups = await chrome.storage.local.get('autoBackups');
    const [backup] = backups.autoBackups;
    const archivedFiles = fakeFflate.unzipSync(base64ToBytes(backup.data));
    const settings = JSON.parse(fakeFflate.strFromU8(archivedFiles['global-settings.json']));
    const metadata = JSON.parse(fakeFflate.strFromU8(archivedFiles['global-settings.metadata.json']));
    const inspected = await BackupScheduler.inspectBackup(result.backupId);

    expect(settings).toMatchObject({ enabled: true, theme: 'dark' });
    expect(settings).not.toHaveProperty('webdavPassword');
    expect(settings).not.toHaveProperty('dropboxToken');
    expect(settings).not.toHaveProperty('s3SecretKey');
    expect(metadata.settingsCredentialsIncluded).toBe(false);
    expect(metadata.redactedSettingsCredentialKeys).toEqual(
      expect.arrayContaining(['webdavPassword', 'dropboxToken', 's3SecretKey']),
    );
    expect(inspected.settingsCredentialsIncluded).toBe(false);
    expect(inspected.redactedSettingsCredentialKeys).toEqual(
      expect.arrayContaining(['webdavPassword', 'dropboxToken', 's3SecretKey']),
    );
  });

  it('requires backup metadata plus restore opt-in before replacing sync credentials', async () => {
    const { BackupScheduler, SettingsManager } = await loadFreshBackupSchedulerHarness(
      [makeScript('script_alpha', 'Alpha')],
      {},
      {
        theme: 'dark',
        webdavPassword: 'archive-secret',
        s3SecretKey: 'archive-s3-secret',
      },
    );
    await chrome.storage.local.set({
      backupSchedulerSettings: {
        enabled: true,
        scheduleType: 'manual',
        hour: 3,
        dayOfWeek: 0,
        maxBackups: 5,
        includeSettingsCredentials: true,
        notifyOnSuccess: false,
        notifyOnFailure: true,
        warnOnStorageFull: false,
      },
    });

    const created = await BackupScheduler.createBackup('manual');
    SettingsManager.set.mockClear();

    const guarded = await BackupScheduler.restoreBackup(created.backupId, {
      recordReceipt: false,
    });
    expect(guarded.settingsCredentialsRestored).toBe(false);
    expect(guarded.skippedSettingsCredentialKeys).toEqual(
      expect.arrayContaining(['webdavPassword', 's3SecretKey']),
    );
    expect(SettingsManager.set).toHaveBeenCalledWith(
      expect.not.objectContaining({
        webdavPassword: expect.anything(),
        s3SecretKey: expect.anything(),
      }),
    );

    SettingsManager.set.mockClear();
    const restored = await BackupScheduler.restoreBackup(created.backupId, {
      importSettingsCredentials: true,
      recordReceipt: false,
    });
    expect(restored.settingsCredentialsRestored).toBe(true);
    expect(SettingsManager.set).toHaveBeenCalledWith(
      expect.objectContaining({
        webdavPassword: 'archive-secret',
        s3SecretKey: 'archive-s3-secret',
      }),
    );
  });

  it('restores selective backups through the zip importer using script ids instead of script names', async () => {
    const { BackupScheduler, fakeFflate, importFromZip } = await loadFreshBackupSchedulerHarness(
      [
        makeScript('script_alpha', 'Alpha'),
        makeScript('script_beta', 'Beta'),
      ],
      {
        script_alpha: { alpha: true },
        script_beta: { beta: true },
      },
    );

    await chrome.storage.local.set({
      backupSchedulerSettings: {
        enabled: true,
        scheduleType: 'manual',
        hour: 3,
        dayOfWeek: 0,
        maxBackups: 5,
        notifyOnSuccess: false,
        notifyOnFailure: true,
        warnOnStorageFull: false,
      },
    });

    const created = await BackupScheduler.createBackup('manual');
    const restore = await BackupScheduler.restoreBackup(created.backupId, {
      selective: true,
      scriptIds: ['script_beta'],
    });

    const [zipBase64] = importFromZip.mock.calls[0];
    const selectedFiles = fakeFflate.unzipSync(base64ToBytes(zipBase64));

    expect(restore).toMatchObject({ success: true, restoredScripts: 1 });
    expect(Object.keys(selectedFiles).sort()).toEqual([
      'scripts/Beta.options.json',
      'scripts/Beta.storage.json',
      'scripts/Beta.user.js',
    ]);
  });

  it('preserves a pending on-change debounce alarm when initializing', async () => {
    await chrome.storage.local.set({
      backupSchedulerSettings: {
        enabled: true,
        scheduleType: 'onChange',
        hour: 3,
        dayOfWeek: 0,
        maxBackups: 5,
        notifyOnSuccess: false,
        notifyOnFailure: true,
        warnOnStorageFull: false,
      },
    });
    const { BackupScheduler } = await loadFreshBackupSchedulerHarness([]);

    await BackupScheduler.init();

    expect(chrome.alarms.clear).toHaveBeenCalledWith('sv_backup_scheduled');
    expect(chrome.alarms.clear).not.toHaveBeenCalledWith('sv_backup_debounce');
  });

  it('returns retention pruning count from setSettings for dashboard feedback', async () => {
    const { BackupScheduler } = await loadFreshBackupSchedulerHarness([]);
    await chrome.storage.local.set({
      backupSchedulerSettings: {
        enabled: true,
        scheduleType: 'manual',
        hour: 3,
        dayOfWeek: 0,
        maxBackups: 1,
        notifyOnSuccess: false,
        notifyOnFailure: true,
        warnOnStorageFull: false,
      },
      autoBackups: [
        { id: 'newer', timestamp: 2, version: '1', reason: 'manual', scriptCount: 0, size: 1, sizeFormatted: '1 B', data: 'aa' },
        { id: 'older', timestamp: 1, version: '1', reason: 'manual', scriptCount: 0, size: 1, sizeFormatted: '1 B', data: 'aa' },
      ],
    });

    const settings = await BackupScheduler.setSettings({ maxBackups: 1 });
    const stored = await chrome.storage.local.get('autoBackups');

    expect(settings.prunedCount).toBe(1);
    expect(stored.autoBackups).toHaveLength(1);
    expect(stored.autoBackups[0].id).toBe('newer');
  });

  it('rejects unsafe imported backup archives before persistence', async () => {
    const { BackupScheduler } = await loadFreshBackupSchedulerHarness([]);

    const result = await BackupScheduler.importBackup(
      bytesToBase64(fakeZipBytes({
        'payload.zip': textEntry('nested'),
      })),
    );
    const stored = await chrome.storage.local.get('autoBackups');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/nested archive entry payload\.zip/);
    expect(stored.autoBackups || []).toHaveLength(0);
  });
});

describe('source import/export module', () => {
  it('redacts credential-bearing settings from JSON exports by default', async () => {
    const harness = await loadFreshImportExportHarness(
      [makeScript('script_exported', 'Exported Script')],
      {},
      {
        enabled: true,
        theme: 'dark',
        webdavPassword: 'secret',
        googleDriveToken: 'oauth-access',
        s3SecretKey: 's3-secret',
      },
    );

    const exported = await harness.exportAllScripts({ includeSettings: true });

    expect(exported.settings).toMatchObject({ enabled: true, theme: 'dark' });
    expect(exported.settings).not.toHaveProperty('webdavPassword');
    expect(exported.settings).not.toHaveProperty('googleDriveToken');
    expect(exported.settings).not.toHaveProperty('s3SecretKey');
    expect(exported.settingsCredentialsIncluded).toBe(false);
    expect(exported.redactedSettingsCredentialKeys).toEqual(
      expect.arrayContaining(['webdavPassword', 'googleDriveToken', 's3SecretKey']),
    );
  });

  it('restores JSON settings credentials only with archive metadata and import opt-in', async () => {
    const harness = await loadFreshImportExportHarness();
    const data = {
      scripts: [],
      settings: {
        theme: 'light',
        webdavPassword: 'archive-secret',
        s3SecretKey: 'archive-s3-secret',
      },
      settingsCredentialsIncluded: true,
    };

    const guarded = await harness.importScripts(data, { importSettings: true });
    expect(guarded.settingsCredentialsImported).toBe(false);
    expect(guarded.skippedSettingsCredentialKeys).toEqual(
      expect.arrayContaining(['webdavPassword', 's3SecretKey']),
    );
    expect(harness.SettingsManager.set).toHaveBeenLastCalledWith(
      expect.not.objectContaining({
        webdavPassword: expect.anything(),
        s3SecretKey: expect.anything(),
      }),
    );

    const restored = await harness.importScripts(data, {
      importSettings: true,
      importSettingsCredentials: true,
    });
    expect(restored.settingsCredentialsImported).toBe(true);
    expect(harness.SettingsManager.set).toHaveBeenLastCalledWith(
      expect.objectContaining({
        webdavPassword: 'archive-secret',
        s3SecretKey: 'archive-s3-secret',
      }),
    );
  });

  it('exports script ids into ScriptVault zip metadata', async () => {
    const script = makeScript('script_exported', 'Exported Script');
    const harness = await loadFreshImportExportHarness(
      [script],
      { script_exported: { enabled: true } },
    );

    const exported = await harness.exportToZip();
    const files = harness.fakeFflate.unzipSync(base64ToBytes(exported.zipData));
    const options = JSON.parse(harness.fakeFflate.strFromU8(files['Exported Script.options.json']));

    expect(options.scriptId).toBe('script_exported');
    expect(options.scriptVault).toEqual({
      schemaVersion: 1,
      createdAt: 1,
      updatedAt: 1,
      position: 0,
    });
  });

  it('preserves stored script ids when importing a ScriptVault zip', async () => {
    const harness = await loadFreshImportExportHarness();
    const options = {
      scriptId: 'script_preserved',
      settings: { enabled: false },
      scriptVault: {
        schemaVersion: 1,
        createdAt: 1700000000000,
        updatedAt: 1700000004321,
        position: 7,
      },
    };
    const storage = { data: { draft: true } };
    const zipBytes = harness.fakeFflate.zipSync({
      'Preserved.user.js': harness.fakeFflate.strToU8([
        '// ==UserScript==',
        '// @name Preserved Script',
        '// @namespace scriptvault/preserved',
        '// @version 1.0.0',
        '// @match https://example.com/*',
        '// ==/UserScript==',
        'console.log("preserved");',
      ].join('\n')),
      'Preserved.options.json': harness.fakeFflate.strToU8(JSON.stringify(options)),
      'Preserved.storage.json': harness.fakeFflate.strToU8(JSON.stringify(storage)),
    });

    const result = await harness.importFromZip(bytesToBase64(zipBytes), { overwrite: true });

    expect(result).toMatchObject({ imported: 1, skipped: 0 });
    expect(harness.ScriptStorage.set).toHaveBeenCalledWith(
      'script_preserved',
      expect.objectContaining({
        id: 'script_preserved',
        enabled: false,
        createdAt: 1700000000000,
        updatedAt: 1700000004321,
        position: 7,
      }),
    );
    expect(harness.ScriptValues.setAll).toHaveBeenCalledWith('script_preserved', { draft: true });
    expect(globalThis.generateId).not.toHaveBeenCalled();
  });

  it('uses stored script ids before name matching when importing renamed ScriptVault scripts', async () => {
    const existing = makeScript('script_preserved', 'Renamed Local Script');
    const harness = await loadFreshImportExportHarness([existing]);
    const zipBytes = harness.fakeFflate.zipSync({
      'Preserved.user.js': harness.fakeFflate.strToU8([
        '// ==UserScript==',
        '// @name Preserved Script',
        '// @namespace scriptvault/preserved',
        '// @version 1.0.0',
        '// @match https://example.com/*',
        '// ==/UserScript==',
        'console.log("preserved");',
      ].join('\n')),
      'Preserved.options.json': harness.fakeFflate.strToU8(JSON.stringify({
        scriptId: 'script_preserved',
        settings: { enabled: true },
      })),
    });

    const result = await harness.importFromZip(bytesToBase64(zipBytes), { overwrite: true });

    expect(result).toMatchObject({ imported: 1, skipped: 0 });
    expect(harness.ScriptStorage.set).toHaveBeenCalledWith(
      'script_preserved',
      expect.objectContaining({
        id: 'script_preserved',
        enabled: true,
        meta: expect.objectContaining({ name: 'Preserved Script' }),
      }),
    );
    expect(globalThis.generateId).not.toHaveBeenCalled();
  });

  it('generates safe ids for unsafe JSON import script ids', async () => {
    const harness = await loadFreshImportExportHarness();

    const result = await harness.importScripts({
      scripts: [{
        id: '__proto__',
        code: [
          '// ==UserScript==',
          '// @name Unsafe ID Script',
          '// @namespace scriptvault/unsafe-json-id',
          '// @version 1.0.0',
          '// @match https://example.com/*',
          '// ==/UserScript==',
          'console.log("unsafe");',
        ].join('\n'),
        enabled: true,
      }],
    }, { overwrite: true });

    expect(result).toMatchObject({ imported: 1, skipped: 0 });
    expect(harness.ScriptStorage.set).toHaveBeenCalledWith(
      'generated_script_1',
      expect.objectContaining({
        id: 'generated_script_1',
        meta: expect.objectContaining({ name: 'Unsafe ID Script' }),
      }),
    );
    expect(harness.ScriptStorage.get).not.toHaveBeenCalledWith('__proto__');
    expect(globalThis.generateId).toHaveBeenCalledTimes(1);
  });

  it('rejects oversized JSON import scripts before reading existing storage', async () => {
    const harness = await loadFreshImportExportHarness();

    const result = await harness.importScripts({
      scripts: [{
        id: 'script_too_large',
        code: 'x'.repeat(5 * 1024 * 1024 + 1),
      }],
    }, { overwrite: true });

    expect(result.error).toMatch(/too large/);
    expect(harness.ScriptStorage.getAll).not.toHaveBeenCalled();
  });

  it('rejects high-expansion ZIP metadata before script writes', async () => {
    const harness = await loadFreshImportExportHarness();
    const result = await harness.importFromZip(
      bytesToBase64(fakeZipBytes({
        'Compressed.user.js': textEntry([
          '// ==UserScript==',
          '// @name Compressed',
          '// @namespace scriptvault/source',
          '// @version 1.0.0',
          '// @match https://example.com/*',
          '// ==/UserScript==',
          'console.log("compressed");',
        ].join('\n'), {
          size: 1,
          originalSize: 1024,
        }),
      })),
      { overwrite: true },
    );

    expect(result.error).toMatch(/compression ratio is too high/);
    expect(harness.ScriptStorage.set).not.toHaveBeenCalled();
  });
});
