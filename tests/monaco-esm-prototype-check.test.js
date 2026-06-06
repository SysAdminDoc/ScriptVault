import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runMonacoEsmPrototypeCheck } from '../scripts/check-monaco-esm-prototype.mjs';

const REQUIRED_OUTPUTS = [
  'lib/monaco-esm/editor.js',
  'lib/monaco-esm/editor.css',
  'lib/monaco-esm/assets/codicon-test.ttf',
  'lib/monaco-esm/workers/editor.worker.js',
  'lib/monaco-esm/workers/json.worker.js',
  'lib/monaco-esm/workers/css.worker.js',
  'lib/monaco-esm/workers/html.worker.js',
  'lib/monaco-esm/workers/ts.worker.js',
];

let tempRoots = [];

function makeTempRoot() {
  const root = mkdtempSync(join(tmpdir(), 'scriptvault-monaco-esm-'));
  tempRoots.push(root);
  return root;
}

function writeFixture(root, sizes = {}) {
  for (const path of REQUIRED_OUTPUTS) {
    const absolute = join(root, path);
    mkdirSync(dirname(absolute), { recursive: true });
    const size = sizes[path] || 128;
    writeFileSync(absolute, Buffer.alloc(size, 'a'));
  }
}

describe('Monaco ESM prototype checker', () => {
  afterEach(() => {
    for (const root of tempRoots) {
      rmSync(root, { recursive: true, force: true });
    }
    tempRoots = [];
  });

  it('reports output sizes and compressed totals for a complete prototype', () => {
    const root = makeTempRoot();
    writeFixture(root, {
      'lib/monaco-esm/editor.js': 1024,
      'lib/monaco-esm/workers/ts.worker.js': 2048,
    });

    const result = runMonacoEsmPrototypeCheck({ projectRoot: root });

    expect(result.failures).toEqual([]);
    expect(result.outputs).toHaveLength(8);
    expect(result.outputs.find((output) => output.path === 'lib/monaco-esm/editor.js')).toMatchObject({
      bytes: 1024,
    });
    expect(result.totals.totalBytes).toBeGreaterThan(0);
    expect(result.totals.totalGzipBytes).toBeGreaterThan(0);
  });

  it('fails when the selected full-worker budget is exceeded', () => {
    const root = makeTempRoot();
    writeFixture(root, {
      'lib/monaco-esm/editor.js': 256,
      'lib/monaco-esm/workers/ts.worker.js': 512,
    });

    const result = runMonacoEsmPrototypeCheck({
      projectRoot: root,
      sizeBudgets: {
        maxTotalBytes: 512,
        maxTotalGzipBytes: 32,
        maxFileBytes: {
          'lib/monaco-esm/workers/ts.worker.js': 128,
        },
      },
    });

    const messages = result.failures.map((failure) => failure.message);
    expect(messages.some((message) => message.startsWith('Monaco ESM prototype exceeds total uncompressed budget'))).toBe(true);
    expect(messages).toContain('Monaco ESM output exceeds file budget (512 > 128)');
  });
});
