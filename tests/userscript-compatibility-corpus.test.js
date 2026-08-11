import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const CORPUS_ROOT = resolve(process.cwd(), 'tests/fixtures/userscript-compatibility');
const manifest = JSON.parse(readFileSync(resolve(CORPUS_ROOT, 'manifest.json'), 'utf8'));

function fixtureSource(fixture) {
  return readFileSync(resolve(CORPUS_ROOT, fixture.path), 'utf8');
}

function sha256(source) {
  return createHash('sha256').update(source).digest('hex');
}

describe('userscript compatibility corpus', () => {
  it('keeps a pinned, local-only fixture manifest', () => {
    expect(manifest.schema).toBe('scriptvault/userscript-compatibility/v1');
    expect(manifest.policy).toMatchObject({
      target: 'local-only',
      network: 'no live network calls',
    });
    expect(manifest.fixtures.length).toBeGreaterThanOrEqual(3);

    const ids = new Set();
    for (const fixture of manifest.fixtures) {
      expect(ids.has(fixture.id)).toBe(false);
      ids.add(fixture.id);
      expect(existsSync(resolve(CORPUS_ROOT, fixture.path))).toBe(true);
      expect(fixture.sourceUrl).toMatch(/^https:\/\/github\.com\//);
      expect(fixture.sourceCommit).toMatch(/^[a-f0-9]{40}$/);
      expect(fixture.license).toMatch(/^(MIT|GPL-3\.0-only)$/);
      expect(fixture.licenseUrl).toContain(fixture.sourceCommit);
      expect(fixture.adaptation).toBeTruthy();
      expect(fixture.sha256).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  for (const fixture of manifest.fixtures) {
    it(`${fixture.id} remains a deterministic local fixture`, () => {
      const source = fixtureSource(fixture);
      const executableSource = source.split(/\r?\n/)
        .filter(line => !line.trim().startsWith('//'))
        .join('\n');
      expect(sha256(source)).toBe(fixture.sha256);
      expect(source).toMatch(/@match\s+http:\/\/127\.0\.0\.1\/compat\//);
      expect(source).not.toMatch(/^\/\/\s*@(?:require|connect|resource)\b/m);
      expect(source).not.toMatch(/\b(?:fetch|XMLHttpRequest|GM_xmlhttpRequest|xmlHttpRequest)\s*\(/);
      expect(executableSource).not.toMatch(/https?:\/\//);
      expect(source).toContain('@license');

      for (const api of fixture.expectedApiCalls) {
        expect(source, `${fixture.id} should exercise ${api}`).toContain(api);
      }
    });
  }

  it('includes the Vite Plugin Monkey v8 Worker shape', () => {
    const fixture = manifest.fixtures.find(item => item.id === 'vite-monkey-worker');
    const source = fixtureSource(fixture);
    expect(fixture.sourceUrl).toContain('/releases/tag/v8.1.0');
    expect(source).toMatch(/new\s+Worker\s*\(/);
    expect(source).toMatch(/new\s+Blob\s*\(/);
    expect(source).toMatch(/URL\.createObjectURL\s*\(/);
    expect(source).toContain('vite-plugin-monkey-v8');
  });
});
