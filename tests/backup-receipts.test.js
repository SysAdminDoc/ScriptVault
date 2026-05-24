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

function makeScript(id, name, { version = '1.0.0', code: body = `console.log(${JSON.stringify(name)});` } = {}) {
  return {
    id,
    code: [
      '// ==UserScript==',
      `// @name ${name}`,
      `// @namespace scriptvault/${id}`,
      `// @version ${version}`,
      '// @match https://example.com/*',
      '// ==/UserScript==',
      body,
    ].join('\n'),
    enabled: true,
    meta: {
      name,
      namespace: `scriptvault/${id}`,
      version,
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

function createSchedulerHarness({ scripts = [], values = {}, importFromZipImpl } = {}) {
  const fakeFflate = makeFakeFflate();
  // Internal mutable store so set/delete/getAll all see the same state.
  const store = new Map(scripts.map(s => [s.id, structuredClone(s)]));
  const valueStore = new Map(Object.entries(values).map(([k, v]) => [k, structuredClone(v)]));

  const ScriptStorage = {
    getAll: vi.fn(async () => Array.from(store.values()).map(s => structuredClone(s))),
    get: vi.fn(async (id) => {
      const v = store.get(id);
      return v ? structuredClone(v) : null;
    }),
    set: vi.fn(async (id, script) => {
      store.set(id, structuredClone(script));
    }),
    delete: vi.fn(async (id) => {
      store.delete(id);
    }),
  };
  const ScriptValues = {
    getAll: vi.fn(async (id) => structuredClone(valueStore.get(id) || {})),
    setAll: vi.fn(async (id, values) => { valueStore.set(id, structuredClone(values)); }),
    deleteAll: vi.fn(async (id) => { valueStore.delete(id); }),
  };
  const SettingsManager = {
    get: vi.fn(async () => ({ theme: 'dark' })),
    set: vi.fn(async () => {}),
  };
  const FolderStorage = { cache: null };
  const WorkspaceManager = { _cache: null, _initPromise: null };

  const importFromZip = vi.fn(importFromZipImpl || (async (zipData) => {
    // Default: unzip and apply each user.js to the store so a full restore
    // round-trip actually mutates state the way the runtime importer would.
    let bytes;
    if (typeof zipData === 'string') {
      const binary = atob(zipData);
      bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    } else {
      bytes = zipData;
    }
    const unzipped = fakeFflate.unzipSync(bytes);
    let imported = 0;
    let skipped = 0;
    const errors = [];
    for (const [filename, content] of Object.entries(unzipped)) {
      if (!filename.endsWith('.user.js')) continue;
      try {
        const base = filename.replace(/\.user\.js$/, '');
        const opt = unzipped[`${base}.options.json`];
        const optionsData = opt ? JSON.parse(fakeFflate.strFromU8(opt)) : {};
        const id = optionsData.scriptId || `imported_${Date.now()}_${imported}`;
        const codeStr = fakeFflate.strFromU8(content);
        const next = {
          id,
          code: codeStr,
          meta: optionsData.meta || { name: base, namespace: '', version: '1.0' },
          enabled: optionsData.settings?.enabled !== false,
        };
        store.set(id, next);
        imported++;
      } catch (err) {
        errors.push({ name: filename, error: err.message });
      }
    }
    return { imported, skipped, errors };
  }));

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
    ScriptValues,
    SettingsManager,
    store,
    valueStore,
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

describe('verifyBackup', () => {
  it('reports script counts and structural validity for a clean backup', async () => {
    const { BackupScheduler } = createSchedulerHarness({
      scripts: [makeScript('alpha', 'Alpha'), makeScript('beta', 'Beta')],
    });
    const created = await BackupScheduler.createBackup('manual');
    const result = await BackupScheduler.verifyBackup(created.backupId);

    expect(result).not.toBeNull();
    expect(result.summary.scriptCount).toBe(2);
    expect(result.summary.parseErrors).toBe(0);
    expect(result.summary.optionsParseErrors).toBe(0);
    expect(result.valid).toBe(true);
    expect(result.scripts.every(s => !s.parseError)).toBe(true);
  });

  it('flags scripts the injected parser rejects', async () => {
    const { BackupScheduler } = createSchedulerHarness({
      scripts: [makeScript('alpha', 'Alpha'), makeScript('beta', 'Beta')],
    });
    const created = await BackupScheduler.createBackup('manual');
    const parseUserscript = vi.fn(code => {
      if (code.includes('Beta')) return { error: 'Synthetic parse failure' };
      return { meta: { name: 'Alpha' } };
    });

    const result = await BackupScheduler.verifyBackup(created.backupId, { parseUserscript });
    expect(parseUserscript).toHaveBeenCalled();
    expect(result.summary.parseErrors).toBe(1);
    expect(result.valid).toBe(false);
    const betaEntry = result.scripts.find(s => s.name === 'Beta' || s.filename.includes('Beta'));
    expect(betaEntry?.parseError).toBe('Synthetic parse failure');
  });

  it('flags conflict when an installed script id matches a backup script id', async () => {
    const { BackupScheduler } = createSchedulerHarness({
      scripts: [makeScript('alpha', 'Alpha')],
    });
    const created = await BackupScheduler.createBackup('manual');
    const result = await BackupScheduler.verifyBackup(created.backupId);
    const entry = result.scripts.find(s => s.scriptId === 'alpha');
    expect(entry?.conflictsWithId).toBe('alpha');
  });

  it('reports invalid auxiliary JSON', async () => {
    const { BackupScheduler, fakeFflate } = createSchedulerHarness({
      scripts: [makeScript('alpha', 'Alpha')],
    });
    const created = await BackupScheduler.createBackup('manual');
    // Tamper the stored backup data so global-settings.json is no longer valid JSON.
    const stored = await chrome.storage.local.get('autoBackups');
    const backup = stored.autoBackups[0];
    const bytes = (() => {
      const bin = atob(backup.data);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    })();
    const unzipped = fakeFflate.unzipSync(bytes);
    unzipped['global-settings.json'] = fakeFflate.strToU8('{not json');
    const re = fakeFflate.zipSync(unzipped);
    let bin = '';
    for (let i = 0; i < re.length; i += 8192) {
      bin += String.fromCharCode.apply(null, Array.from(re.subarray(i, i + 8192)));
    }
    backup.data = btoa(bin);
    await chrome.storage.local.set({ autoBackups: stored.autoBackups });

    const result = await BackupScheduler.verifyBackup(created.backupId);
    expect(result.summary.globalSettingsValid).toBe(false);
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.kind === 'global-settings-parse')).toBe(true);
  });

  it('returns null for an unknown backupId', async () => {
    const { BackupScheduler } = createSchedulerHarness();
    expect(await BackupScheduler.verifyBackup('does-not-exist')).toBeNull();
  });
});

describe('restoreBackup snapshot + receipt', () => {
  it('records a receipt with pre-restore snapshot and assigns a receiptId in the result', async () => {
    const { BackupScheduler, store } = createSchedulerHarness({
      scripts: [makeScript('alpha', 'Alpha v1', { version: '1.0.0' })],
      values: { alpha: { count: 5 } },
    });
    const created = await BackupScheduler.createBackup('manual');

    // Mutate alpha in place so the next restore "overwrites" it with the snapshot version.
    store.set('alpha', { ...store.get('alpha'), code: 'console.log("mutated");', meta: { ...store.get('alpha').meta, version: '2.0.0' } });

    const result = await BackupScheduler.restoreBackup(created.backupId);
    expect(result.success).toBe(true);
    expect(typeof result.receiptId).toBe('string');

    const receipts = await BackupScheduler.listReceipts();
    expect(receipts.length).toBe(1);
    expect(receipts[0]).toMatchObject({ type: 'restore', source: 'backup-restore', id: result.receiptId });

    const full = await BackupScheduler.getReceipt(result.receiptId);
    expect(full.snapshot.scriptsBefore.length).toBe(1);
    expect(full.snapshot.scriptsBefore[0].meta.version).toBe('2.0.0');
    expect(full.snapshot.scriptIdsBefore).toContain('alpha');
  });

  it('does not record a receipt when recordReceipt is false', async () => {
    const { BackupScheduler } = createSchedulerHarness({
      scripts: [makeScript('alpha', 'Alpha')],
    });
    const created = await BackupScheduler.createBackup('manual');
    const result = await BackupScheduler.restoreBackup(created.backupId, { recordReceipt: false });
    expect(result.receiptId).toBeUndefined();
    expect((await BackupScheduler.listReceipts()).length).toBe(0);
  });
});

describe('rollbackRestoreReceipt', () => {
  it('restores prior scripts and removes scripts that the restore added', async () => {
    const { BackupScheduler, store } = createSchedulerHarness({
      scripts: [makeScript('alpha', 'Alpha v1', { version: '1.0.0' })],
    });
    const created = await BackupScheduler.createBackup('manual');
    // Mutate alpha and add a brand-new script so the snapshot has scripts to remove on rollback.
    store.set('alpha', { ...store.get('alpha'), code: 'console.log("v2");', meta: { ...store.get('alpha').meta, version: '2.0.0' } });
    store.set('beta', makeScript('beta', 'Beta added before restore'));

    // Restore from the backup (alpha is reverted; beta survives via importFromZip default which doesn't remove unseen scripts).
    const result = await BackupScheduler.restoreBackup(created.backupId);
    expect(result.receiptId).toBeTruthy();

    // After restore, alpha is back at v1 but the snapshot remembers it was at v2.
    // Simulate the restore having added a third script (gamma) that wasn't in the snapshot.
    store.set('gamma', makeScript('gamma', 'Gamma added by restore'));
    // Patch the receipt to mark gamma as added.
    const all = await chrome.storage.local.get('restoreReceipts');
    all.restoreReceipts[0].snapshot.addedScriptIds = ['gamma'];
    await chrome.storage.local.set({ restoreReceipts: all.restoreReceipts });

    const rollback = await BackupScheduler.rollbackRestoreReceipt(result.receiptId);
    expect(rollback.success).toBe(true);
    expect(rollback.removedScripts).toBe(1); // gamma removed
    expect(store.has('gamma')).toBe(false);
    // alpha should now be back at v2 (the pre-restore snapshot)
    expect(store.get('alpha').meta.version).toBe('2.0.0');
  });

  it('returns an error when the receipt has already been rolled back', async () => {
    const { BackupScheduler } = createSchedulerHarness({
      scripts: [makeScript('alpha', 'Alpha')],
    });
    const created = await BackupScheduler.createBackup('manual');
    const result = await BackupScheduler.restoreBackup(created.backupId);
    await BackupScheduler.rollbackRestoreReceipt(result.receiptId);
    const second = await BackupScheduler.rollbackRestoreReceipt(result.receiptId);
    expect(second.success).toBe(false);
    expect(second.alreadyRolledBack).toBe(true);
  });

  it('returns an error when the receipt is unknown', async () => {
    const { BackupScheduler } = createSchedulerHarness();
    const r = await BackupScheduler.rollbackRestoreReceipt('nope');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/not found/i);
  });
});

describe('recordReceipt + retention', () => {
  it('records an import receipt and surfaces it in listReceipts', async () => {
    const { BackupScheduler } = createSchedulerHarness();
    const meta = await BackupScheduler.recordReceipt({
      type: 'import',
      source: 'import-zip',
      sourceLabel: 'ZIP: example.zip',
      result: { imported: 3, skipped: 0, replacedScripts: 1, errors: [] },
      snapshot: {
        scriptsBefore: [makeScript('alpha', 'Alpha snapshot')],
        valuesBefore: { alpha: { v: 1 } },
        scriptIdsBefore: ['alpha'],
        addedScriptIds: [],
      },
    });
    expect(meta.id).toBeTruthy();
    const list = await BackupScheduler.listReceipts();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ type: 'import', source: 'import-zip', snapshotScriptCount: 1 });
  });

  it('caps stored receipts at the retention limit (10)', async () => {
    const { BackupScheduler } = createSchedulerHarness();
    for (let i = 0; i < 12; i++) {
      await BackupScheduler.recordReceipt({
        type: 'import',
        source: 'import-zip',
        sourceLabel: `slot-${i}`,
        result: { imported: 1, skipped: 0, errors: [] },
        snapshot: { scriptsBefore: [], valuesBefore: {}, scriptIdsBefore: [], addedScriptIds: [] },
      });
    }
    const list = await BackupScheduler.listReceipts();
    expect(list).toHaveLength(10);
    // Newest first
    expect(list[0].sourceLabel).toBe('slot-11');
  });

  it('clearReceipts empties the persisted list', async () => {
    const { BackupScheduler } = createSchedulerHarness();
    await BackupScheduler.recordReceipt({
      type: 'import',
      source: 'import-zip',
      sourceLabel: 'one',
      result: {},
      snapshot: { scriptsBefore: [], valuesBefore: {}, scriptIdsBefore: [], addedScriptIds: [] },
    });
    await BackupScheduler.clearReceipts();
    expect(await BackupScheduler.listReceipts()).toEqual([]);
  });
});
