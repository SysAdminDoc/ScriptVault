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
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
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
  const importStart = backgroundCoreCode.indexOf('async function exportAllScripts');
  const importEnd = backgroundCoreCode.indexOf('// Message Handlers', importStart);

  if ([parserStart, parserEnd, importStart, importEnd].some(index => index === -1)) {
    throw new Error('Unable to extract runtime import/export code from background.core.js');
  }

  return `${backgroundCoreCode.slice(parserStart, parserEnd)}\n${backgroundCoreCode.slice(importStart, importEnd)}`;
}

function createRuntimeHarness(existingScripts = [], storedValuesByScript = {}) {
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
    get: vi.fn(async () => ({ enabled: true })),
    set: vi.fn(),
  };
  const registerAllScripts = vi.fn().mockResolvedValue();
  const updateBadge = vi.fn().mockResolvedValue();
  const generateId = vi.fn(() => `generated_script_${generatedIdCounter++}`);

  const fn = new Function(
    'fflate',
    'ScriptStorage',
    'ScriptValues',
    'SettingsManager',
    'registerAllScripts',
    'updateBadge',
    'generateId',
    `${extractRuntimeImportExportCode()}; return { exportToZip, importFromZip };`,
  );

  return {
    ...fn(fakeFflate, ScriptStorage, ScriptValues, SettingsManager, registerAllScripts, updateBadge, generateId),
    fakeFflate,
    generateId,
    ScriptStorage,
    ScriptValues,
    scriptCache,
    valueCache,
  };
}

describe('runtime import/export archive identity', () => {
  it('writes stable script IDs into runtime ZIP metadata', async () => {
    const script = makeScript('script_exported', 'Exported Script');
    const harness = createRuntimeHarness([script], { script_exported: { draft: true } });

    const exported = await harness.exportToZip();
    const files = harness.fakeFflate.unzipSync(base64ToBytes(exported.zipData));
    const options = JSON.parse(harness.fakeFflate.strFromU8(files['Exported Script.options.json']));

    expect(options.scriptId).toBe('script_exported');
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
      })),
      'Preserved.storage.json': harness.fakeFflate.strToU8(JSON.stringify({ data: { draft: true } })),
    });

    const result = await harness.importFromZip(bytesToBase64(zipBytes), { overwrite: true });

    expect(result).toMatchObject({ imported: 1, skipped: 0 });
    expect(harness.ScriptStorage.set).toHaveBeenCalledWith(
      'script_preserved',
      expect.objectContaining({ id: 'script_preserved', enabled: false }),
    );
    expect(harness.ScriptValues.setAll).toHaveBeenCalledWith('script_preserved', { draft: true });
    expect(harness.generateId).not.toHaveBeenCalled();
  });

  it('uses ScriptVault ZIP script IDs to restore existing scripts whose names changed', async () => {
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

    expect(result).toMatchObject({ imported: 1, skipped: 0 });
    expect(harness.ScriptStorage.set).toHaveBeenCalledWith(
      'script_preserved',
      expect.objectContaining({
        id: 'script_preserved',
        enabled: true,
        meta: expect.objectContaining({ name: 'Preserved Script' }),
      }),
    );
    expect(harness.generateId).not.toHaveBeenCalled();
  });
});
