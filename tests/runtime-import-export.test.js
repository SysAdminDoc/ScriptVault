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

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
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

function userscriptText(name = 'Bounded Script') {
  return [
    '// ==UserScript==',
    `// @name ${name}`,
    '// @namespace scriptvault/bounded',
    '// @version 1.0.0',
    '// @match https://example.com/*',
    '// ==/UserScript==',
    'console.log("bounded");',
  ].join('\n');
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
    enabled: false,
    position: 0,
    createdAt: 1,
    updatedAt: 2,
    meta: {
      name,
      namespace: `scriptvault/${id}`,
      version: '1.0.0',
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

function createRuntimeHarness(existingScripts = [], storedValuesByScript = {}, settings = { enabled: true }) {
  const fakeFflate = makeFakeFflate();
  let generatedIdCounter = 1;
  const scriptCache = new Map(existingScripts.map(script => [script.id, structuredClone(script)]));
  const valueCache = new Map(
    Object.entries(storedValuesByScript).map(([id, values]) => [id, structuredClone(values)]),
  );

  const ScriptStorage = {
    getAll: vi.fn(async () => Array.from(scriptCache.values()).map(script => structuredClone(script))),
    get: vi.fn(async id => structuredClone(scriptCache.get(id) || null)),
    set: vi.fn(async (id, script) => {
      scriptCache.set(id, structuredClone(script));
      return script;
    }),
  };
  const ScriptValues = {
    getAll: vi.fn(async id => structuredClone(valueCache.get(id) || {})),
    setAll: vi.fn(async (id, values) => {
      valueCache.set(id, structuredClone(values));
    }),
  };
  const SettingsManager = {
    get: vi.fn(async () => structuredClone(settings)),
    set: vi.fn(),
  };
  const registerAllScripts = vi.fn().mockResolvedValue();
  const updateBadge = vi.fn().mockResolvedValue();
  const generateId = vi.fn(() => `generated_script_${generatedIdCounter++}`);

  const _body = `${extractRuntimeImportExportCode()}; return { exportAllScripts, exportToZip, importFromZip, importScripts };`;
  let fn;
  try { const vm = require('node:vm'); fn = vm.compileFunction(_body, ['fflate', 'ScriptStorage', 'ScriptValues', 'SettingsManager', 'registerAllScripts', 'updateBadge', 'generateId'], { filename: resolve(process.cwd(), 'background.core.js') }); } catch { fn = new Function('fflate', 'ScriptStorage', 'ScriptValues', 'SettingsManager', 'registerAllScripts', 'updateBadge', 'generateId', _body); }

  return {
    ...fn(fakeFflate, ScriptStorage, ScriptValues, SettingsManager, registerAllScripts, updateBadge, generateId),
    fakeFflate,
    generateId,
    ScriptStorage,
    ScriptValues,
    SettingsManager,
    scriptCache,
    valueCache,
  };
}

describe('runtime import/export archive identity', () => {
  it('redacts credential-bearing settings from JSON exports unless explicitly included', async () => {
    const script = makeScript('script_exported', 'Exported Script');
    const harness = createRuntimeHarness(
      [script],
      {},
      {
        enabled: true,
        theme: 'dark',
        webdavPassword: 'secret',
        googleDriveToken: 'oauth-access',
        s3SecretKey: 's3-secret',
      },
    );

    const redacted = await harness.exportAllScripts({ includeSettings: true });
    expect(redacted.settings).toMatchObject({ enabled: true, theme: 'dark' });
    expect(redacted.settings).not.toHaveProperty('webdavPassword');
    expect(redacted.settings).not.toHaveProperty('googleDriveToken');
    expect(redacted.settings).not.toHaveProperty('s3SecretKey');
    expect(redacted.settingsCredentialsIncluded).toBe(false);
    expect(redacted.redactedSettingsCredentialKeys).toEqual(
      expect.arrayContaining(['webdavPassword', 'googleDriveToken', 's3SecretKey']),
    );

    const included = await harness.exportAllScripts({
      includeSettings: true,
      includeSettingsCredentials: true,
    });
    expect(included.settingsCredentialsIncluded).toBe(true);
    expect(included.settings).toMatchObject({
      webdavPassword: 'secret',
      googleDriveToken: 'oauth-access',
      s3SecretKey: 's3-secret',
    });
  });

  it('redacts future local workspace binding metadata from script settings exports', async () => {
    const script = makeScript('script_local_workspace', 'Local Workspace Script');
    script.settings = {
      notes: 'portable note',
      localWorkspaceBindingId: 'binding-secret',
      localWorkspace: { displayName: 'local.user.js', handle: { name: 'local.user.js' } },
      localFilePath: 'C:\\Users\\--\\secret\\local.user.js',
      absolutePath: 'C:\\Users\\--\\secret\\local.user.js',
    };
    const harness = createRuntimeHarness([script]);

    const exported = await harness.exportAllScripts({ includeSettings: true });

    expect(exported.scripts[0].settings).toEqual({ notes: 'portable note' });
    expect(exported.scripts[0].redactedLocalWorkspaceSettingKeys).toEqual(expect.arrayContaining([
      'localWorkspaceBindingId',
      'localWorkspace',
      'localFilePath',
      'absolutePath',
    ]));
    expect(JSON.stringify(exported)).not.toContain('binding-secret');
    expect(JSON.stringify(exported)).not.toContain('secret\\\\local.user.js');
    expect(JSON.stringify(exported)).not.toContain('handle');
  });

  it('restores JSON settings credentials only when archive metadata and import option both opt in', async () => {
    const harness = createRuntimeHarness();
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

  it('writes stable script IDs into runtime ZIP metadata', async () => {
    const script = makeScript('script_exported', 'Exported Script');
    const harness = createRuntimeHarness([script], { script_exported: { draft: true } });

    const exported = await harness.exportToZip();
    const files = harness.fakeFflate.unzipSync(base64ToBytes(exported.zipData));
    const options = JSON.parse(harness.fakeFflate.strFromU8(files['Exported Script.options.json']));

    expect(options.scriptId).toBe('script_exported');
    expect(options.scriptVault).toEqual({
      schemaVersion: 1,
      createdAt: 1,
      updatedAt: 2,
      position: 0,
    });
  });

  it('preserves ScriptVault ZIP script IDs when no existing script owns the name', async () => {
    const harness = createRuntimeHarness();
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
        settings: { enabled: false },
        scriptVault: {
          schemaVersion: 1,
          createdAt: 1700000000000,
          updatedAt: 1700000004321,
          position: 7,
        },
      })),
      'Preserved.storage.json': harness.fakeFflate.strToU8(JSON.stringify({ data: { draft: true } })),
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
    expect(harness.generateId).not.toHaveBeenCalled();
  });

  it('quarantines archive-enabled ZIP imports while preserving ScriptVault IDs', async () => {
    const existing = makeScript('script_preserved', 'Renamed Local Script');
    const harness = createRuntimeHarness([existing]);
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

    expect(result).toMatchObject({ imported: 1, skipped: 0, quarantinedScripts: 1 });
    expect(harness.ScriptStorage.set).toHaveBeenCalledWith(
      'script_preserved',
      expect.objectContaining({
        id: 'script_preserved',
        enabled: false,
        meta: expect.objectContaining({ name: 'Preserved Script' }),
        settings: expect.objectContaining({
          _importQuarantine: expect.objectContaining({
            source: 'import-zip',
          }),
        }),
      }),
    );
    expect(harness.generateId).not.toHaveBeenCalled();
  });

  it('preserves archive-enabled ZIP imports only with a trusted override', async () => {
    const existing = makeScript('script_preserved', 'Renamed Local Script');
    const harness = createRuntimeHarness([existing]);
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

    const result = await harness.importFromZip(bytesToBase64(zipBytes), {
      overwrite: true,
      trustImportedScripts: true,
    });

    expect(result).toMatchObject({ imported: 1, skipped: 0, trustedEnabledScripts: 1 });
    expect(harness.ScriptStorage.set).toHaveBeenCalledWith(
      'script_preserved',
      expect.objectContaining({
        id: 'script_preserved',
        enabled: true,
        meta: expect.objectContaining({ name: 'Preserved Script' }),
      }),
    );
  });

  it('generates safe IDs for unsafe JSON import script IDs', async () => {
    const harness = createRuntimeHarness();

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
    expect(harness.generateId).toHaveBeenCalledTimes(1);
  });

  it('rejects oversized JSON imports before storage or parser work', async () => {
    const harness = createRuntimeHarness();

    const result = await harness.importScripts({
      scripts: [{
        id: 'script_too_large',
        code: 'x'.repeat(5 * 1024 * 1024 + 1),
      }],
    }, { overwrite: true });

    expect(result.error).toMatch(/too large/);
    expect(harness.ScriptStorage.getAll).not.toHaveBeenCalled();
  });

  it('rejects unsafe ZIP intake before importing scripts', async () => {
    const cases = [
      {
        name: 'nested archive',
        entries: {
          'payload.zip': textEntry('nested'),
        },
        error: /nested archive entry payload\.zip/,
      },
      {
        name: 'excessive file count',
        entries: Object.fromEntries(
          Array.from({ length: 301 }, (_, index) => [`file-${index}.txt`, textEntry('x')]),
        ),
        error: /too many files/,
      },
      {
        name: 'oversized script',
        entries: {
          'Huge.user.js': textEntry(userscriptText('Huge'), {
            size: 1024,
            originalSize: 5 * 1024 * 1024 + 1,
          }),
        },
        error: /Huge\.user\.js is too large/,
      },
      {
        name: 'high expansion ratio',
        entries: {
          'Compressed.user.js': textEntry(userscriptText('Compressed'), {
            size: 1,
            originalSize: 1024,
          }),
        },
        error: /compression ratio is too high/,
      },
    ];

    for (const testCase of cases) {
      const harness = createRuntimeHarness();
      const result = await harness.importFromZip(bytesToBase64(fakeZipBytes(testCase.entries)), {
        overwrite: true,
      });

      expect(result.error, testCase.name).toMatch(testCase.error);
      expect(harness.ScriptStorage.set, testCase.name).not.toHaveBeenCalled();
    }
  });
});
