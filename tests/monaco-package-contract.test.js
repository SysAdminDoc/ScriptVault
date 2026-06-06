import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  checkMonacoPackageContract,
  runMonacoPackageContractCheck,
} from '../scripts/check-monaco-package-contract.mjs';

const ROOT = process.cwd();
const FILES = [
  'package.json',
  'esbuild.config.mjs',
  'build-firefox.sh',
  'pages/editor-sandbox.html',
  'docs/monaco-esm-migration-plan.md',
];

function read(path) {
  return readFileSync(resolve(ROOT, path), 'utf8');
}

function liveFiles() {
  return Object.fromEntries(FILES.map((path) => [path, read(path)]));
}

function messagesFor(files) {
  return checkMonacoPackageContract(files).failures.map((failure) => failure.message);
}

describe('Monaco package contract check', () => {
  it('passes against the live source package contract', () => {
    const result = runMonacoPackageContractCheck({ projectRoot: ROOT });
    expect(result.failures).toEqual([]);
    expect(result.checkedFiles).toBe(FILES.length);
  });

  it('keeps the contract wired into npm run check', () => {
    const packageJson = JSON.parse(read('package.json'));
    expect(packageJson.scripts['monaco:package:check']).toBe('node scripts/check-monaco-package-contract.mjs');
    expect(packageJson.scripts['build:monaco:esm']).toBe('node esbuild.config.mjs --monaco-esm-only');
    expect(packageJson.scripts['monaco:esm:check']).toBe('node scripts/check-monaco-esm-prototype.mjs');
    expect(packageJson.scripts.check).toContain('npm run monaco:package:check');
  });

  it('rejects remote Monaco or CDN assets in the sandbox page', () => {
    const files = liveFiles();
    files['pages/editor-sandbox.html'] = files['pages/editor-sandbox.html'].replace(
      "const LOCAL_VS_PATH = '../lib/monaco/vs';",
      "const LOCAL_VS_PATH = 'https://cdn.jsdelivr.net/npm/monaco-editor/min/vs';",
    );

    expect(messagesFor(files)).toContain('sandbox must not reference remote Monaco/CDN editor assets');
  });

  it('rejects accidental Firefox Monaco packaging', () => {
    const files = liveFiles();
    files['build-firefox.sh'] = files['build-firefox.sh'].replace('  pages', '  pages\n  lib/monaco');

    expect(messagesFor(files)).toContain('Firefox build must not package Monaco until AMO lint proof exists');
  });

  it('rejects missing Chromium local AMD copy wiring', () => {
    const files = liveFiles();
    files['esbuild.config.mjs'] = files['esbuild.config.mjs'].replace(
      '"node_modules", "monaco-editor", "min"',
      '"node_modules", "monaco-editor", "esm"',
    );

    expect(messagesFor(files)).toContain('Chromium build must keep the local Monaco AMD bundle and ESM prototype wiring');
  });
});
