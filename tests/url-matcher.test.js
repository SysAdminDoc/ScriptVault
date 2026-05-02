// ScriptVault — URL Matcher Tests
// Tests the production matcher in src/background/url-matcher.ts directly so
// that the JS test file does not drift away from the implementation.
import { describe, it, expect } from 'vitest';
import {
  isValidMatchPattern,
  convertIncludeToMatch,
  isRegexPattern,
  matchPattern,
  matchIncludePattern,
  doesScriptMatchUrl,
  isUrlBlockedByGlobalSettings,
  MatchSet,
} from '../src/background/url-matcher.ts';

// ── isValidMatchPattern ─────────────────────────────────────────────────────

describe('isValidMatchPattern', () => {
  it('accepts <all_urls>', () => {
    expect(isValidMatchPattern('<all_urls>')).toBe(true);
  });

  it('accepts http scheme with wildcard host and path', () => {
    expect(isValidMatchPattern('http://*/*')).toBe(true);
  });

  it('accepts https scheme with specific host', () => {
    expect(isValidMatchPattern('https://example.com/*')).toBe(true);
  });

  it('accepts wildcard scheme', () => {
    expect(isValidMatchPattern('*://example.com/*')).toBe(true);
  });

  it('accepts wildcard subdomain', () => {
    expect(isValidMatchPattern('*://*.example.com/*')).toBe(true);
  });

  it('rejects file scheme with empty host', () => {
    // file:/// has no host, which the regex requires a non-empty host part
    expect(isValidMatchPattern('file:///path/*')).toBe(false);
  });

  it('accepts file scheme with host', () => {
    expect(isValidMatchPattern('file://localhost/*')).toBe(true);
  });

  it('accepts ftp scheme', () => {
    expect(isValidMatchPattern('ftp://ftp.example.com/*')).toBe(true);
  });

  it('accepts host with port', () => {
    expect(isValidMatchPattern('http://localhost:3000/*')).toBe(true);
  });

  it('accepts specific path', () => {
    expect(isValidMatchPattern('https://example.com/path/to/page')).toBe(true);
  });

  it('rejects null/undefined/empty', () => {
    expect(isValidMatchPattern(null)).toBe(false);
    expect(isValidMatchPattern(undefined)).toBe(false);
    expect(isValidMatchPattern('')).toBe(false);
  });

  it('rejects missing scheme', () => {
    expect(isValidMatchPattern('example.com/*')).toBe(false);
  });

  it('rejects invalid scheme', () => {
    expect(isValidMatchPattern('chrome://extensions/*')).toBe(false);
  });

  it('rejects missing path', () => {
    expect(isValidMatchPattern('https://example.com')).toBe(false);
  });

  it('rejects bare wildcard', () => {
    expect(isValidMatchPattern('*')).toBe(false);
  });
});

// ── convertIncludeToMatch ───────────────────────────────────────────────────

describe('convertIncludeToMatch', () => {
  it('returns null for null/empty', () => {
    expect(convertIncludeToMatch(null)).toBeNull();
    expect(convertIncludeToMatch('')).toBeNull();
  });

  it('converts bare * to <all_urls>', () => {
    expect(convertIncludeToMatch('*')).toBe('<all_urls>');
  });

  it('passes through valid match patterns unchanged', () => {
    expect(convertIncludeToMatch('https://example.com/*')).toBe('https://example.com/*');
  });

  it('appends /* to scheme-wildcard patterns without path', () => {
    expect(convertIncludeToMatch('*://example.com')).toBe('*://example.com/*');
  });

  it('appends /* to http patterns without path', () => {
    expect(convertIncludeToMatch('http://example.com')).toBe('http://example.com/*');
  });

  it('converts bare domain to match pattern', () => {
    expect(convertIncludeToMatch('example.com')).toBe('*://example.com/*');
  });

  it('converts wildcard subdomain shorthand', () => {
    expect(convertIncludeToMatch('*.example.com')).toBe('*://*.example.com/*');
  });
});

// ── isRegexPattern ──────────────────────────────────────────────────────────

