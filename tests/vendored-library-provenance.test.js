import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();

describe('Firefox vendored library provenance', () => {
  it('keeps packaged minified library inventory and bytes reproducible', () => {
    const output = execFileSync(process.execPath, ['scripts/check-vendored-library-provenance.mjs', '--check'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    expect(output).toContain('Vendored library provenance verified for 2 Firefox package libraries.');
  });

  it('documents each Firefox packaged minified library for AMO reviewers', () => {
    const docs = readFileSync(resolve(ROOT, 'docs/amo-vendored-libraries.md'), 'utf8');

    expect(docs).toContain('lib/acorn.min.js');
    expect(docs).toContain('acorn@8.17.0');
    expect(docs).toContain('lib/diff.min.js');
    expect(docs).toContain('diff@9.0.0');
    expect(docs).toContain('npm run vendored:provenance:check');
    expect(docs).toContain('npm ci');
  });
});
