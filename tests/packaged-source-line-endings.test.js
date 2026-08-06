import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

// Text files that get copied verbatim into the Chrome and Firefox packages.
// Anything built (background.js, lib/monaco-esm/**) is regenerated per build and
// is not a working-tree concern.
const PACKAGED_TEXT_GLOBS = [
  'pages/**/*.js',
  'pages/**/*.html',
  'pages/**/*.css',
  'modules/*.js',
  'shared/*.js',
  'bg/*.js',
  '_locales/**/*.json',
  'content.js',
  'offscreen.js',
  'offscreen.html',
  'manifest.json',
  'manifest-firefox.json',
  'managed-storage-schema.json',
];

function packagedFiles() {
  const out = execFileSync('git', ['ls-files', '--', ...PACKAGED_TEXT_GLOBS], { cwd: ROOT, encoding: 'utf8' });
  return out.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
}

// A CRLF working-tree copy of a packaged file makes the build machine-dependent:
// build.sh and build-firefox.sh copy the working tree, while an AMO reviewer
// builds from `git archive`, which emits the index's LF. pages/install.html and
// pages/dashboard-standalone.js were mixed-CRLF and produced different bytes on
// Windows and Linux from identical sources.
//
// Git cannot show this: .gitattributes sets `* text=auto eol=lf`, so the index
// is already LF and `git diff` is clean while the working file is CRLF. It is
// only visible through `git ls-files --eol`, which is what this reads.
describe('packaged source line endings', () => {
  const files = packagedFiles();

  it('finds packaged text files to check', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('has no CRLF in any packaged text file', () => {
    const offenders = files.filter((file) => readFileSync(resolve(ROOT, file)).includes('\r\n'));
    expect(
      offenders,
      `these ship with CRLF, so a Windows build and an AMO reviewer's rebuild from `
      + `\`git archive\` produce different bytes: ${offenders.join(', ')}`,
    ).toEqual([]);
  });

  it('keeps the repo-wide LF policy that makes the index authoritative', () => {
    const attrs = readFileSync(resolve(ROOT, '.gitattributes'), 'utf8');
    expect(attrs).toContain('* text=auto eol=lf');
  });
});
