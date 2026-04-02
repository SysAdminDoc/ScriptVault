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
    unzipSync(data) {
      const parsed = JSON.parse(decoder.decode(data));
      return Object.fromEntries(
        Object.entries(parsed).map(([name, bytes]) => [name, Uint8Array.from(bytes)]),
      );
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

async function loadFreshBackupSchedulerHarness(scripts, valuesByScript = {}) {
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
    get: vi.fn(async () => ({ enabled: true, layout: 'dark' })),
  };

  vi.doMock('../src/modules/storage.ts', () => ({
    ScriptStorage,
    ScriptValues,
    SettingsManager,
  }));

  const mod = await import('../src/modules/backup-scheduler.ts');
  return {
    BackupScheduler: mod.BackupScheduler,
    fakeFflate,
    importFromZip,
  };
}

async function loadFreshImportExportHarness(existingScripts = [], storedValuesByScript = {}) {
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
    get: vi.fn(async () => ({ enabled: true })),
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
    expect(inspected).toEqual([
      {
        id: 'script_alpha',
        name: 'Alpha Script',
        hasStorage: true,
      },
    ]);
    expect(chrome.notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        iconUrl: 'chrome-extension://test-extension-id/images/icon128.png',
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

    expect(restore).toEqual({ success: true, restoredScripts: 1 });
    expect(Object.keys(selectedFiles).sort()).toEqual([
      'scripts/Beta.options.json',
      'scripts/Beta.storage.json',
      'scripts/Beta.user.js',
    ]);
  });
});

describe('source import/export module', () => {
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
  });

  it('preserves stored script ids when importing a ScriptVault zip', async () => {
    const harness = await loadFreshImportExportHarness();
    const options = {
      scriptId: 'script_preserved',
      settings: { enabled: false },
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
      }),
    );
    expect(harness.ScriptValues.setAll).toHaveBeenCalledWith('script_preserved', { draft: true });
    expect(globalThis.generateId).not.toHaveBeenCalled();
  });
});
