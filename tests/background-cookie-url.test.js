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
  // Find the opening brace of the function body
  const braceStart = src.indexOf('{', start);
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
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const isHttpCookieUrl = new Function(`${isHttpCookieUrlSrc}\nreturn isHttpCookieUrl;`)();
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const normalizeCookiePartitionKey = new Function(`${isHttpCookieUrlSrc}\n${normalizeCookiePartitionKeySrc}\nreturn normalizeCookiePartitionKey;`)();

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
