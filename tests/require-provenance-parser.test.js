import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseUserscript } from '../src/background/parser.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');
const backgroundCoreTs = readFileSync(resolve(repoRoot, 'src/background/core.ts'), 'utf8');

function userscript(lines) {
  return [
    '// ==UserScript==',
    '// @name Require Provenance',
    ...lines,
    '// ==/UserScript==',
    'console.log("ok");',
  ].join('\n');
}

describe('@require-provenance metadata parser', () => {
  it('persists Sigstore bundle URLs and OIDC identities in declaration order', () => {
    const { meta } = parseUserscript(userscript([
      '// @require https://cdn.example.com/lib-a.js',
      '// @require-provenance https://cdn.example.com/lib-a.js.bundle',
      '// @require-identity https://github.com/exampleuser (issuer: https://github.com/login/oauth)',
      '// @require https://cdn.example.com/lib-b.js',
      '// @require-provenance https://cdn.example.com/lib-b.js.bundle',
      '// @require-identity https://accounts.google.com/example@example.com (issuer: https://accounts.google.com)',
    ]));

    expect(meta.require).toEqual([
      'https://cdn.example.com/lib-a.js',
      'https://cdn.example.com/lib-b.js',
    ]);
    expect(meta.requireProvenance).toEqual([
      'https://cdn.example.com/lib-a.js.bundle',
      'https://cdn.example.com/lib-b.js.bundle',
    ]);
    expect(meta.requireIdentity).toEqual([
      'https://github.com/exampleuser (issuer: https://github.com/login/oauth)',
      'https://accounts.google.com/example@example.com (issuer: https://accounts.google.com)',
    ]);
  });

  it('keeps provenance opt-in by defaulting both arrays to empty', () => {
    const { meta } = parseUserscript(userscript([
      '// @require https://cdn.example.com/lib.js',
    ]));

    expect(meta.require).toEqual(['https://cdn.example.com/lib.js']);
    expect(meta.requireProvenance).toEqual([]);
    expect(meta.requireIdentity).toEqual([]);
  });

  it('accepts comma-separated metadata lists for migration-friendly authoring', () => {
    const { meta } = parseUserscript(userscript([
      '// @require-provenance https://cdn.example.com/a.bundle, https://cdn.example.com/b.bundle',
      '// @require-identity https://github.com/a (issuer: https://github.com/login/oauth), https://github.com/b (issuer: https://github.com/login/oauth)',
    ]));

    expect(meta.requireProvenance).toEqual([
      'https://cdn.example.com/a.bundle',
      'https://cdn.example.com/b.bundle',
    ]);
    expect(meta.requireIdentity).toEqual([
      'https://github.com/a (issuer: https://github.com/login/oauth)',
      'https://github.com/b (issuer: https://github.com/login/oauth)',
    ]);
  });

  it('keeps the background-core bridge parser in sync with the TypeScript parser', () => {
    expect(backgroundCoreTs).toContain('requireProvenance: []');
    expect(backgroundCoreTs).toContain('requireIdentity: []');
    expect(backgroundCoreTs).toContain("case 'require-provenance':");
    expect(backgroundCoreTs).toContain("case 'require-identity':");
    expect(backgroundCoreTs).toContain("key === 'require-provenance' ? 'requireProvenance'");
    expect(backgroundCoreTs).toContain("key === 'require-identity' ? 'requireIdentity'");
  });
});
