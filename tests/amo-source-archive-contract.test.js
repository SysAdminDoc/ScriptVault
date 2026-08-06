import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });

// Files the AMO source ZIP actually contains: `git archive HEAD`, i.e. tracked
// files minus anything marked export-ignore.
const trackedFiles = new Set(git('ls-files').split(/\r?\n/).map(l => l.trim()).filter(Boolean));

function isExportIgnored(path) {
  return / export-ignore: set$/.test(git('check-attr', 'export-ignore', '--', path).trim());
}
const shipsInSourceArchive = (path) => trackedFiles.has(path) && !isExportIgnored(path);

const buildFirefox = readFileSync(resolve(ROOT, 'build-firefox.sh'), 'utf8');

// AMO builds submitted extensions from source and compares the result, so the
// source ZIP has to be buildable on its own. It was not: build-firefox.sh runs
// check-vendored-library-provenance.mjs, which hard-fails without
// docs/amo-vendored-libraries.md — and that file was caught by the blanket
// `*.md` gitignore, so it was untracked and absent from the archive. The build
// only worked on a machine that already had the untracked file lying around.
// Verified by extracting the v3.24.0 source ZIP into a clean Linux environment:
// npm ci succeeded, then build-firefox.sh stopped at the provenance gate.
describe('AMO source archive contract', () => {
  it('ships the provenance doc that the Firefox build reads', () => {
    expect(buildFirefox).toContain('check-vendored-library-provenance.mjs');
    expect(
      shipsInSourceArchive('docs/amo-vendored-libraries.md'),
      'docs/amo-vendored-libraries.md must be tracked and not export-ignored, or a reviewer cannot build the submitted source',
    ).toBe(true);
  });

  it('ships every non-generated file the Firefox build script reads by path', () => {
    // Paths build-firefox.sh hands to node/bash directly. A missing one fails
    // the reviewer's build the same way the provenance doc did.
    const required = [
      'build-firefox.sh',
      'esbuild.config.mjs',
      'package.json',
      'package-lock.json',
      'manifest.json',
      'manifest-firefox.json',
      'manifest-firefox.transformations.json',
      'scripts/generate-manifest-firefox.mjs',
      'scripts/check-vendored-library-provenance.mjs',
      'scripts/check-firefox-lint-warnings.mjs',
      'AMO-SOURCE-README.md',
    ];
    const missing = required.filter(path => !shipsInSourceArchive(path));
    expect(missing, `these are build inputs but would not reach an AMO reviewer: ${missing.join(', ')}`).toEqual([]);
  });

  it('keeps internal planning and research notes out of the reviewer archive', () => {
    // .gitattributes already excluded ROADMAP.md and the older research files;
    // plain RESEARCH.md was missed and shipped competitive analysis to AMO.
    for (const path of ['RESEARCH.md', 'ROADMAP.md', 'FIREFOX-PORT.md']) {
      if (!trackedFiles.has(path)) continue; // untracked never ships
      expect(isExportIgnored(path), `${path} must be export-ignored`).toBe(true);
    }
  });

  it('still ships the documents a reviewer is meant to read', () => {
    for (const path of ['README.md', 'SECURITY.md', 'AMO-SOURCE-README.md', 'PRIVACY.md']) {
      if (!trackedFiles.has(path)) continue;
      expect(isExportIgnored(path), `${path} should reach reviewers`).toBe(false);
    }
  });
});
