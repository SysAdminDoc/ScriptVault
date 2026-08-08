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

function createSchedulerHarness({
  scripts = [],
  values = {},
  importFromZipImpl,
  settings = { theme: 'dark' },
} = {}) {
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
    get: vi.fn(async () => structuredClone(settings)),
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

  const _body = code + '\nreturn BackupScheduler;';
  let fn;
  try { const vm = require('node:vm'); fn = vm.compileFunction(_body, ['chrome', 'console', 'fflate', 'ScriptStorage', 'ScriptValues', 'SettingsManager', 'importFromZip', 'FolderStorage', 'WorkspaceManager', 'crypto'], { filename: resolve(process.cwd(), 'modules/backup-scheduler.js') }); } catch { fn = new Function('chrome', 'console', 'fflate', 'ScriptStorage', 'ScriptValues', 'SettingsManager', 'importFromZip', 'FolderStorage', 'WorkspaceManager', 'crypto', _body); }
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

  it('reports backup credential metadata as booleans and counts only', async () => {
    const { BackupScheduler } = createSchedulerHarness({
      scripts: [makeScript('alpha', 'Alpha')],
      settings: {
        theme: 'dark',
        webdavPassword: 'secret',
        s3SecretKey: 's3-secret',
      },
    });
    const created = await BackupScheduler.createBackup('manual');
    const result = await BackupScheduler.verifyBackup(created.backupId);

    expect(result.summary.settingsCredentialsIncluded).toBe(false);
    expect(result.summary.redactedSettingsCredentialKeyCount).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(result.summary)).not.toContain('webdavPassword');
    expect(JSON.stringify(result.summary)).not.toContain('s3SecretKey');
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


  it('stays retryable when the rollback itself fails', async () => {
    // rolledBackAt is the spent marker the entry guard checks. Stamping it on
    // a FAILED rollback turned a transient IDB/quota error into a permanently
    // unusable undo, with the snapshot still sitting in the receipt.
    const { BackupScheduler, store, ScriptStorage } = createSchedulerHarness({
      scripts: [makeScript('alpha', 'Alpha v1', { version: '1.0.0' })],
    });
    const created = await BackupScheduler.createBackup('manual');
    store.set('alpha', { ...store.get('alpha'), code: 'console.log("v2");' });
    const result = await BackupScheduler.restoreBackup(created.backupId);
    expect(result.receiptId).toBeTruthy();

    // Make every script write fail for the first rollback attempt.
    const originalSet = ScriptStorage.set;
    ScriptStorage.set = vi.fn(async () => { throw new Error('quota exceeded'); });
    const failed = await BackupScheduler.rollbackRestoreReceipt(result.receiptId);
    expect(failed.success).toBe(false);

    // The receipt must NOT be marked spent, so a retry is still allowed.
    ScriptStorage.set = originalSet;
    const retried = await BackupScheduler.rollbackRestoreReceipt(result.receiptId);
    expect(retried.alreadyRolledBack).toBeUndefined();
    expect(retried.success).toBe(true);
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

// A restore's receipt is the ONLY undo. It used to be written after the whole
// mutation chain, so an MV3 service worker dying at any await left mixed
// restored/pre-restore data and an empty ledger. What follows tests the on-disk
// state DURING the mutation window, plus the recovery path for a receipt found
// still pending on a later start.
//
// Note on simulating the death: a thrown importFromZip is a HANDLED failure —
// restoreBackup returns and finalizes. A real interruption is the function never
// returning, so the honest tests are (a) inspect storage while a mutation is
// in flight, and (b) seed a pending receipt and drive the recovery.
describe('an interrupted restore leaves a recoverable receipt', () => {
  async function readReceipts() {
    const data = await chrome.storage.local.get('restoreReceipts');
    // Deep-clone: the storage mock hands back live references, so a later
    // finalize would retroactively "fix" anything captured by reference.
    return structuredClone(data.restoreReceipts || []);
  }

  it('persists the receipt with its snapshot BEFORE the first mutation', async () => {
    let receiptsAtFirstWrite = null;
    const harness = createSchedulerHarness({
      scripts: [makeScript('s1', 'Original')],
      importFromZipImpl: async () => {
        receiptsAtFirstWrite = await readReceipts();
        return { imported: 1, skipped: 0, errors: [] };
      },
    });
    const created = await harness.BackupScheduler.createBackup('manual');
    expect(created.success).toBe(true);

    await harness.BackupScheduler.restoreBackup(created.backupId ?? created.id);

    expect(receiptsAtFirstWrite).toHaveLength(1);
    expect(receiptsAtFirstWrite[0].status).toBe('pending');
    // The snapshot — the thing that makes undo possible — is already on disk.
    expect(receiptsAtFirstWrite[0].snapshot.scriptsBefore.map((x) => x.id)).toEqual(['s1']);
    expect(typeof receiptsAtFirstWrite[0].startedAt).toBe('number');
  });

  it('holds the pending receipt for the whole mutation window', async () => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    let duringWindow = null;

    const harness = createSchedulerHarness({
      scripts: [makeScript('s1', 'Original')],
      importFromZipImpl: async () => {
        // The worker could die anywhere in here.
        duringWindow = await readReceipts();
        await gate;
        return { imported: 1, skipped: 0, errors: [] };
      },
    });
    const created = await harness.BackupScheduler.createBackup('manual');
    const inFlight = harness.BackupScheduler.restoreBackup(created.backupId ?? created.id);

    // Let the importer reach the gate, then inspect what a restart would find.
    await new Promise((r) => setTimeout(r, 0));
    const interruptedNow = await harness.BackupScheduler.listInterruptedRestores();
    expect(interruptedNow).toHaveLength(1);
    expect(interruptedNow[0].status).toBe('pending');
    expect(interruptedNow[0].snapshotScriptCount).toBe(1);

    release();
    await inFlight;
    expect(duringWindow[0].status).toBe('pending');
  });

  it('finalizes the receipt to complete when the restore finishes', async () => {
    const harness = createSchedulerHarness({ scripts: [makeScript('s1', 'Original')] });
    const created = await harness.BackupScheduler.createBackup('manual');

    const result = await harness.BackupScheduler.restoreBackup(created.backupId ?? created.id);
    expect(result.receiptId).toBeTruthy();

    const receipts = await harness.BackupScheduler.listReceipts();
    expect(receipts).toHaveLength(1);
    expect(receipts[0].status).toBe('complete');
    expect(receipts[0].incomplete).toBe(false);
    await expect(harness.BackupScheduler.listInterruptedRestores()).resolves.toEqual([]);
  });

  // A selective restore whose selection matches nothing returns before touching
  // anything, so beginMutations() is never reached and no row is written at all.
  it('writes no receipt when a selective restore never reaches a mutation', async () => {
    const harness = createSchedulerHarness({
      scripts: [makeScript('s1', 'Original')],
      importFromZipImpl: async () => {
        throw new Error('must not be called: nothing was selected');
      },
    });
    const created = await harness.BackupScheduler.createBackup('manual');

    const result = await harness.BackupScheduler.restoreBackup(created.backupId ?? created.id, {
      selective: true,
      scriptIds: ['does-not-exist'],
    });
    expect(result.restoredScripts).toBe(0);

    await expect(harness.BackupScheduler.listInterruptedRestores()).resolves.toEqual([]);
    await expect(harness.BackupScheduler.listReceipts()).resolves.toEqual([]);
    expect(harness.importFromZip).not.toHaveBeenCalled();
  });

  // A settings-only restore mutates too, so it must still be undoable.
  it('records a receipt for a restore that only replaced global settings', async () => {
    const harness = createSchedulerHarness({
      scripts: [makeScript('s1', 'Original')],
      importFromZipImpl: async () => ({ imported: 0, skipped: 0, errors: [] }),
    });
    const created = await harness.BackupScheduler.createBackup('manual');

    const result = await harness.BackupScheduler.restoreBackup(created.backupId ?? created.id);
    expect(result.restoredSettings).toBe(true);
    expect(result.receiptId).toBeTruthy();

    const receipts = await harness.BackupScheduler.listReceipts();
    expect(receipts).toHaveLength(1);
    expect(receipts[0].status).toBe('complete');
  });

  it('keeps the snapshot when the mutation phase errored, even with no counter moved', async () => {
    const harness = createSchedulerHarness({
      scripts: [makeScript('s1', 'Original')],
      importFromZipImpl: async () => {
        // Writes may have partially landed before this: "nothing counted" is not
        // the same as "nothing happened".
        throw new Error('import blew up part-way');
      },
    });
    const created = await harness.BackupScheduler.createBackup('manual');

    await harness.BackupScheduler.restoreBackup(created.backupId ?? created.id);

    const receipts = await harness.BackupScheduler.listReceipts();
    expect(receipts).toHaveLength(1);
    expect(receipts[0].snapshotScriptCount).toBe(1);
  });
});

describe('recovering a restore that never returned', () => {
  function seedPendingReceipt(overrides = {}) {
    const receipt = {
      id: 'receipt_pending_1',
      type: 'restore',
      source: 'backup-restore',
      sourceLabel: 'Backup 2026-08-08T00:00:00.000Z',
      timestamp: Date.now(),
      startedAt: Date.now(),
      status: 'pending',
      backupId: 'backup_1',
      selective: false,
      result: null,
      snapshot: {
        scriptsBefore: [makeScript('s1', 'Pre-restore')],
        valuesBefore: {},
        scriptIdsBefore: ['s1'],
      },
      ...overrides,
    };
    return chrome.storage.local.set({ restoreReceipts: [receipt] });
  }

  it('reports it once on init, not on every worker wake', async () => {
    await seedPendingReceipt();
    const notify = vi.fn();
    const previous = chrome.notifications?.create;
    chrome.notifications = { ...(chrome.notifications || {}), create: notify };
    try {
      await createSchedulerHarness({ scripts: [] }).BackupScheduler.init();
      // A second start must stay quiet — the entry is stamped as reported.
      await createSchedulerHarness({ scripts: [] }).BackupScheduler.init();
      expect(notify).toHaveBeenCalledTimes(1);
      expect(String(notify.mock.calls[0][1]?.title)).toContain('incomplete');
    } finally {
      if (previous) chrome.notifications.create = previous;
    }
  });

  it('keeps flagging it until it is rolled back', async () => {
    await seedPendingReceipt();
    const harness = createSchedulerHarness({ scripts: [] });
    await harness.BackupScheduler.init();

    const interrupted = await harness.BackupScheduler.listInterruptedRestores();
    expect(interrupted).toHaveLength(1);
    expect(interrupted[0].incomplete).toBe(true);
  });

  it('rolls the half-written library back from the pending snapshot', async () => {
    await seedPendingReceipt();
    // The library is mid-restore: the pre-restore copy has been clobbered.
    const harness = createSchedulerHarness({
      scripts: [{ ...makeScript('s1', 'Clobbered'), code: '// clobbered' }],
    });

    const rolledBack = await harness.BackupScheduler.rollbackRestoreReceipt('receipt_pending_1');
    expect(rolledBack?.success).not.toBe(false);
    expect(harness.store.get('s1').code).not.toBe('// clobbered');

    // Rolled back, so it is no longer offered.
    await expect(harness.BackupScheduler.listInterruptedRestores()).resolves.toEqual([]);
  });
});

describe('the library-mutation journal covers the import paths', () => {
  it('records an open mutation and clears it when it closes', async () => {
    const harness = createSchedulerHarness({ scripts: [] });

    const id = await harness.BackupScheduler.beginLibraryMutation('import-json', 'JSON import');
    expect(id).toBeTruthy();
    let open = await harness.BackupScheduler.listInterruptedMutations();
    expect(open).toHaveLength(1);
    expect(open[0]).toMatchObject({ op: 'import-json', label: 'JSON import' });

    await harness.BackupScheduler.endLibraryMutation(id);
    open = await harness.BackupScheduler.listInterruptedMutations();
    expect(open).toEqual([]);
  });

  it('reports a journal entry left behind, then clears it so it warns once', async () => {
    const opener = createSchedulerHarness({ scripts: [] });
    await opener.BackupScheduler.beginLibraryMutation('import-zip', 'ZIP import (overwrite)');

    const notify = vi.fn();
    const previous = chrome.notifications?.create;
    chrome.notifications = { ...(chrome.notifications || {}), create: notify };
    try {
      // A fresh scheduler stands in for the next service-worker start.
      await createSchedulerHarness({ scripts: [] }).BackupScheduler.init();
      expect(notify).toHaveBeenCalledTimes(1);
      expect(String(notify.mock.calls[0][1]?.title)).toContain('did not finish');
    } finally {
      if (previous) chrome.notifications.create = previous;
    }

    await expect(opener.BackupScheduler.listInterruptedMutations()).resolves.toEqual([]);
  });

  it('ages out an entry too old to be genuinely in flight', async () => {
    await chrome.storage.local.set({
      libraryMutationJournal: [
        { id: 'stale', op: 'import-json', label: 'old', startedAt: Date.now() - (7 * 60 * 60 * 1000) },
      ],
    });
    const harness = createSchedulerHarness({ scripts: [] });
    const id = await harness.BackupScheduler.beginLibraryMutation('import-json', 'new one');

    const open = await harness.BackupScheduler.listInterruptedMutations();
    expect(open.map((entry) => entry.id)).toEqual([id]);
  });

  it('tolerates closing an entry that was never opened', async () => {
    const harness = createSchedulerHarness({ scripts: [] });
    await expect(harness.BackupScheduler.endLibraryMutation(null)).resolves.toBeUndefined();
    await expect(harness.BackupScheduler.endLibraryMutation('nope')).resolves.toBeUndefined();
  });
});
