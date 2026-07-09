// Regression test for the audit fix that added scheme validation to the
// GM_cookie handlers. Loads background.core.js, extracts the pure
// isHttpCookieUrl helper, and asserts it rejects non-http(s) URLs.
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'background.core.js'), 'utf8');
const cookieHandlerSource = readFileSync(resolve(process.cwd(), 'src/background/gm-cookie-handler.ts'), 'utf8');

function extractFunction(src, name) {
  const marker = `function ${name}(`;
  const start = src.indexOf(marker);
  if (start === -1) throw new Error(`function ${name} not found`);
  const asyncPrefixStart = start - 'async '.length;
  const functionStart = asyncPrefixStart >= 0 && src.slice(asyncPrefixStart, start) === 'async '
    ? asyncPrefixStart
    : start;
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
      if (depth === 0) return src.slice(functionStart, i + 1);
    }
  }
  throw new Error(`function ${name} body did not close`);
}

const isHttpCookieUrlSrc = extractFunction(source, 'isHttpCookieUrl');
const normalizeCookiePartitionKeySrc = extractFunction(source, 'normalizeCookiePartitionKey');
const metadataFlagEnabledSrc = extractFunction(source, 'metadataFlagEnabled');
const scriptHasIsolatedCookieJarSrc = extractFunction(source, 'scriptHasIsolatedCookieJar');
const stableCookieIsolationLabelSrc = extractFunction(source, 'stableCookieIsolationLabel');
const resolveScriptCookieIsolationPartitionKeySrc = extractFunction(source, 'resolveScriptCookieIsolationPartitionKey');
const hasCookieRoutingOptionsSrc = extractFunction(source, 'hasCookieRoutingOptions');
const normalizeNetworkCookieRoutingSrc = extractFunction(source, 'normalizeNetworkCookieRouting');
const cookieHeaderFromCookiesSrc = extractFunction(source, 'cookieHeaderFromCookies');
const nextCookieRoutingRuleIdSrc = extractFunction(source, 'nextCookieRoutingRuleId');
const exactDnrRegexForUrlSrc = extractFunction(source, 'exactDnrRegexForUrl');
const withCookieRoutingUrlLockSrc = extractFunction(source, 'withCookieRoutingUrlLock');
const withCookieHeaderSessionRuleSrc = extractFunction(source, 'withCookieHeaderSessionRule');
const _srcFile = resolve(process.cwd(), 'background.core.js');
function _invoke(body) {
  try { const vm = require('node:vm'); return vm.compileFunction(body, [], { filename: _srcFile })(); } catch { return new Function(body)(); }
}
function _invokeWithParams(body, params) {
  const names = Object.keys(params);
  const values = names.map((name) => params[name]);
  try { const vm = require('node:vm'); return vm.compileFunction(body, names, { filename: _srcFile })(...values); } catch { return new Function(...names, body)(...values); }
}
const isHttpCookieUrl = _invoke(`${isHttpCookieUrlSrc}\nreturn isHttpCookieUrl;`);
const normalizeCookiePartitionKey = _invoke(`${isHttpCookieUrlSrc}\n${normalizeCookiePartitionKeySrc}\nreturn normalizeCookiePartitionKey;`);
const cookieIsolationHelpers = `${metadataFlagEnabledSrc}\n${scriptHasIsolatedCookieJarSrc}\n${stableCookieIsolationLabelSrc}\n${resolveScriptCookieIsolationPartitionKeySrc}`;
const resolveScriptCookieIsolationPartitionKey = _invoke(`${cookieIsolationHelpers}\nreturn resolveScriptCookieIsolationPartitionKey;`);
const normalizeNetworkCookieRouting = _invoke(`${isHttpCookieUrlSrc}\n${normalizeCookiePartitionKeySrc}\n${cookieIsolationHelpers}\n${hasCookieRoutingOptionsSrc}\n${normalizeNetworkCookieRoutingSrc}\nreturn normalizeNetworkCookieRouting;`);
const cookieHeaderFromCookies = _invoke(`${cookieHeaderFromCookiesSrc}\nreturn cookieHeaderFromCookies;`);
const exactDnrRegexForUrl = _invoke(`${exactDnrRegexForUrlSrc}\nreturn exactDnrRegexForUrl;`);

