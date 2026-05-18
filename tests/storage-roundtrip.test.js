// Phase 39.24 — Script body round-trip integrity test.
//
// VM #2363 (Orion/WebKit): script bodies containing ASCII quotes (") were
// silently encoded as curly quotes (") during storage round-trip, corrupting
// scripts. This test pins the invariant that ScriptStorage write→read
// preserves every byte of the script body, including ASCII quotes, curly
// quotes, backticks, CRLF line endings, and zero-width characters.
//
// The fake-indexeddb backend doesn't reproduce Orion's bug, but the test
// catches the regression class if ScriptVault ever introduces its own
// quote-mangling path (e.g., overly-eager Unicode normalization, JSON-Schema
// validation that rewrites strings, etc.).
//
// Source: https://github.com/violentmonkey/violentmonkey/issues/2363

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const storageCode = readFileSync(resolve(__dirname, '../modules/storage.js'), 'utf8');
const settingsDefaults = JSON.parse(
  readFileSync(resolve(__dirname, '../src/config/settings-defaults.json'), 'utf8')
);

const preamble = `
  const SCRIPTVAULT_SETTINGS_DEFAULTS = ${JSON.stringify(settingsDefaults)};
  function generateId() { return 'id_' + Math.random().toString(36).slice(2, 10); }
  function debugLog() {}
`;
const fn = new Function('chrome', 'console', preamble + storageCode + `
  return { SettingsManager, ScriptStorage };
`);
const { SettingsManager, ScriptStorage } = fn(globalThis.chrome, console);

beforeEach(() => {
  globalThis.__resetStorageMock();
  SettingsManager.cache = null;
  ScriptStorage.cache = null;
  vi.clearAllMocks();
});

function makeScript(id, code) {
  return {
    id,
    enabled: true,
    code,
    meta: { name: `Test ${id}`, namespace: 'test', version: '1.0.0', match: ['*://*/*'] },
  };
}

describe('ScriptStorage round-trip integrity (Phase 39.24)', () => {
  it('preserves ASCII single and double quotes byte-for-byte', async () => {
    const code = `const a = 'single'; const b = "double"; const c = "mixed 'inner' outer";`;
    await ScriptStorage.set('id1', makeScript('id1', code));
    ScriptStorage.cache = null;
    const round = await ScriptStorage.get('id1');
    expect(round.code).toBe(code);
  });

  it('preserves curly quotes if author intentionally used them', async () => {
    // The bug class is *automatic* conversion. If an author writes curly quotes
    // intentionally (e.g., in a string literal that needs them), they must survive.
    const code = `const greeting = "smart “quotes” and ‘apostrophes’";`;
    await ScriptStorage.set('id2', makeScript('id2', code));
    ScriptStorage.cache = null;
    const round = await ScriptStorage.get('id2');
    expect(round.code).toBe(code);
    // Belt-and-braces: bytes don't sneakily convert curly → ASCII either.
    expect(round.code).toContain('“');
    expect(round.code).toContain('’');
  });

  it('preserves CRLF and LF line endings', async () => {
    const codeCRLF = `// line1\r\n// line2\r\nconst x = 1;\r\n`;
    const codeLF = `// line1\n// line2\nconst x = 1;\n`;
    await ScriptStorage.set('crlf', makeScript('crlf', codeCRLF));
    await ScriptStorage.set('lf', makeScript('lf', codeLF));
    ScriptStorage.cache = null;
    expect((await ScriptStorage.get('crlf')).code).toBe(codeCRLF);
    expect((await ScriptStorage.get('lf')).code).toBe(codeLF);
  });

  it('preserves backticks and template literal syntax', async () => {
    const code = 'const t = `hello ${name}`; const u = `nested ${`inner ${x}`}`;';
    await ScriptStorage.set('tpl', makeScript('tpl', code));
    ScriptStorage.cache = null;
    expect((await ScriptStorage.get('tpl')).code).toBe(code);
  });

  it('preserves zero-width and special Unicode characters', async () => {
    // ZWJ, ZWNJ, BOM, RLO — all things an attacker (or i18n string) might use.
    const code = 'const x = "a‍b‌c﻿d‮e";';
    await ScriptStorage.set('uni', makeScript('uni', code));
    ScriptStorage.cache = null;
    expect((await ScriptStorage.get('uni')).code).toBe(code);
  });

  it('idempotent across set → get → set → get (no mutation on second write)', async () => {
    const code = readFileSync(__filename, 'utf8'); // any nontrivial source

    await ScriptStorage.set('idem', makeScript('idem', code));
    ScriptStorage.cache = null;
    const r1 = await ScriptStorage.get('idem');
    expect(r1.code).toBe(code);

    // Write the read-back object verbatim — must round-trip again unchanged.
    await ScriptStorage.set('idem', r1);
    ScriptStorage.cache = null;
    const r2 = await ScriptStorage.get('idem');
    expect(r2.code).toBe(code);
  });
});
