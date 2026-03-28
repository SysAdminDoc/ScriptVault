// ScriptVault — URL Matcher Tests
// Tests for URL matching functions from background.core.js
import { describe, it, expect } from 'vitest';

// ── Re-implement URL matching functions for testing ─────────────────────────

function isValidMatchPattern(pattern) {
  if (!pattern) return false;
  if (pattern === '<all_urls>') return true;
  const matchRegex = /^(\*|https?|file|ftp):\/\/(\*|\*\.[^/*]+|[^/*:]+(?::\d+)?)\/.*$/;
  return matchRegex.test(pattern);
}

function convertIncludeToMatch(include) {
  if (!include) return null;
  if (isValidMatchPattern(include)) return include;
  if (include === '*') return '<all_urls>';

  let pattern = include;

  if (pattern.startsWith('*://')) {
    const afterScheme = pattern.slice(4);
    if (!afterScheme.includes('/')) pattern += '/*';
    return isValidMatchPattern(pattern) ? pattern : null;
  }

  if (pattern.match(/^https?:\/\//)) {
    if (!pattern.includes('/*') && !pattern.endsWith('/')) pattern += '/*';
    return isValidMatchPattern(pattern) ? pattern : null;
  }

  if (pattern.startsWith('*.')) {
    const result = '*://' + pattern + '/*';
    return isValidMatchPattern(result) ? result : null;
  }

  if (!pattern.includes('://') && !pattern.startsWith('/')) {
    const result = '*://' + pattern + '/*';
    return isValidMatchPattern(result) ? result : null;
  }

  return null;
}

function isRegexPattern(pattern) {
  if (!pattern || !pattern.startsWith('/') || pattern.length <= 2) return false;
  const match = pattern.match(/^\/(.+?)\/([gimsuy]*)$/);
  if (!match) return false;
  return /[\\^$\[(+?{|]/.test(match[1]);
}

function parseRegexPattern(pattern) {
  const match = pattern.match(/^\/(.+)\/([gimsuy]*)$/);
  if (!match) return null;
  try {
    return new RegExp(match[1], match[2]);
  } catch (e) {
    return null;
  }
}

function matchPattern(pattern, url, urlObj) {
  if (!pattern) return false;
  if (pattern === '<all_urls>') return true;
  if (pattern === '*') return true;

  try {
    const patternMatch = pattern.match(/^(\*|https?|file|ftp):\/\/([^/]+)(\/.*)$/);
    if (!patternMatch) return false;

    const [, scheme, host, path] = patternMatch;

    if (scheme !== '*' && scheme !== urlObj.protocol.slice(0, -1)) {
      return false;
    }

    if (host !== '*') {
      const hasPort = host.includes(':');
      const urlHost = hasPort ? urlObj.host : urlObj.hostname;
      if (host.startsWith('*.')) {
        const baseDomain = host.slice(2);
        if (hasPort) {
          if (urlHost !== baseDomain && !urlHost.endsWith('.' + baseDomain)) {
            return false;
          }
        } else {
          if (urlObj.hostname !== baseDomain && !urlObj.hostname.endsWith('.' + baseDomain)) {
            return false;
          }
        }
      } else if (host !== urlHost) {
        return false;
      }
    }

    const pathRegex = new RegExp('^' + path.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
    if (!pathRegex.test(urlObj.pathname + urlObj.search)) {
      return false;
    }

    return true;
  } catch (e) {
    return false;
  }
}

function matchIncludePattern(pattern, url, urlObj) {
  if (!pattern) return false;
  if (pattern === '*') return true;

  try {
    if (isRegexPattern(pattern)) {
      const re = parseRegexPattern(pattern);
      return re ? re.test(url) : false;
    }

    let regex = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    regex = regex.replace(/^(\\\*):\/\//, '(https?|file|ftp)://');

    const re = new RegExp('^' + regex + '$', 'i');
    return re.test(url);
  } catch (e) {
    return false;
  }
}

function doesScriptMatchUrl(script, url) {
  const meta = script.meta || {};
  const settings = script.settings || {};

  try {
    const urlObj = new URL(url);

    let effectiveMatches = [];
    let effectiveIncludes = [];
    let effectiveExcludes = [];

    if (settings.useOriginalMatches !== false) {
      const origMatches = Array.isArray(meta.match) ? meta.match : (meta.match ? [meta.match] : []);
      effectiveMatches.push(...origMatches);
    }

    if (settings.userMatches && settings.userMatches.length > 0) {
      effectiveMatches.push(...settings.userMatches);
    }

    if (settings.useOriginalIncludes !== false) {
      const origIncludes = Array.isArray(meta.include) ? meta.include : (meta.include ? [meta.include] : []);
      effectiveIncludes.push(...origIncludes);
    }

    if (settings.userIncludes && settings.userIncludes.length > 0) {
      effectiveIncludes.push(...settings.userIncludes);
    }

    if (settings.useOriginalExcludes !== false) {
      const origExcludes = Array.isArray(meta.exclude) ? meta.exclude : (meta.exclude ? [meta.exclude] : []);
      effectiveExcludes.push(...origExcludes);
    }

    if (settings.userExcludes && settings.userExcludes.length > 0) {
      effectiveExcludes.push(...settings.userExcludes);
    }

    const excludeMatchPatterns = Array.isArray(meta.excludeMatch) ? meta.excludeMatch :
                          (meta.excludeMatch ? [meta.excludeMatch] : []);

    for (const pattern of effectiveExcludes) {
      if (matchIncludePattern(pattern, url, urlObj)) return false;
    }
    for (const pattern of excludeMatchPatterns) {
      if (matchPattern(pattern, url, urlObj)) return false;
    }

    for (const pattern of effectiveMatches) {
      if (matchPattern(pattern, url, urlObj)) return true;
    }
    for (const pattern of effectiveIncludes) {
      if (matchIncludePattern(pattern, url, urlObj)) return true;
    }

    return false;
  } catch (e) {
    return false;
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────

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
