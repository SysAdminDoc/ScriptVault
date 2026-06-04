import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const code = readFileSync(resolve(process.cwd(), 'modules/backup-scheduler.js'), 'utf8');
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
    unzipSync(data) {
      const parsed = JSON.parse(decoder.decode(data));
      return Object.fromEntries(
        Object.entries(parsed).map(([name, bytes]) => [name, Uint8Array.from(bytes)]),
      );
    },
  };
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
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
    meta: {
      name,
      namespace: `scriptvault/${id}`,
      version: '1.0.0',
      match: ['https://example.com/*'],
      include: [],
      exclude: [],
      grant: ['none'],
      require: [],
      resource: {},
      'run-at': 'document-idle',
    },
  };
}

function createSchedulerHarness(scripts, valuesByScript = {}, settings = { enabled: true, theme: 'dark' }) {
  const fakeFflate = makeFakeFflate();
  const importFromZip = vi.fn().mockResolvedValue({ imported: 1, skipped: 0, errors: [] });
  const ScriptStorage = {
    getAll: vi.fn(async () => scripts.map((script) => structuredClone(script))),
    set: vi.fn(),
  };
  const ScriptValues = {
    getAll: vi.fn(async (scriptId) => structuredClone(valuesByScript[scriptId] || {})),
    setAll: vi.fn(),
  };
  const SettingsManager = {
    get: vi.fn(async () => structuredClone(settings)),
    set: vi.fn(),
  };
  const FolderStorage = { cache: null };
  const WorkspaceManager = { _cache: null, _initPromise: null };
  const fn = new Function(
    'chrome',
    'console',
    'fflate',
    'ScriptStorage',
    'ScriptValues',
    'SettingsManager',
    'importFromZip',
    'FolderStorage',
    'WorkspaceManager',
    'crypto',
    code + '\nreturn BackupScheduler;',
  );
  return {
    BackupScheduler: fn(
      globalThis.chrome,
      console,
      fakeFflate,
      ScriptStorage,
      ScriptValues,
      SettingsManager,
      importFromZip,
      FolderStorage,
      WorkspaceManager,
      globalThis.crypto,
    ),
    fakeFflate,
    importFromZip,
    ScriptStorage,
    SettingsManager,
  };
}

beforeEach(() => {
  globalThis.__resetStorageMock();
  chrome.storage.local.set({
    backupSchedulerSettings: {
      enabled: true,
      scheduleType: 'manual',
      hour: 3,
      dayOfWeek: 0,
      maxBackups: 5,
      notifyOnSuccess: false,
      notifyOnFailure: false,
      warnOnStorageFull: false,
    },
  });
  vi.clearAllMocks();
});