describe('isRegexPattern', () => {
  it('detects regex with metacharacters', () => {
    expect(isRegexPattern('/https?:\\/\\/example\\.com/')).toBe(true);
  });

  it('detects regex with character class', () => {
    expect(isRegexPattern('/[abc]test/')).toBe(true);
  });

  it('detects regex with quantifier', () => {
    expect(isRegexPattern('/test{2}/')).toBe(true);
  });

  it('detects regex with alternation', () => {
    expect(isRegexPattern('/foo|bar/')).toBe(true);
  });

  it('detects regex with anchors', () => {
    expect(isRegexPattern('/^https:\\/\\/example\\.com$/')).toBe(true);
  });

  it('detects regex with flags', () => {
    expect(isRegexPattern('/example\\.com/i')).toBe(true);
  });

  it('rejects plain URL paths like /path/to/file/', () => {
    // This is the false-positive bug prevention: plain paths with only
    // slashes and literal chars should NOT be treated as regex
    expect(isRegexPattern('/path/to/file/')).toBe(false);
  });

  it('rejects /style.css/ (no metacharacters)', () => {
    expect(isRegexPattern('/style.css/')).toBe(false);
  });

  it('rejects null/undefined/empty', () => {
    expect(isRegexPattern(null)).toBe(false);
    expect(isRegexPattern(undefined)).toBe(false);
    expect(isRegexPattern('')).toBe(false);
  });

  it('rejects strings not wrapped in slashes', () => {
    expect(isRegexPattern('example.com')).toBe(false);
  });

  it('rejects too-short patterns', () => {
    expect(isRegexPattern('//')).toBe(false);
  });
});

// ── matchPattern (@match) ───────────────────────────────────────────────────

describe('matchPattern', () => {
  it('matches <all_urls> against any URL', () => {
    const url = 'https://example.com/page';
    const urlObj = new URL(url);
    expect(matchPattern('<all_urls>', url, urlObj)).toBe(true);
  });

  it('matches bare * against any URL', () => {
    const url = 'https://example.com/page';
    const urlObj = new URL(url);
    expect(matchPattern('*', url, urlObj)).toBe(true);
  });

  it('matches exact host and wildcard path', () => {
    const url = 'https://example.com/anything';
    const urlObj = new URL(url);
    expect(matchPattern('https://example.com/*', url, urlObj)).toBe(true);
  });

  it('does not match wrong scheme', () => {
    const url = 'http://example.com/page';
    const urlObj = new URL(url);
    expect(matchPattern('https://example.com/*', url, urlObj)).toBe(false);
  });

  it('wildcard scheme matches http and https', () => {
    const httpUrl = 'http://example.com/page';
    const httpsUrl = 'https://example.com/page';
    expect(matchPattern('*://example.com/*', httpUrl, new URL(httpUrl))).toBe(true);
    expect(matchPattern('*://example.com/*', httpsUrl, new URL(httpsUrl))).toBe(true);
  });

  it('does not match wrong host', () => {
    const url = 'https://other.com/page';
    const urlObj = new URL(url);
    expect(matchPattern('https://example.com/*', url, urlObj)).toBe(false);
  });

  it('wildcard subdomain matches subdomains', () => {
    const url = 'https://sub.example.com/page';
    const urlObj = new URL(url);
    expect(matchPattern('https://*.example.com/*', url, urlObj)).toBe(true);
  });

  it('wildcard subdomain matches the base domain itself', () => {
    const url = 'https://example.com/page';
    const urlObj = new URL(url);
    expect(matchPattern('https://*.example.com/*', url, urlObj)).toBe(true);
  });

  it('wildcard subdomain matches deeply nested subdomains', () => {
    const url = 'https://a.b.c.example.com/page';
    const urlObj = new URL(url);
    expect(matchPattern('https://*.example.com/*', url, urlObj)).toBe(true);
  });

  it('wildcard host matches any host', () => {
    const url = 'https://anything.com/page';
    const urlObj = new URL(url);
    expect(matchPattern('https://*/*', url, urlObj)).toBe(true);
  });

  it('specific path matches exactly', () => {
    const url = 'https://example.com/specific/path';
    const urlObj = new URL(url);
    expect(matchPattern('https://example.com/specific/path', url, urlObj)).toBe(true);
  });

  it('specific path does not match different path', () => {
    const url = 'https://example.com/other/path';
    const urlObj = new URL(url);
    expect(matchPattern('https://example.com/specific/path', url, urlObj)).toBe(false);
  });

  it('path wildcard matches query strings', () => {
    const url = 'https://example.com/page?q=test&lang=en';
    const urlObj = new URL(url);
    expect(matchPattern('https://example.com/*', url, urlObj)).toBe(true);
  });

  it('handles port in host pattern', () => {
    const url = 'http://localhost:3000/api/data';
    const urlObj = new URL(url);
    expect(matchPattern('http://localhost:3000/*', url, urlObj)).toBe(true);
  });

  it('does not match wrong port', () => {
    const url = 'http://localhost:8080/api';
    const urlObj = new URL(url);
    expect(matchPattern('http://localhost:3000/*', url, urlObj)).toBe(false);
  });

  it('returns false for null/empty pattern', () => {
    const url = 'https://example.com/';
    const urlObj = new URL(url);
    expect(matchPattern(null, url, urlObj)).toBe(false);
    expect(matchPattern('', url, urlObj)).toBe(false);
  });

  it('returns false for invalid pattern format', () => {
    const url = 'https://example.com/';
    const urlObj = new URL(url);
    expect(matchPattern('not a pattern', url, urlObj)).toBe(false);
  });
});

