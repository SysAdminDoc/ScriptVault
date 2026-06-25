// Regression test for the audit fix that added scheme validation to the
// GM_cookie handlers. Loads background.core.js, extracts the pure
// isHttpCookieUrl helper, and asserts it rejects non-http(s) URLs.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'background.core.js'), 'utf8');

function extractFunction(src, name) {
  const marker = `function ${name}(`;
  const start = src.indexOf(marker);
  if (start === -1) throw new Error(`function ${name} not found`);
  // Find the opening brace of the function body, not a default parameter like `data = {}`.
  let parenDepth = 0;
  let paramsEnd = -1;
  for (let i = src.indexOf('(', start); i < src.length; i += 1) {
    if (src[i] === '(') parenDepth += 1;
    if (src[i] === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) {
        paramsEnd = i;
        break;
      }
    }
  }
  if (paramsEnd === -1) throw new Error(`function ${name} params did not close`);
  const braceStart = src.indexOf('{', paramsEnd);
  let depth = 0;
  for (let i = braceStart; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(`function ${name} body did not close`);
}

const isHttpCookieUrlSrc = extractFunction(source, 'isHttpCookieUrl');
const normalizeCookiePartitionKeySrc = extractFunction(source, 'normalizeCookiePartitionKey');
const hasCookieRoutingOptionsSrc = extractFunction(source, 'hasCookieRoutingOptions');
const normalizeNetworkCookieRoutingSrc = extractFunction(source, 'normalizeNetworkCookieRouting');
const cookieHeaderFromCookiesSrc = extractFunction(source, 'cookieHeaderFromCookies');
const exactDnrRegexForUrlSrc = extractFunction(source, 'exactDnrRegexForUrl');
const _srcFile = resolve(process.cwd(), 'background.core.js');
function _invoke(body) {
  try { const vm = require('node:vm'); return vm.compileFunction(body, [], { filename: _srcFile })(); } catch { return new Function(body)(); }
}
const isHttpCookieUrl = _invoke(`${isHttpCookieUrlSrc}\nreturn isHttpCookieUrl;`);
const normalizeCookiePartitionKey = _invoke(`${isHttpCookieUrlSrc}\n${normalizeCookiePartitionKeySrc}\nreturn normalizeCookiePartitionKey;`);
const normalizeNetworkCookieRouting = _invoke(`${isHttpCookieUrlSrc}\n${normalizeCookiePartitionKeySrc}\n${hasCookieRoutingOptionsSrc}\n${normalizeNetworkCookieRoutingSrc}\nreturn normalizeNetworkCookieRouting;`);
const cookieHeaderFromCookies = _invoke(`${cookieHeaderFromCookiesSrc}\nreturn cookieHeaderFromCookies;`);
const exactDnrRegexForUrl = _invoke(`${exactDnrRegexForUrlSrc}\nreturn exactDnrRegexForUrl;`);

describe('isHttpCookieUrl', () => {
  it('accepts http and https URLs', () => {
    expect(isHttpCookieUrl('http://example.com/')).toBe(true);
    expect(isHttpCookieUrl('https://example.com/path?q=1')).toBe(true);
    expect(isHttpCookieUrl('https://sub.example.com:8443/')).toBe(true);
  });

  it('rejects schemes that chrome.cookies.* cannot operate on', () => {
    expect(isHttpCookieUrl('chrome-extension://abc/page.html')).toBe(false);
    expect(isHttpCookieUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpCookieUrl('data:text/html,<script>x</script>')).toBe(false);
    expect(isHttpCookieUrl('blob:https://example.com/uuid')).toBe(false);
    expect(isHttpCookieUrl('file:///etc/passwd')).toBe(false);
    expect(isHttpCookieUrl('ftp://example.com/')).toBe(false);
    expect(isHttpCookieUrl('ws://example.com/')).toBe(false);
  });

  it('rejects garbage input without throwing', () => {
    expect(isHttpCookieUrl('')).toBe(false);
    expect(isHttpCookieUrl(null)).toBe(false);
    expect(isHttpCookieUrl(undefined)).toBe(false);
    expect(isHttpCookieUrl(42)).toBe(false);
    expect(isHttpCookieUrl({})).toBe(false);
    expect(isHttpCookieUrl('not a url')).toBe(false);
  });

  it('blocks NUL-byte and control-char smuggling', () => {
    // Some URL parsers ignore C0 controls; verify our parser rejects them
    // (URL constructor preserves them in pathname rather than stripping).
    expect(isHttpCookieUrl('\u0000javascript:alert(1)')).toBe(false);
    expect(isHttpCookieUrl('http:/\u0000/example.com')).toBe(false);
  });
});