function createDeferred() {
  let resolvePromise;
  let rejectPromise;
  const promise = new Promise((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

async function flushMicrotasks(count = 5) {
  for (let i = 0; i < count; i += 1) {
    await Promise.resolve();
  }
}

function buildWithCookieHeaderSessionRule() {
  return _invokeWithParams(`
    let _cookieRoutingRuleSeq = 0;
    const _cookieRoutingLocks = new Map();
    ${nextCookieRoutingRuleIdSrc}
    ${exactDnrRegexForUrlSrc}
    ${withCookieRoutingUrlLockSrc}
    ${withCookieHeaderSessionRuleSrc}
    return withCookieHeaderSessionRule;
  `, { chrome: globalThis.chrome });
}

function installDnrSessionRuleMock() {
  const activeRules = new Map();
  const updateSessionRules = vi.fn(async ({ removeRuleIds = [], addRules = [] } = {}) => {
    for (const ruleId of removeRuleIds) {
      activeRules.delete(ruleId);
    }
    for (const rule of addRules) {
      activeRules.set(rule.id, rule);
    }
  });
  globalThis.chrome = { declarativeNetRequest: { updateSessionRules } };
  return {
    activeRules,
    updateSessionRules,
    cleanup() {
      delete globalThis.chrome;
    }
  };
}

function activeCookieHeaders(activeRules) {
  return [...activeRules.values()]
    .map((rule) => rule.action?.requestHeaders?.find((header) => header.header === 'Cookie')?.value)
    .filter(Boolean)
    .sort();
}

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
  it('builds deterministic per-script isolated cookie partitions', () => {
    const partition = resolveScriptCookieIsolationPartitionKey({
      id: 'script_ABC:123',
      meta: { isolationCookie: true },
    });
    expect(partition).toEqual({
      isolatedCookie: true,
      partitionKey: {
        topLevelSite: expect.stringMatching(/^https:\/\/sv-[a-z0-9]+-script-abc-123\.scriptvault\.invalid$/),
        hasCrossSiteAncestor: false,
      },
    });
    expect(resolveScriptCookieIsolationPartitionKey({
      id: 'script_ABC:123',
      meta: { isolationCookie: true },
    })).toEqual(partition);
    expect(resolveScriptCookieIsolationPartitionKey({
      id: 'script_ABC:123',
      meta: { isolationCookie: false },
    })).toEqual({ partitionKey: null });
  });

  it('auto-applies isolated partitions only when explicit routing is absent', () => {
    const script = { id: 'script_one', meta: { isolationCookie: true } };
    expect(normalizeNetworkCookieRouting({}, 'GM_xmlhttpRequest', { script, scriptId: 'script_one' })).toMatchObject({
      applies: true,
      isolatedCookie: true,
      partitionKey: {
        topLevelSite: expect.stringMatching(/^https:\/\/sv-[a-z0-9]+-script-one\.scriptvault\.invalid$/),
        hasCrossSiteAncestor: false,
      },
      storeId: '',
    });
    expect(normalizeNetworkCookieRouting({
      partitionKey: { topLevelSite: 'https://explicit.example' },
    }, 'GM_xmlhttpRequest', { script, scriptId: 'script_one' })).toMatchObject({
      applies: true,
      partitionKey: { topLevelSite: 'https://explicit.example' },
    });
  });

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

  it('serializes same-url cookie-routed DNR rules so headers cannot clobber', async () => {
    const dnr = installDnrSessionRuleMock();
    try {
      const withCookieHeaderSessionRule = buildWithCookieHeaderSessionRule();
      const firstEntered = createDeferred();
      const releaseFirst = createDeferred();
      const secondStarted = vi.fn();
      const url = 'https://example.com/account?view=1';

      const first = withCookieHeaderSessionRule(url, 'sid=first', async () => {
        expect(activeCookieHeaders(dnr.activeRules)).toEqual(['sid=first']);
        firstEntered.resolve();
        await releaseFirst.promise;
        return 'first';
      });
      await firstEntered.promise;

      const second = withCookieHeaderSessionRule(url, 'sid=second', async () => {
        secondStarted();
        expect(activeCookieHeaders(dnr.activeRules)).toEqual(['sid=second']);
        return 'second';
      });
      await flushMicrotasks();
      expect(secondStarted).not.toHaveBeenCalled();

      releaseFirst.resolve();
      await expect(Promise.all([first, second])).resolves.toEqual(['first', 'second']);
      expect(secondStarted).toHaveBeenCalledTimes(1);
      expect(dnr.activeRules.size).toBe(0);
      expect(dnr.updateSessionRules).toHaveBeenCalledTimes(4);
    } finally {
      dnr.cleanup();
    }
  });

  it('keeps different cookie-routed URLs concurrent', async () => {
    const dnr = installDnrSessionRuleMock();
    try {
      const withCookieHeaderSessionRule = buildWithCookieHeaderSessionRule();
      const firstEntered = createDeferred();
      const secondEntered = createDeferred();
      const releaseBoth = createDeferred();
      const started = [];

      const first = withCookieHeaderSessionRule('https://one.example/api', 'one=1', async () => {
        started.push('first');
        firstEntered.resolve();
        await releaseBoth.promise;
        return 'first';
      });
      await firstEntered.promise;

      const second = withCookieHeaderSessionRule('https://two.example/api', 'two=2', async () => {
        started.push('second');
        secondEntered.resolve();
        await releaseBoth.promise;
        return 'second';
      });
      await secondEntered.promise;

      expect(started).toEqual(['first', 'second']);
      expect(activeCookieHeaders(dnr.activeRules)).toEqual(['one=1', 'two=2']);
      releaseBoth.resolve();
      await expect(Promise.all([first, second])).resolves.toEqual(['first', 'second']);
      expect(dnr.activeRules.size).toBe(0);
    } finally {
      dnr.cleanup();
    }
  });
});

describe('GM_cookie handlers wire the validator', () => {
  // Source-level check so a future refactor that drops the scheme guard fails
  // loudly instead of silently re-introducing the bypass.
  it('GM_cookie_set, GM_cookie_delete, and GM_cookie_list all call isHttpCookieUrl', () => {
    const setMatch = cookieHandlerSource.match(
      /case 'GM_cookie_set':[\s\S]*?return\s*\{\s*success:\s*true/
    );
    const delMatch = cookieHandlerSource.match(
      /case 'GM_cookie_delete':[\s\S]*?return\s*\{\s*success:\s*true/
    );
    const listMatch = cookieHandlerSource.match(
      /case 'GM_cookie_list':[\s\S]*?const cookies = await cookieGetAll/
    );
    expect(setMatch?.[0]).toContain('isHttpCookieUrl');
    expect(delMatch?.[0]).toContain('isHttpCookieUrl');
    expect(listMatch?.[0]).toContain('isHttpCookieUrl');
    expect(setMatch?.[0]).toContain('enforceCookiePolicy');
    expect(delMatch?.[0]).toContain('enforceCookiePolicy');
    expect(listMatch?.[0]).toContain('enforceCookiePolicy');
    expect(cookieHandlerSource).toContain('evaluateScriptHostScopePolicy');
    expect(listMatch?.[0]).toContain('resolveCookiePolicyTarget');
    expect(setMatch?.[0]).toContain('resolveCookiePartition(data');
    expect(delMatch?.[0]).toContain('resolveCookiePartition(data');
    expect(listMatch?.[0]).toContain('resolveCookiePartition(data');
    expect(cookieHandlerSource).toContain('resolveScriptCookieIsolationPartitionKey');
    expect(setMatch?.[0]).toContain('partitionKey: partition.partitionKey');
    expect(delMatch?.[0]).toContain('partitionKey: partition.partitionKey');
    expect(listMatch?.[0]).toContain('details.partitionKey = partition.partitionKey');
  });
});
