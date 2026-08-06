import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDomainRoot } from '../src/shared/utils.ts';

// getDomainRoot reduces a hostname to the label the domain badge shows.
//
// History worth keeping, because it produced two opposite mistakes:
//
// 1. A revision branched on `browser.publicSuffix.getDomain()` and this suite
//    verified it against a hand-written mock of the API. The mock proved only
//    that the code worked IF the API existed; it could not fail when it didn't,
//    and a CHANGELOG entry claimed a fix that never ran.
// 2. The branch was then deleted as "the namespace does not exist in any
//    shipping Firefox — probed absent in 154.0b1". That probe was wrong: the API
//    is gated behind the "publicSuffix" permission, which the probe (and
//    manifest-firefox.json) never declared. Re-probed in the same Firefox
//    154.0b1 with the permission declared, `getDomain('www.example.co.uk')`
//    returns `example.co.uk`; without it the namespace is undefined.
//
// So the rule is neither "mock it" nor "forbid it": the call must be
// feature-detected, the permission must be declared for the browser that has
// the API, and the fallback must stay correct where it isn't.
const shared = readFileSync(resolve(process.cwd(), 'shared/utils.js'), 'utf8');
const firefoxManifest = JSON.parse(readFileSync(resolve(process.cwd(), 'manifest-firefox.json'), 'utf8'));
const chromeManifest = JSON.parse(readFileSync(resolve(process.cwd(), 'manifest.json'), 'utf8'));

afterEach(() => {
  delete globalThis.browser;
});

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

  it('falls back to the label heuristic where no public-suffix API exists', () => {
    // Chrome has no equivalent API and Firefox 140-152 predate it, so this is
    // the shipped answer for most users. It is known-wrong for multi-level TLDs.
    expect(globalThis.browser).toBeUndefined();
    expect(getDomainRoot('example.co.uk')).toBe('co');
  });

  describe('with browser.publicSuffix available', () => {
    it('uses the browser PSL, which fixes the multi-level-TLD case', () => {
      globalThis.browser = { publicSuffix: { getDomain: (host) => (host.endsWith('example.co.uk') ? 'example.co.uk' : null) } };
      expect(getDomainRoot('www.example.co.uk')).toBe('example');
      expect(getDomainRoot('deep.sub.example.co.uk')).toBe('example');
    });

    it('falls back when the API returns null for an unknown or IP host', () => {
      globalThis.browser = { publicSuffix: { getDomain: () => null } };
      expect(getDomainRoot('news.api.example.com')).toBe('example');
      expect(getDomainRoot('localhost')).toBe('localhost');
    });

    it('falls back when the API throws rather than propagating into badge rendering', () => {
      globalThis.browser = { publicSuffix: { getDomain: () => { throw new Error('permission revoked'); } } };
      expect(getDomainRoot('news.api.example.com')).toBe('example');
    });

    it('ignores a partially present namespace instead of calling a non-function', () => {
      globalThis.browser = { publicSuffix: {} };
      expect(getDomainRoot('example.com')).toBe('example');
      globalThis.browser = { publicSuffix: { getDomain: 'not-a-function' } };
      expect(getDomainRoot('example.com')).toBe('example');
    });
  });

  it('feature-detects the API instead of assuming it exists', () => {
    // The mock-only suite is what let a dead branch ship. Pin the guard itself.
    expect(shared).toContain("typeof getDomain !== \"function\"");
    expect(shared).toContain('publicSuffix');
  });

  it('declares the permission the API is gated behind, on Firefox only', () => {
    // Without this the namespace is undefined and the branch is dead again —
    // which is exactly the bug that got the previous implementation deleted.
    expect(firefoxManifest.permissions).toContain('publicSuffix');
    // Chrome has no such API; declaring it there would be a meaningless
    // permission on the store listing.
    expect(chromeManifest.permissions).not.toContain('publicSuffix');
    expect(chromeManifest.optional_permissions || []).not.toContain('publicSuffix');
  });

  it('is implemented once and delegated to by all three surfaces', () => {
    // The dashboard, popup, and side panel used to carry byte-identical copies
    // that had to be patched in lockstep; a prior fix had to touch all three.
    for (const file of ['pages/dashboard.js', 'pages/popup.js', 'pages/sidepanel.js']) {
      const src = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(src, `${file} should delegate to the shared helper`).toContain('SharedUtils.getDomainRoot(domain)');
      expect(src, `${file} must not carry its own copy of the lookup`).not.toContain('publicSuffix');
    }
  });
});
