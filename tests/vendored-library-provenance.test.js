import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateInventoryDocument } from '../scripts/check-vendored-library-provenance.mjs';

const ROOT = process.cwd();

describe('Firefox vendored library provenance', () => {
  it('keeps packaged minified library inventory and bytes reproducible', () => {
    const output = execFileSync(process.execPath, ['scripts/check-vendored-library-provenance.mjs', '--check'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    expect(output).toContain('Vendored library provenance verified for 23 shipped provenance entries.');
  });

  it('documents each Firefox packaged minified library for AMO reviewers', () => {
    const docs = readFileSync(resolve(ROOT, 'docs/amo-vendored-libraries.md'), 'utf8');

    expect(docs).toContain('lib/acorn.min.js');
    expect(docs).toContain('acorn@8.17.0');
    expect(docs).toContain('lib/diff.min.js');
    expect(docs).toContain('diff@9.0.0');
    expect(docs).toContain('lib/monaco-esm/editor.js');
    expect(docs).toContain('monaco-editor@0.56.0');
    expect(docs).toContain('dompurify@3.4.13');
    expect(docs).toContain('lib/fflate.js');
    expect(docs).toContain('lib/codemirror/codemirror.min.js');
    expect(docs).toContain('codemirror@5.65.15');
    expect(docs).toContain('npm run vendored:provenance:check');
    expect(docs).toContain('npm ci');
  });

  it('fails the inventory comparison when a shipped row is removed', () => {
    const docs = readFileSync(resolve(ROOT, 'docs/amo-vendored-libraries.md'), 'utf8');
    const withoutMonacoRow = docs.replace(
      /\| `lib\/monaco-esm\/editor\.js` \|[^\n]*\n/,
      '',
    );
    expect(withoutMonacoRow).not.toBe(docs);
    expect(validateInventoryDocument(docs, withoutMonacoRow)).toEqual([
      'docs/amo-vendored-libraries.md is not current; run npm run vendored:provenance',
    ]);
  });
});
