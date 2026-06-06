import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const SOURCES = [
  ['core', 'src/background/core.ts'],
  ['wrapper', 'src/background/wrapper-builder.ts'],
];

const DIRECT_PROMISE_ALIASES = [
  'addElement',
  'focusTab',
  'head',
  'log',
  'getMenuCommands',
  'webRequest',
];

function readSource(path) {
  return readFileSync(resolve(ROOT, path), 'utf8');
}

describe('GM namespace parity', () => {
  it('keeps direct GM.* aliases wired in both wrapper sources', () => {
    for (const [label, path] of SOURCES) {
      const source = readSource(path);
      for (const alias of DIRECT_PROMISE_ALIASES) {
        expect(source, `${label} missing GM.${alias}`).toContain(`${alias}:`);
      }
      expect(source, `${label} missing singular GM.cookie alias`).toContain('cookie: {');
      expect(source, `${label} missing GM.audio getter`).toContain('get audio()');
    }
  });

  it('keeps GM.fetch deferred until the guarded network contract is implemented', () => {
    for (const [, path] of SOURCES) {
      const source = readSource(path);
      expect(source).not.toContain('GM_fetch');
      expect(source).not.toMatch(/\bfetch:\s*\(/);
    }

    const docs = readSource('docs/gm-namespace-parity.md');
    expect(docs).toContain('`GM.fetch` remains deferred');
    expect(docs).toContain('GM_xmlhttpRequest');
  });
});
