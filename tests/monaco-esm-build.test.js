import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

function read(path) {
  return readFileSync(resolve(ROOT, path), 'utf8');
}

describe('Monaco ESM prototype build contract', () => {
  it('builds from a dedicated source entrypoint with file-backed worker URLs', () => {
    const entry = read('src/editor/monaco-esm-entry.ts');

    expect(entry).toContain("import * as monaco from 'monaco-editor';");
    expect(entry).toContain("DEFAULT_WORKER_FILE = 'workers/editor.worker.js'");
    for (const worker of [
      'workers/editor.worker.js',
      'workers/json.worker.js',
      'workers/css.worker.js',
      'workers/html.worker.js',
      'workers/ts.worker.js',
    ]) {
      expect(entry).toContain(worker);
    }
    expect(entry).toContain('new URL(getMonacoWorkerFile(label), import.meta.url).toString()');
    expect(entry).not.toMatch(/\b(?:blob|data):/i);
    expect(entry).not.toMatch(/https?:\/\//i);
  });

  it('wires esbuild to emit local ESM editor, CSS/font assets, and deterministic workers', () => {
    const config = read('esbuild.config.mjs');

    expect(config).toContain('async function buildMonacoEsm()');
    expect(config).toContain('"lib", "monaco-esm"');
    expect(config).toContain('"src", "editor", "monaco-esm-entry.ts"');
    expect(config).toContain('outfile: join(monacoEsmOutDir, "editor.js")');
    expect(config).toContain('format: "esm"');
    expect(config).toContain('format: "iife"');
    expect(config).toContain('loader: { ".ttf": "file" }');
    expect(config).toContain('assetNames: "assets/[name]-[hash]"');
    for (const worker of [
      '"editor.worker":',
      '"json.worker":',
      '"css.worker":',
      '"html.worker":',
      '"ts.worker":',
    ]) {
      expect(config).toContain(worker);
    }
    expect(config).toContain('args.includes("--monaco-esm-only")');
    expect(config).toContain('await buildMonacoEsm();');
    expect(config).not.toContain('"node_modules", "monaco-editor", "min"');
    expect(config).not.toContain('cpSync(src, dest');
  });

  it('keeps generated ESM assets out of source control and Firefox packaging', () => {
    const gitignore = read('.gitignore');
    const buildFirefox = read('build-firefox.sh');

    expect(gitignore).toContain('lib/monaco-esm/');
    expect(buildFirefox).toContain('node "$SCRIPT_DIR/esbuild.config.mjs" --bg-only');
    expect(buildFirefox).not.toContain('lib/monaco-esm');
  });
});