// ── matchIncludePattern (@include) ──────────────────────────────────────────

describe('matchIncludePattern', () => {
  it('bare * matches any URL', () => {
    const url = 'https://example.com/page';
    const urlObj = new URL(url);
    expect(matchIncludePattern('*', url, urlObj)).toBe(true);
  });

  it('glob with * wildcard matches', () => {
    const url = 'https://example.com/anything/here';
    const urlObj = new URL(url);
    expect(matchIncludePattern('https://example.com/*', url, urlObj)).toBe(true);
  });

  it('glob with ? wildcard matches single char', () => {
    const url = 'https://example.com/ab';
    const urlObj = new URL(url);
    expect(matchIncludePattern('https://example.com/a?', url, urlObj)).toBe(true);
  });

  it('? wildcard does not match zero chars', () => {
    const url = 'https://example.com/a';
    const urlObj = new URL(url);
    expect(matchIncludePattern('https://example.com/a?', url, urlObj)).toBe(false);
  });

  it('scheme wildcard *:// matches http and https', () => {
    const httpUrl = 'http://example.com/page';
    const httpsUrl = 'https://example.com/page';
    expect(matchIncludePattern('*://example.com/*', httpUrl, new URL(httpUrl))).toBe(true);
    expect(matchIncludePattern('*://example.com/*', httpsUrl, new URL(httpsUrl))).toBe(true);
  });

  it('regex pattern matches URL', () => {
    const url = 'https://example.com/page';
    const urlObj = new URL(url);
    expect(matchIncludePattern('/https?:\\/\\/example\\.com/', url, urlObj)).toBe(true);
  });

  it('regex pattern with flags', () => {
    const url = 'https://EXAMPLE.COM/page';
    const urlObj = new URL(url);
    expect(matchIncludePattern('/https?:\\/\\/example\\.com/i', url, urlObj)).toBe(true);
  });

  it('regex does not match non-matching URL', () => {
    const url = 'https://other.com/page';
    const urlObj = new URL(url);
    expect(matchIncludePattern('/https?:\\/\\/example\\.com/', url, urlObj)).toBe(false);
  });

  it('returns false for null pattern', () => {
    const url = 'https://example.com/';
    const urlObj = new URL(url);
    expect(matchIncludePattern(null, url, urlObj)).toBe(false);
  });

  it('glob matching is case-insensitive', () => {
    const url = 'HTTPS://EXAMPLE.COM/PAGE';
    const urlObj = new URL(url);
    // URL constructor lowercases the scheme and host, so the actual url string stays uppercase
    // but the glob regex uses 'i' flag
    expect(matchIncludePattern('https://example.com/*', url, urlObj)).toBe(true);
  });

  it('matches URL with fragment (glob gets full URL)', () => {
    const url = 'https://example.com/page#section';
    const urlObj = new URL(url);
    expect(matchIncludePattern('*://example.com/*', url, urlObj)).toBe(true);
  });

  it('collapses runaway `*` repeats to avoid catastrophic backtracking', () => {
    // Without the `*+ → *` collapse this regex would generate `(.*){N}` which
    // is the textbook ReDoS pattern. The collapse keeps it linear-time.
    const url = 'https://example.com/payload';
    const urlObj = new URL(url);
    const evil = '*'.repeat(80) + '://example.com/' + '*'.repeat(80);
    const start = Date.now();
    matchIncludePattern(evil, url, urlObj);
    const elapsed = Date.now() - start;
    // Should be effectively instant — well under 100ms even on a slow box.
    expect(elapsed).toBeLessThan(500);
  });
});