describe('normalizeCookiePartitionKey', () => {
  it('accepts empty partition keys for Chrome current-partition lookup', () => {
    expect(normalizeCookiePartitionKey({})).toEqual({ partitionKey: {} });
  });

  it('normalizes topLevelSite to an http(s) origin', () => {
    expect(normalizeCookiePartitionKey({
      topLevelSite: 'https://example.com/path?q=1',
      hasCrossSiteAncestor: false,
    })).toEqual({
      partitionKey: {
        topLevelSite: 'https://example.com',
        hasCrossSiteAncestor: false,
      },
    });
  });

  it('rejects invalid partition key shapes before chrome.cookies sees them', () => {
    expect(normalizeCookiePartitionKey('https://example.com/')).toMatchObject({
      error: 'partitionKey must be an object',
    });
    expect(normalizeCookiePartitionKey({ topLevelSite: 'file:///tmp/a' })).toMatchObject({
      error: 'partitionKey.topLevelSite must be http(s)://',
    });
    expect(normalizeCookiePartitionKey({ hasCrossSiteAncestor: 'yes' })).toMatchObject({
      error: 'partitionKey.hasCrossSiteAncestor must be boolean',
    });
  });
});

describe('partition-aware network cookie routing helpers', () => {
  it('accepts partition aliases and cookie-store IDs for XHR/download routing', () => {
    expect(normalizeNetworkCookieRouting({
      partitionKey: { topLevelSite: 'https://top.example/path' },
      cookiePartition: { topLevelSite: 'https://top.example/path' },
      cookieStoreId: '1'
    }, 'GM_xmlhttpRequest')).toEqual({
      applies: true,
      partitionKey: { topLevelSite: 'https://top.example' },
      storeId: '1',
    });
  });

  it('rejects ambiguous or unsafe cookie-routing option combinations', () => {
    expect(normalizeNetworkCookieRouting({
      partitionKey: { topLevelSite: 'https://one.example' },
      cookiePartition: { topLevelSite: 'https://two.example' },
    }, 'GM_download')).toMatchObject({
      error: 'GM_download partitionKey and cookiePartition must match when both are provided',
    });
    expect(normalizeNetworkCookieRouting({
      partitionKey: { topLevelSite: 'https://one.example' },
      anonymous: true,
    }, 'GM_download')).toMatchObject({
      error: 'GM_download cookie routing cannot be combined with anonymous requests',
    });
    expect(normalizeNetworkCookieRouting({
      partitionKey: { topLevelSite: 'https://one.example' },
      cookieStoreId: 7,
    }, 'GM_xmlhttpRequest')).toMatchObject({
      error: 'GM_xmlhttpRequest cookieStoreId must be a string',
    });
  });

  it('builds a deterministic cookie header without unsafe cookie names', () => {
    expect(cookieHeaderFromCookies([
      { name: 'short', value: '1', path: '/' },
      { name: 'deep', value: '2', path: '/account/settings' },
      { name: 'bad;name', value: '3', path: '/account/settings' },
    ])).toBe('deep=2; short=1');
  });

  it('builds exact DNR regex filters and rejects overlong URLs', () => {
    expect(exactDnrRegexForUrl('https://example.com/a.b?q=(x)')).toEqual({
      regex: '^https://example\\.com/a\\.b\\?q=\\(x\\)$',
    });
    expect(exactDnrRegexForUrl(`https://example.com/${'a'.repeat(1900)}`)).toMatchObject({
      error: 'cookie-routed request URL is too long for an exact DNR guard',
    });
  });
});

describe('GM_cookie handlers wire the validator', () => {
  // Source-level check so a future refactor that drops the scheme guard fails
  // loudly instead of silently re-introducing the bypass.
  it('GM_cookie_set, GM_cookie_delete, and GM_cookie_list all call isHttpCookieUrl', () => {
    const setMatch = source.match(
      /case 'GM_cookie_set':[\s\S]*?return\s*\{\s*success:\s*true/
    );
    const delMatch = source.match(
      /case 'GM_cookie_delete':[\s\S]*?return\s*\{\s*success:\s*true/
    );
    const listMatch = source.match(
      /case 'GM_cookie_list':[\s\S]*?await chrome\.cookies\.getAll/
    );
    expect(setMatch?.[0]).toContain('isHttpCookieUrl');
    expect(delMatch?.[0]).toContain('isHttpCookieUrl');
    expect(listMatch?.[0]).toContain('isHttpCookieUrl');
    expect(setMatch?.[0]).toContain('evaluateScriptHostScopePolicy');
    expect(delMatch?.[0]).toContain('evaluateScriptHostScopePolicy');
    expect(listMatch?.[0]).toContain('evaluateScriptHostScopePolicy');
    expect(listMatch?.[0]).toContain('resolveCookiePolicyTarget');
    expect(setMatch?.[0]).toContain('normalizeCookiePartitionKey(data.partitionKey)');
    expect(delMatch?.[0]).toContain('normalizeCookiePartitionKey(data.partitionKey)');
    expect(listMatch?.[0]).toContain('normalizeCookiePartitionKey(data.partitionKey)');
    expect(setMatch?.[0]).toContain('partitionKey: partition.partitionKey');
    expect(delMatch?.[0]).toContain('partitionKey: partition.partitionKey');
    expect(listMatch?.[0]).toContain('details.partitionKey = partition.partitionKey');
  });
});
