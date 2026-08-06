import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDomainRoot } from '../src/shared/utils.ts';

// getDomainRoot reduces a hostname to the label the domain badge shows.
//
// A previous revision branched on `browser.publicSuffix.getDomain()` to get an
// accurate registrable label for multi-level TLDs. That namespace does not
// exist in any shipping Firefox — probed absent in 154.0b1 — so the branch was
// unreachable in production while this suite passed against a hand-written mock
// of the API. The mock proved only that the code worked IF the API existed, and
// a CHANGELOG entry claimed the fix was live. The branch is gone; these tests
// exercise the real, single implementation.
describe('getDomainRoot', () => {
  it('reduces a hostname to its registrable-ish label', () => {
    expect(getDomainRoot('example.com')).toBe('example');
    expect(getDomainRoot('www.example.com')).toBe('example');
    expect(getDomainRoot('news.api.example.com')).toBe('example');
    expect(getDomainRoot('localhost')).toBe('localhost');
  });

  it('handles empty and malformed input without throwing', () => {
    expect(getDomainRoot('')).toBe('');
    expect(getDomainRoot(undefined)).toBe('');
    expect(getDomainRoot(null)).toBe('');
    expect(getDomainRoot('.')).toBe('');
  });

  it('documents the multi-level-TLD limitation rather than pretending it is fixed', () => {
    // No browser exposes a public-suffix list to extensions, so `co.uk` cannot
    // be distinguished from a real domain label. Bundling the PSL is the only
    // real fix; until then this is the honest, known-wrong answer.
    expect(getDomainRoot('example.co.uk')).toBe('co');
  });

  it('is implemented once and delegated to by all three surfaces', () => {
    // The dashboard, popup, and side panel used to carry byte-identical copies
    // that had to be patched in lockstep; a prior fix had to touch all three.
    for (const file of ['pages/dashboard.js', 'pages/popup.js', 'pages/sidepanel.js']) {
      const src = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(src, `${file} should delegate to the shared helper`).toContain('SharedUtils.getDomainRoot(domain)');
      expect(src, `${file} must not reintroduce the nonexistent publicSuffix API`).not.toContain('publicSuffix');
    }
  });

  it('keeps the shared helper free of the nonexistent browser.publicSuffix API', () => {
    const shared = readFileSync(resolve(process.cwd(), 'shared/utils.js'), 'utf8');
    expect(shared).not.toContain('publicSuffix');
  });
});