// ── doesScriptMatchUrl (integration) ────────────────────────────────────────

describe('doesScriptMatchUrl', () => {
  it('matches script with @match pattern', () => {
    const script = { meta: { match: ['https://example.com/*'] } };
    expect(doesScriptMatchUrl(script, 'https://example.com/page')).toBe(true);
  });

  it('does not match script with non-matching @match', () => {
    const script = { meta: { match: ['https://example.com/*'] } };
    expect(doesScriptMatchUrl(script, 'https://other.com/page')).toBe(false);
  });

  it('matches script with @include pattern', () => {
    const script = { meta: { include: ['*://example.com/*'] } };
    expect(doesScriptMatchUrl(script, 'https://example.com/page')).toBe(true);
  });

  it('excludes URL via @exclude', () => {
    const script = {
      meta: {
        match: ['*://example.com/*'],
        exclude: ['*://example.com/secret*']
      }
    };
    expect(doesScriptMatchUrl(script, 'https://example.com/page')).toBe(true);
    expect(doesScriptMatchUrl(script, 'https://example.com/secret/admin')).toBe(false);
  });

  it('excludes URL via @exclude-match (excludeMatch)', () => {
    const script = {
      meta: {
        match: ['*://example.com/*'],
        excludeMatch: ['*://example.com/admin/*']
      }
    };
    expect(doesScriptMatchUrl(script, 'https://example.com/page')).toBe(true);
    expect(doesScriptMatchUrl(script, 'https://example.com/admin/settings')).toBe(false);
  });

  it('respects user-added @match patterns in settings', () => {
    const script = {
      meta: { match: [] },
      settings: { userMatches: ['https://custom.com/*'] }
    };
    expect(doesScriptMatchUrl(script, 'https://custom.com/page')).toBe(true);
  });

  it('respects user-added @include patterns in settings', () => {
    const script = {
      meta: { match: [] },
      settings: { userIncludes: ['*://custom.com/*'] }
    };
    expect(doesScriptMatchUrl(script, 'https://custom.com/page')).toBe(true);
  });

  it('respects user-added @exclude patterns in settings', () => {
    const script = {
      meta: { match: ['*://example.com/*'] },
      settings: { userExcludes: ['*://example.com/blocked*'] }
    };
    expect(doesScriptMatchUrl(script, 'https://example.com/blocked/page')).toBe(false);
  });

  it('disabling original matches via settings', () => {
    const script = {
      meta: { match: ['https://example.com/*'] },
      settings: { useOriginalMatches: false }
    };
    expect(doesScriptMatchUrl(script, 'https://example.com/page')).toBe(false);
  });

  it('disabling original includes via settings', () => {
    const script = {
      meta: { include: ['*://example.com/*'] },
      settings: { useOriginalIncludes: false }
    };
    expect(doesScriptMatchUrl(script, 'https://example.com/page')).toBe(false);
  });

  it('disabling original excludes via settings', () => {
    const script = {
      meta: {
        match: ['*://example.com/*'],
        exclude: ['*://example.com/blocked*']
      },
      settings: { useOriginalExcludes: false }
    };
    // With original excludes disabled, the excluded URL should now match
    expect(doesScriptMatchUrl(script, 'https://example.com/blocked/page')).toBe(true);
  });

  it('returns false for invalid URL', () => {
    const script = { meta: { match: ['*://example.com/*'] } };
    expect(doesScriptMatchUrl(script, 'not-a-url')).toBe(false);
  });

  it('handles script with no meta gracefully', () => {
    const script = {};
    expect(doesScriptMatchUrl(script, 'https://example.com/')).toBe(false);
  });

  it('handles meta.match as single string (not array)', () => {
    const script = { meta: { match: 'https://example.com/*' } };
    expect(doesScriptMatchUrl(script, 'https://example.com/page')).toBe(true);
  });

  it('handles URL with query string', () => {
    const script = { meta: { match: ['https://example.com/*'] } };
    expect(doesScriptMatchUrl(script, 'https://example.com/search?q=test')).toBe(true);
  });

  it('handles IDN domains via punycode', () => {
    // URL constructor converts IDN to punycode
    const script = { meta: { match: ['*://xn--e1afmapc.xn--p1ai/*'] } };
    expect(doesScriptMatchUrl(script, 'https://xn--e1afmapc.xn--p1ai/page')).toBe(true);
  });
});

