import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  runCwsRemoteCodeCheck,
  scanRemoteCodeEntries,
} from '../scripts/check-cws-remote-code.mjs';

const ROOT = process.cwd();

function ruleIdsFor(text, path = 'pages/example.html') {
  return scanRemoteCodeEntries([{ path, text }]).failures.map((failure) => failure.ruleId);
}

describe('CWS remote-code scanner', () => {
  it('flags remote script tags', () => {
    const rules = ruleIdsFor('<script src="https://cdn.example.com/widget.js"></script>');
    expect(rules).toContain('remote-script-tag');
  });

  it('flags remote workers and importScripts', () => {
    const rules = ruleIdsFor(`
      new Worker("https://cdn.example.com/worker.js");
      importScripts("https://cdn.example.com/runtime.js");
    `, 'background.js');
    expect(rules).toContain('remote-worker');
    expect(rules).toContain('remote-importscripts');
  });

  it('flags dynamic imports from remote URLs', () => {
    const rules = ruleIdsFor('await import("https://cdn.example.com/module.js");', 'pages/popup.js');
    expect(rules).toContain('remote-dynamic-import');
  });

  it('flags fetched strings executed through eval or new Function', () => {
    const rules = ruleIdsFor(`
      eval(await (await fetch("https://cdn.example.com/a.js")).text());
      new Function(await (await fetch("https://cdn.example.com/b.js")).text())();
    `, 'pages/install.js');
    expect(rules.filter((rule) => rule === 'fetched-eval')).toHaveLength(2);
  });

  it('allows documented userScripts code registration paths', () => {
    const result = scanRemoteCodeEntries([{
      path: 'src/background/registration.ts',
      text: `
        chrome.userScripts.register([{
          id: "allowed",
          matches: ["https://example.com/*"],
          js: [{ code: wrappedCode }],
          world: "USER_SCRIPT"
        }]);
      `,
    }]);
    expect(result.failures).toEqual([]);
  });

  it('keeps the sandboxed editor page on the documented allowlist', () => {
    const result = scanRemoteCodeEntries([{
      path: 'pages/editor-sandbox.html',
      text: '<script src="https://cdn.example.com/editor-loader.js"></script>',
    }]);
    expect(result.failures).toEqual([]);
  });

  it('passes against the live source package inputs and documentation gates', () => {
    const result = runCwsRemoteCodeCheck({ projectRoot: ROOT });
    expect(result.failures).toEqual([]);
    expect(result.scannedCount).toBeGreaterThan(20);
  });

  it('wires package and CI commands', () => {
    const packageJson = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
    const ci = readFileSync(resolve(ROOT, '.github/workflows/ci.yml'), 'utf8');
    expect(packageJson.scripts['cws:remote-code:check']).toBe('node scripts/check-cws-remote-code.mjs');
    expect(ci).toContain('npm run cws:remote-code:check');
    expect(ci).toContain('--target ScriptVault-v${{ steps.package.outputs.version }}.zip');
  });
});
