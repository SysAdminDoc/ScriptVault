import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const backgroundCoreCode = readFileSync(resolve(process.cwd(), 'background.core.js'), 'utf8');
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
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function makeScript(id, name, { version = '1.0.0', code: body = `console.log("${name}");` } = {}) {
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
    position: 0,
    createdAt: 1,
    updatedAt: 2,
    meta: {
      name,
      namespace: `scriptvault/${id}`,
      version,
      description: `${name} script`,
      author: 'QA',
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

function extractRuntimeImportExportCode() {
  const parserStart = backgroundCoreCode.indexOf('function parseUserscript');
  const parserEnd = backgroundCoreCode.indexOf('// URL Matching', parserStart);
  const importStart = backgroundCoreCode.indexOf('const ARCHIVE_MAX_SCRIPT_BYTES');
  const importEnd = backgroundCoreCode.indexOf('// Message Handlers', importStart);

  if ([parserStart, parserEnd, importStart, importEnd].some(index => index === -1)) {
    throw new Error('Unable to extract runtime import/export code from background.core.js');
  }

  return `${backgroundCoreCode.slice(parserStart, parserEnd)}\n${backgroundCoreCode.slice(importStart, importEnd)}`;
}

function createHarness(existingScripts = [], existingValues = {}) {
  const fakeFflate = makeFakeFflate();
  let generatedIdCounter = 1;
  const scriptCache = new Map(existingScripts.map(s => [s.id, structuredClone(s)]));
  const valueCache = new Map(Object.entries(existingValues).map(([id, v]) => [id, structuredClone(v)]));

  const ScriptStorage = {
    getAll: vi.fn(async () => Array.from(scriptCache.values()).map(s => structuredClone(s))),
    get: vi.fn(async id => (scriptCache.has(id) ? structuredClone(scriptCache.get(id)) : null)),
    set: vi.fn(async (id, script) => {
      scriptCache.set(id, structuredClone(script));
      return script;
    }),
    delete: vi.fn(async id => { scriptCache.delete(id); }),
  };
  const ScriptValues = {
    getAll: vi.fn(async id => structuredClone(valueCache.get(id) || {})),
    setAll: vi.fn(async (id, values) => { valueCache.set(id, structuredClone(values)); }),
    deleteAll: vi.fn(async id => { valueCache.delete(id); }),
  };
  const SettingsManager = {
    get: vi.fn(async () => ({})),
    set: vi.fn(),
  };
  const registerAllScripts = vi.fn().mockResolvedValue();
  const updateBadge = vi.fn().mockResolvedValue();
  const generateId = vi.fn(() => `generated_script_${generatedIdCounter++}`);
  const BackupScheduler = {
    recordReceipt: vi.fn(async receipt => ({ id: `receipt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, ...receipt })),
  };

  const fn = new Function(
    'fflate',
    'ScriptStorage',
    'ScriptValues',
    'SettingsManager',
    'registerAllScripts',
    'updateBadge',
    'generateId',
    'BackupScheduler',
    `${extractRuntimeImportExportCode()}; return { exportToZip, importFromZip, importScripts };`,
  );

  return {
    ...fn(fakeFflate, ScriptStorage, ScriptValues, SettingsManager, registerAllScripts, updateBadge, generateId, BackupScheduler),
    fakeFflate,
    ScriptStorage,
    ScriptValues,
    scriptCache,
    valueCache,
    BackupScheduler,
  };
}

describe('importScripts overwrite snapshotting', () => {
  it('pushes prior version into versionHistory when overwriting', async () => {
    const existing = makeScript('script_alpha', 'Alpha v1', { version: '1.0.0' });
    const harness = createHarness([existing]);
    const newCode = [
      '// ==UserScript==',
      '// @name Alpha v2',
      '// @namespace scriptvault/alpha',
      '// @version 2.0.0',
      '// @match https://example.com/*',
      '// ==/UserScript==',
      'console.log("v2");',
    ].join('\n');

    const result = await harness.importScripts(
      { scripts: [{ id: 'script_alpha', code: newCode, enabled: true }] },
      { overwrite: true, sourceLabel: 'test-import' },
    );

    expect(result).toMatchObject({ imported: 1, skipped: 0 });
    expect(result.replacedScripts).toEqual([{ id: 'script_alpha', name: 'Alpha v1', priorVersion: '1.0.0' }]);
    const stored = harness.scriptCache.get('script_alpha');
    expect(stored.versionHistory).toHaveLength(1);
    expect(stored.versionHistory[0]).toMatchObject({ version: '1.0.0', source: 'import' });
    expect(stored.versionHistory[0].code).toContain('==UserScript==');
  });

  it('records an import receipt that captures the pre-overwrite snapshot', async () => {
    const existing = makeScript('script_alpha', 'Alpha v1', { version: '1.0.0' });
    const harness = createHarness([existing], { script_alpha: { count: 7 } });
    const newCode = [
      '// ==UserScript==',
      '// @name Alpha v2',
      '// @namespace scriptvault/alpha',
      '// @version 2.0.0',
      '// @match https://example.com/*',
      '// ==/UserScript==',
      'console.log("v2");',
    ].join('\n');

    const result = await harness.importScripts(
      { scripts: [{ id: 'script_alpha', code: newCode, enabled: true }] },
      { overwrite: true, sourceLabel: 'JSON: bundle.json' },
    );

    expect(harness.BackupScheduler.recordReceipt).toHaveBeenCalledTimes(1);
    const [receiptArg] = harness.BackupScheduler.recordReceipt.mock.calls[0];
    expect(receiptArg).toMatchObject({
      type: 'import',
      source: 'import-json',
      sourceLabel: 'JSON: bundle.json',
      result: expect.objectContaining({
        quarantinedScripts: 1,
        preservedDisabledScripts: 0,
        trustedEnabledScripts: 0,
      }),
    });
    expect(receiptArg.snapshot.scriptsBefore).toHaveLength(1);
    expect(receiptArg.snapshot.scriptsBefore[0].meta.version).toBe('1.0.0');
    expect(receiptArg.snapshot.valuesBefore).toEqual({ script_alpha: { count: 7 } });
    expect(receiptArg.snapshot.scriptIdsBefore).toEqual(['script_alpha']);
    expect(receiptArg.snapshot.addedScriptIds).toEqual([]);
    expect(typeof result.receiptId).toBe('string');
  });

  it('does not record a receipt when nothing was overwritten', async () => {
    const harness = createHarness();
    const newCode = [
      '// ==UserScript==',
      '// @name Brand New',
      '// @namespace scriptvault/new',
      '// @version 1.0.0',
      '// @match https://example.com/*',
      '// ==/UserScript==',
      'console.log("new");',
    ].join('\n');

    const result = await harness.importScripts(
      { scripts: [{ code: newCode, enabled: true }] },
      { overwrite: true },
    );

    expect(result.imported).toBe(1);
    expect(result.replacedScripts).toEqual([]);
    expect(harness.BackupScheduler.recordReceipt).not.toHaveBeenCalled();
    expect(result.receiptId).toBeUndefined();
  });

  it('does not record a receipt when recordReceipt is explicitly false', async () => {
    const existing = makeScript('script_alpha', 'Alpha v1', { version: '1.0.0' });
    const harness = createHarness([existing]);
    const newCode = [
      '// ==UserScript==',
      '// @name Alpha v2',
      '// @namespace scriptvault/alpha',
      '// @version 2.0.0',
      '// @match https://example.com/*',
      '// ==/UserScript==',
      'console.log("v2");',
    ].join('\n');

    await harness.importScripts(
      { scripts: [{ id: 'script_alpha', code: newCode, enabled: true }] },
      { overwrite: true, recordReceipt: false },
    );

    expect(harness.BackupScheduler.recordReceipt).not.toHaveBeenCalled();
  });
});

describe('importFromZip overwrite snapshotting', () => {
  it('pushes prior version into versionHistory and records a receipt', async () => {
    const existing = makeScript('script_alpha', 'Alpha v1', { version: '1.0.0' });
    const harness = createHarness([existing]);
    const newCode = [
      '// ==UserScript==',
      '// @name Alpha v2',
      '// @namespace scriptvault/alpha',
      '// @version 2.0.0',
      '// @match https://example.com/*',
      '// ==/UserScript==',
      'console.log("v2");',
    ].join('\n');
    const zipBytes = harness.fakeFflate.zipSync({
      'Alpha.user.js': harness.fakeFflate.strToU8(newCode),
      'Alpha.options.json': harness.fakeFflate.strToU8(JSON.stringify({
        scriptId: 'script_alpha',
        settings: { enabled: true },
      })),
    });

    const result = await harness.importFromZip(bytesToBase64(zipBytes), { overwrite: true, sourceLabel: 'ZIP: imported.zip' });

    expect(result).toMatchObject({ imported: 1, skipped: 0 });
    expect(result.replacedScripts).toEqual([{ id: 'script_alpha', name: 'Alpha v1', priorVersion: '1.0.0' }]);
    const stored = harness.scriptCache.get('script_alpha');
    expect(stored.versionHistory).toHaveLength(1);
    expect(stored.versionHistory[0]).toMatchObject({ version: '1.0.0', source: 'import', sourceLabel: 'ZIP: imported.zip' });
    expect(harness.BackupScheduler.recordReceipt).toHaveBeenCalledTimes(1);
    const [receiptArg] = harness.BackupScheduler.recordReceipt.mock.calls[0];
    expect(receiptArg.result).toMatchObject({
      quarantinedScripts: 1,
      preservedDisabledScripts: 0,
      trustedEnabledScripts: 0,
    });
    expect(typeof result.receiptId).toBe('string');
  });

  it('honours recordReceipt:false to suppress the import receipt', async () => {
    const existing = makeScript('script_alpha', 'Alpha v1', { version: '1.0.0' });
    const harness = createHarness([existing]);
    const newCode = [
      '// ==UserScript==',
      '// @name Alpha v2',
      '// @namespace scriptvault/alpha',
      '// @version 2.0.0',
      '// @match https://example.com/*',
      '// ==/UserScript==',
      'console.log("v2");',
    ].join('\n');
    const zipBytes = harness.fakeFflate.zipSync({
      'Alpha.user.js': harness.fakeFflate.strToU8(newCode),
      'Alpha.options.json': harness.fakeFflate.strToU8(JSON.stringify({
        scriptId: 'script_alpha',
        settings: { enabled: true },
      })),
    });

    await harness.importFromZip(bytesToBase64(zipBytes), { overwrite: true, recordReceipt: false });
    expect(harness.BackupScheduler.recordReceipt).not.toHaveBeenCalled();
  });
});