// ── isUrlBlockedByGlobalSettings ────────────────────────────────────────────

describe('isUrlBlockedByGlobalSettings', () => {
  it('returns false when no global filters configured', () => {
    expect(isUrlBlockedByGlobalSettings('https://example.com/', {})).toBe(false);
  });

  it('blocks URLs whose hostname is in deniedHosts', () => {
    expect(
      isUrlBlockedByGlobalSettings('https://blocked.com/page', { deniedHosts: ['blocked.com'] })
    ).toBe(true);
  });

  it('blocks subdomains of denied hosts via suffix match', () => {
    expect(
      isUrlBlockedByGlobalSettings('https://api.blocked.com/v1', { deniedHosts: ['blocked.com'] })
    ).toBe(true);
  });

  it('does not match unrelated hosts via suffix coincidence', () => {
    // "notblocked.com" must NOT match a denial of "blocked.com"
    expect(
      isUrlBlockedByGlobalSettings('https://notblocked.com/', { deniedHosts: ['blocked.com'] })
    ).toBe(false);
  });

  it('whitelist mode blocks anything not on the whitelist', () => {
    const settings = {
      pageFilterMode: 'whitelist',
      whitelistedPages: '*://example.com/*\n*://allowed.org/*',
    };
    expect(isUrlBlockedByGlobalSettings('https://example.com/page', settings)).toBe(false);
    expect(isUrlBlockedByGlobalSettings('https://allowed.org/page', settings)).toBe(false);
    expect(isUrlBlockedByGlobalSettings('https://other.com/page', settings)).toBe(true);
  });

  it('blacklist mode blocks listed patterns', () => {
    const settings = {
      pageFilterMode: 'blacklist',
      blacklistedPages: '*://blocked.com/*',
    };
    expect(isUrlBlockedByGlobalSettings('https://blocked.com/page', settings)).toBe(true);
    expect(isUrlBlockedByGlobalSettings('https://allowed.com/page', settings)).toBe(false);
  });

  it('returns false on malformed URLs (treated as not-blocked)', () => {
    expect(isUrlBlockedByGlobalSettings('not-a-url', { deniedHosts: ['x'] })).toBe(false);
  });
});

// ── MatchSet (Phase 4.2) ────────────────────────────────────────────────────