describe('runtime backup scheduler', () => {
  it('stores original script IDs in backup metadata and exposes them during inspection', async () => {
    const script = makeScript('script_alpha', 'Alpha Script');
    const { BackupScheduler, fakeFflate } = createSchedulerHarness(
      [script],
      { script_alpha: { count: 1 } },
    );

    const created = await BackupScheduler.createBackup('manual');
    const stored = await chrome.storage.local.get('autoBackups');
    const backup = stored.autoBackups[0];
    const files = fakeFflate.unzipSync(base64ToBytes(backup.data));
    const options = JSON.parse(fakeFflate.strFromU8(files['scripts/Alpha Script.options.json']));
    const inspected = await BackupScheduler.inspectBackup(created.backupId);

    expect(options.scriptId).toBe('script_alpha');
    expect(inspected.scripts[0]).toMatchObject({
      id: 'script_alpha',
      name: 'Alpha Script',
      hasStorage: true,
    });
    expect(inspected.scriptsWithStorageCount).toBe(1);
  });

  it('redacts sync credentials from managed backup settings by default', async () => {
    const script = makeScript('script_alpha', 'Alpha Script');
    const { BackupScheduler, fakeFflate } = createSchedulerHarness(
      [script],
      {},
      {
        enabled: true,
        theme: 'dark',
        webdavUsername: 'operator',
        webdavPassword: 'secret',
        googleDriveToken: 'access-token',
        s3AccessKeyId: 'AKIA_TEST',
        s3SecretKey: 'secret-key',
      },
    );

    const created = await BackupScheduler.createBackup('manual');
    const stored = await chrome.storage.local.get('autoBackups');
    const backup = stored.autoBackups[0];
    const files = fakeFflate.unzipSync(base64ToBytes(backup.data));
    const globalSettings = JSON.parse(fakeFflate.strFromU8(files['global-settings.json']));
    const metadata = JSON.parse(fakeFflate.strFromU8(files['global-settings.metadata.json']));
    const inspected = await BackupScheduler.inspectBackup(created.backupId);

    expect(globalSettings).toMatchObject({ enabled: true, theme: 'dark' });
    expect(globalSettings).not.toHaveProperty('webdavPassword');
    expect(globalSettings).not.toHaveProperty('googleDriveToken');
    expect(globalSettings).not.toHaveProperty('s3SecretKey');
    expect(metadata.settingsCredentialsIncluded).toBe(false);
    expect(metadata.redactedSettingsCredentialKeys).toEqual(
      expect.arrayContaining(['webdavPassword', 'googleDriveToken', 's3SecretKey']),
    );
    expect(backup.settingsCredentialsIncluded).toBe(false);
    expect(inspected.settingsCredentialsIncluded).toBe(false);
    expect(inspected.redactedSettingsCredentialKeys).toEqual(
      expect.arrayContaining(['webdavPassword', 'googleDriveToken', 's3SecretKey']),
    );
  });

  it('restores backup credentials only when metadata and restore option both opt in', async () => {
    await chrome.storage.local.set({
      backupSchedulerSettings: {
        enabled: true,
        scheduleType: 'manual',
        hour: 3,
        dayOfWeek: 0,
        maxBackups: 5,
        includeSettingsCredentials: true,
        notifyOnSuccess: false,
        notifyOnFailure: false,
        warnOnStorageFull: false,
      },
    });
    const script = makeScript('script_alpha', 'Alpha Script');
    const { BackupScheduler, SettingsManager } = createSchedulerHarness(
      [script],
      {},
      {
        theme: 'dark',
        webdavPassword: 'archive-secret',
        s3SecretKey: 'archive-s3-secret',
      },
    );

    const created = await BackupScheduler.createBackup('manual');
    SettingsManager.set.mockClear();

    const guardedRestore = await BackupScheduler.restoreBackup(created.backupId, {
      recordReceipt: false,
    });
    expect(guardedRestore.restoredSettings).toBe(true);
    expect(guardedRestore.settingsCredentialsRestored).toBe(false);
    expect(guardedRestore.skippedSettingsCredentialKeys).toEqual(
      expect.arrayContaining(['webdavPassword', 's3SecretKey']),
    );
    expect(SettingsManager.set).toHaveBeenCalledWith(
      expect.not.objectContaining({
        webdavPassword: expect.anything(),
        s3SecretKey: expect.anything(),
      }),
    );

    SettingsManager.set.mockClear();
    const credentialRestore = await BackupScheduler.restoreBackup(created.backupId, {
      importSettingsCredentials: true,
      recordReceipt: false,
    });
    expect(credentialRestore.settingsCredentialsRestored).toBe(true);
    expect(SettingsManager.set).toHaveBeenCalledWith(
      expect.objectContaining({
        webdavPassword: 'archive-secret',
        s3SecretKey: 'archive-s3-secret',
      }),
    );
  });

  it('selective restore imports only selected script ID files through the shared zip importer', async () => {
    const { BackupScheduler, fakeFflate, importFromZip, ScriptStorage } = createSchedulerHarness(
      [
        makeScript('script_alpha', 'Alpha'),
        makeScript('script_beta', 'Beta'),
      ],
      {
        script_alpha: { alpha: true },
        script_beta: { beta: true },
      },
    );

    const created = await BackupScheduler.createBackup('manual');
    const restored = await BackupScheduler.restoreBackup(created.backupId, {
      selective: true,
      scriptIds: ['script_beta'],
    });

    const [zipBase64] = importFromZip.mock.calls[0];
    const selectedFiles = fakeFflate.unzipSync(base64ToBytes(zipBase64));

    expect(restored).toMatchObject({ success: true, restoredScripts: 1 });
    expect(Object.keys(selectedFiles).sort()).toEqual([
      'scripts/Beta.options.json',
      'scripts/Beta.storage.json',
      'scripts/Beta.user.js',
    ]);
    expect(ScriptStorage.set).not.toHaveBeenCalled();
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
        notifyOnFailure: false,
        warnOnStorageFull: false,
      },
    });
    const { BackupScheduler } = createSchedulerHarness([]);

    await BackupScheduler.init();

    expect(chrome.alarms.clear).toHaveBeenCalledWith('sv_backup_scheduled');
    expect(chrome.alarms.clear).not.toHaveBeenCalledWith('sv_backup_debounce');
    expect(chrome.alarms.create).not.toHaveBeenCalledWith(
      'sv_backup_scheduled',
      expect.any(Object),
    );
  });

  it('clears a stale on-change debounce alarm when backups are disabled', async () => {
    await chrome.storage.local.set({
      backupSchedulerSettings: {
        enabled: false,
        scheduleType: 'onChange',
        hour: 3,
        dayOfWeek: 0,
        maxBackups: 5,
        notifyOnSuccess: false,
        notifyOnFailure: false,
        warnOnStorageFull: false,
      },
    });
    const { BackupScheduler } = createSchedulerHarness([]);

    await BackupScheduler.init();

    expect(chrome.alarms.clear).toHaveBeenCalledWith('sv_backup_scheduled');
    expect(chrome.alarms.clear).toHaveBeenCalledWith('sv_backup_debounce');
  });
});
