import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as acorn from 'acorn';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

function read(path) {
  return readFileSync(resolve(ROOT, path), 'utf8');
}

describe('Monaco ESM migration plan', () => {
  it('pins the current AMD state and target ESM bundle shape', () => {
    const plan = read('docs/monaco-esm-migration-plan.md');

    for (const heading of [
      '## Decision',
      '## Current State',
      '## Source Findings',
      '## Target Architecture',
      '## CSP and Sandbox Requirements',
      '## Firefox and AMO',
      '## Validation Plan',
      '## Implementation Sequence',
      '## Non-Goals',
    ]) {
      expect(plan).toContain(heading);
    }

    expect(plan).toContain('monaco-editor@^0.55.1');
    expect(plan).toContain('Monaco 0.53.0 deprecated AMD support');
    expect(plan).toContain('Monaco 0.55.1');
    expect(plan).toContain('lib/monaco-esm/editor.js');
    expect(plan).toContain('lib/monaco-esm/workers/');
  });

  it('pins the Monaco 0.55 namespace contract used by the sandbox', () => {
    const packageJson = JSON.parse(read('package.json'));
    const packageLock = JSON.parse(read('package-lock.json'));
    const editorTypes = read('node_modules/monaco-editor/esm/vs/editor/editor.main.d.ts');
    const apiTypes = read('node_modules/monaco-editor/esm/vs/editor/editor.api.d.ts');
    const sandbox = read('pages/editor-sandbox.html');

    expect(packageJson.devDependencies['monaco-editor']).toBe('^0.55.1');
    expect(packageLock.packages['node_modules/monaco-editor'].version).toBe('0.55.1');
    expect(packageJson.overrides.dompurify).toBe('3.4.11');
    expect(editorTypes).toContain('as lsp');
    expect(editorTypes).toContain('as typescript');
    expect(apiTypes).toContain('EditorAutoClosingEditStrategy');
    expect(apiTypes).not.toContain('EditorAutoClosingOvertypeStrategy');
    expect(sandbox).toContain('monaco.typescript?.javascriptDefaults');
    expect(sandbox).not.toContain('monaco.languages.typescript');
  });

  it('keeps extension packaging constraints explicit', () => {
    const plan = read('docs/monaco-esm-migration-plan.md');

    expect(plan).toContain('Do not load Monaco from a CDN');
    expect(plan).toContain('no remote URLs');
    expect(plan).toContain("Keep `extension_pages` CSP at `script-src 'self'`");
    expect(plan).toContain('Firefox remains textarea-first');
    expect(plan).toContain('AMO-SOURCE-README.md');
    expect(plan).toContain('`npm run cws:remote-code:check`');
  });

  it('matches the current sandbox and Firefox fallback implementation', () => {
    const sandbox = read('pages/editor-sandbox.html');
    const adapter = read('pages/monaco-adapter.js');
    const buildFirefox = read('build-firefox.sh');

    expect(sandbox).toContain("../lib/monaco-esm/editor.js");
    expect(sandbox).toContain("../lib/monaco-esm/editor.css");
    expect(sandbox).toContain('await import(LOCAL_ESM_ENTRY)');
    expect(sandbox).not.toContain('vs/loader.js');
    expect(sandbox).not.toContain('require.config');
    expect(adapter).toContain('activateFallback');
    expect(adapter).toContain("e.source !== frame.contentWindow");
    expect(buildFirefox).not.toContain('lib/monaco');
    expect(buildFirefox).not.toContain('lib/monaco-esm');
  });

  it('keeps the sandbox loader script syntactically valid', () => {
    const sandbox = read('pages/editor-sandbox.html');
    const match = sandbox.match(/<script>([\s\S]*)<\/script>/);
    expect(match).toBeTruthy();
    acorn.parse(match[1], { ecmaVersion: 'latest', sourceType: 'script' });
  });
});