describe('MatchSet', () => {
  function script(id, meta, settings) {
    return { id, meta: meta || {}, settings: settings || {} };
  }

  it('returns no candidates for empty script set', () => {
    const set = new MatchSet([]);
    expect(set.getCandidates('https://example.com/')).toEqual([]);
    expect(set.size).toBe(0);
  });

  it('indexes scripts by hostname so unrelated hosts are filtered out', () => {
    const a = script('a', { match: ['https://example.com/*'] });
    const b = script('b', { match: ['https://other.org/*'] });
    const set = new MatchSet([a, b]);

    const candidates = set.getCandidates('https://example.com/page');
    expect(candidates).toContain(a);
    expect(candidates).not.toContain(b);
  });

  it('indexes wildcard-subdomain patterns under their base host', () => {
    const a = script('a', { match: ['https://*.example.com/*'] });
    const set = new MatchSet([a]);

    // Base host hits the index directly.
    expect(set.getCandidates('https://example.com/x')).toContain(a);
    // Subdomain walks suffixes up to the indexed base host.
    expect(set.getCandidates('https://api.v2.example.com/x')).toContain(a);
    // Unrelated host does not.
    expect(set.getCandidates('https://other.com/x')).not.toContain(a);
  });

  it('treats <all_urls> and bare * as universal candidates', () => {
    const a = script('a', { match: ['<all_urls>'] });
    const b = script('b', { include: ['*'] });
    const c = script('c', { match: ['https://example.com/*'] });
    const set = new MatchSet([a, b, c]);

    // Universal scripts match every host.
    const cands = set.getCandidates('https://anywhere.example.org/page');
    expect(cands).toContain(a);
    expect(cands).toContain(b);
    // Unrelated host-bound script does not.
    expect(cands).not.toContain(c);
  });

  it('treats regex @include patterns as universal (no false negatives)', () => {
    const a = script('a', { include: ['/example\\.com/'] });
    const set = new MatchSet([a]);
    // We can't statically extract a host from a regex, so the script lands in
    // the universal bucket and gets candidate-tested for every URL.
    expect(set.getCandidates('https://example.com/')).toContain(a);
    expect(set.getCandidates('https://anywhere.org/')).toContain(a);
  });

  it('skips scripts with no positive patterns at all', () => {
    const a = script('a', { match: [], include: [] });
    const set = new MatchSet([a]);
    expect(set.getCandidates('https://example.com/')).toEqual([]);
  });

  it('respects userMatches added via settings', () => {
    const a = script(
      'a',
      { match: [] },
      { userMatches: ['https://added-by-user.com/*'] }
    );
    const set = new MatchSet([a]);
    expect(set.getCandidates('https://added-by-user.com/x')).toContain(a);
    expect(set.getCandidates('https://other.com/x')).not.toContain(a);
  });

  it('honours useOriginalMatches: false (script is not host-indexed)', () => {
    const a = script(
      'a',
      { match: ['https://example.com/*'] },
      { useOriginalMatches: false }
    );
    const set = new MatchSet([a]);
    expect(set.getCandidates('https://example.com/')).not.toContain(a);
  });

  it('strips ports for indexing (port comparison happens in matchPattern)', () => {
    const a = script('a', { match: ['http://localhost:3000/*'] });
    const set = new MatchSet([a]);
    expect(set.getCandidates('http://localhost:3000/api')).toContain(a);
  });

  it('handles the same script appearing under multiple hosts only once', () => {
    const a = script('a', {
      match: ['https://example.com/*', 'https://other.org/*'],
    });
    const set = new MatchSet([a]);
    const candidates = set.getCandidates('https://example.com/');
    // Single entry — no duplicate from being indexed twice.
    expect(candidates.filter((s) => s === a)).toHaveLength(1);
  });

  it('falls back to universal-only candidates on unparseable URLs', () => {
    const universal = script('u', { match: ['<all_urls>'] });
    const hostBound = script('h', { match: ['https://example.com/*'] });
    const set = new MatchSet([universal, hostBound]);
    const candidates = set.getCandidates('not-a-url');
    expect(candidates).toContain(universal);
    expect(candidates).not.toContain(hostBound);
  });

  it('getMatching() filters candidates through doesScriptMatchUrl', () => {
    // Same host, but excludeMatch should rule it out.
    const a = script('a', {
      match: ['https://example.com/*'],
      excludeMatch: ['https://example.com/secret*'],
    });
    const set = new MatchSet([a]);
    expect(set.getMatching('https://example.com/page')).toContain(a);
    expect(set.getMatching('https://example.com/secret/admin')).not.toContain(a);
  });

  it('getMatching() handles a realistic mixed set of 50 scripts', () => {
    const scripts = [];
    for (let i = 0; i < 25; i++) {
      scripts.push(script(`a${i}`, { match: [`https://site-${i}.com/*`] }));
    }
    for (let i = 0; i < 25; i++) {
      scripts.push(script(`b${i}`, { match: [`https://*.bigco.com/*`] }));
    }
    const set = new MatchSet(scripts);

    // Matching a site-N URL hits exactly one entry.
    const onSite7 = set.getMatching('https://site-7.com/page');
    expect(onSite7).toHaveLength(1);
    expect(onSite7[0].id).toBe('a7');

    // Matching a bigco subdomain hits all 25 b-scripts.
    const onBigco = set.getMatching('https://eu.api.bigco.com/v2');
    expect(onBigco).toHaveLength(25);
  });
});
