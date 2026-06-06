import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

    expect(plan).toContain('monaco-editor@^0.52.0');
    expect(plan).toContain('Monaco 0.53.0 deprecated AMD support');
    expect(plan).toContain('Monaco 0.55.0');
    expect(plan).toContain('lib/monaco-esm/editor.js');
    expect(plan).toContain('lib/monaco-esm/workers/');
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

    expect(sandbox).toContain("../lib/monaco/vs");
    expect(sandbox).toContain("require(['vs/editor/editor.main']");
    expect(adapter).toContain('activateFallback');
    expect(adapter).toContain("e.source !== frame.contentWindow");
    expect(buildFirefox).not.toContain('lib/monaco');
  });
});
