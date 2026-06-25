import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Load both the runtime JS mirror and the TS module. We compare classifier
// outputs side-by-side so the two stay in lock step.
const runtimeJs = readFileSync(resolve(process.cwd(), 'modules/internal-host-guard.js'), 'utf8');
const _guardBody = runtimeJs + '\nreturn InternalHostGuard;';
let _guardFn;
try { const vm = require('node:vm'); _guardFn = vm.compileFunction(_guardBody, [], { filename: resolve(process.cwd(), 'modules/internal-host-guard.js') }); } catch { _guardFn = new Function(_guardBody); }
function loadRuntime() {
  // The runtime module is an IIFE-style file that declares `const InternalHostGuard`
  // at the top-level scope. Wrapping in `vm.compileFunction(...)` produces a fresh,
  // isolated copy each test so mutation (e.g., monkey-patching) cannot leak.
  return _guardFn();
}

// Dynamic import the TS module through Vitest's transformer.
const tsModule = await import('../src/background/internal-host-guard.ts');

describe('InternalHostGuard runtime/TS parity', () => {
  const cases = [
    // [url, expectOk, expectedReason]
    ['https://example.com/path', true, null],
    ['http://example.com/path', true, null], // both schemes
    ['ftp://example.com/path', false, 'unsupported-scheme'],
    ['not a url', false, 'malformed-url'],
    ['https://localhost/path', false, 'localhost-alias'],
    ['https://LOCALHOST/path', false, 'localhost-alias'],
    ['https://127.0.0.1/path', false, 'ipv4-internal'],
    ['https://127.255.255.255/path', false, 'ipv4-internal'],
    ['https://10.0.0.1/path', false, 'ipv4-internal'],
    ['https://172.16.0.1/path', false, 'ipv4-internal'],
    ['https://172.20.0.1/path', false, 'ipv4-internal'],
    ['https://172.31.255.255/path', false, 'ipv4-internal'],
    ['https://172.32.0.1/path', true, null], // outside the 172.16/12 block
    ['https://172.15.0.1/path', true, null], // outside the 172.16/12 block
    ['https://192.168.1.1/path', false, 'ipv4-internal'],
    ['https://169.254.169.254/latest/meta-data/', false, 'ipv4-internal'],
    ['https://100.64.0.1/path', false, 'ipv4-internal'],
    ['https://100.127.255.255/path', false, 'ipv4-internal'],
    ['https://100.128.0.1/path', true, null], // outside CGNAT block
    ['https://100.63.0.1/path', true, null], // below CGNAT block
    ['https://0.0.0.0/path', false, 'ipv4-internal'],
    ['https://255.255.255.255/path', false, 'ipv4-internal'],
    ['https://[::1]/path', false, 'ipv6-internal'],
    ['https://[::]/path', false, 'ipv6-internal'],
    ['https://[fe80::1]/path', false, 'ipv6-internal'],
    ['https://[fec0::1]/path', true, null], // site-local (deprecated) — not in our deny list
    ['https://[fd12:3456:789a::1]/path', false, 'ipv6-internal'],
    ['https://[fc00::1]/path', false, 'ipv6-internal'],
    ['https://[::ffff:10.0.0.1]/path', false, 'ipv6-internal'],
    ['https://[::ffff:8.8.8.8]/path', true, null],
    ['https://[2001:db8::1]/path', true, null], // documentation block — public-routable shape
    ['https://example.local/path', true, null], // bare DNS — undecidable, allowed
  ];

  for (const [url, expectOk, expectedReason] of cases) {
    it(`classifies ${url} as ${expectOk ? 'allowed' : `rejected (${expectedReason})`} — runtime + TS parity`, () => {
      const runtime = loadRuntime();
      const rt = runtime.classifyFetchUrl(url, ['http:', 'https:']);
      const ts = tsModule.classifyFetchUrl(url, ['http:', 'https:']);

      expect(rt.ok).toBe(expectOk);
      expect(ts.ok).toBe(expectOk);
      expect(rt.reason).toBe(expectedReason);
      expect(ts.reason).toBe(expectedReason);
    });
  }

  it('defaults to https-only when allowedSchemes is omitted', () => {
    const runtime = loadRuntime();
    const rtHttp = runtime.classifyFetchUrl('http://example.com/');
    const tsHttp = tsModule.classifyFetchUrl('http://example.com/');
    expect(rtHttp.ok).toBe(false);
    expect(rtHttp.reason).toBe('unsupported-scheme');
    expect(tsHttp.ok).toBe(false);
    expect(tsHttp.reason).toBe('unsupported-scheme');

    const rtHttps = runtime.classifyFetchUrl('https://example.com/');
    const tsHttps = tsModule.classifyFetchUrl('https://example.com/');
    expect(rtHttps.ok).toBe(true);
    expect(tsHttps.ok).toBe(true);
  });

  it('assertExternalFetchUrl throws on internal hosts and returns the parsed URL on success', () => {
    const runtime = loadRuntime();
    expect(() => runtime.assertExternalFetchUrl('https://127.0.0.1/', 'Test', ['http:', 'https:'])).toThrow(/Test: internal host \(ipv4-internal\)/);
    expect(() => tsModule.assertExternalFetchUrl('https://127.0.0.1/', 'Test', ['http:', 'https:'])).toThrow(/Test: internal host \(ipv4-internal\)/);

    const rtUrl = runtime.assertExternalFetchUrl('https://example.com/path', 'Test', ['http:', 'https:']);
    const tsUrl = tsModule.assertExternalFetchUrl('https://example.com/path', 'Test', ['http:', 'https:']);
    expect(rtUrl.hostname).toBe('example.com');
    expect(tsUrl.hostname).toBe('example.com');
  });

  it('classifyResponseUrl flags redirects into internal hosts (post-flight)', () => {
    const runtime = loadRuntime();
    const fakeResponse = { url: 'https://169.254.169.254/latest/meta-data/' };

    const rt = runtime.classifyResponseUrl(fakeResponse, ['http:', 'https:']);
    const ts = tsModule.classifyResponseUrl(fakeResponse, ['http:', 'https:']);
    expect(rt.ok).toBe(false);
    expect(rt.reason).toBe('ipv4-internal');
    expect(ts.ok).toBe(false);
    expect(ts.reason).toBe('ipv4-internal');
  });

  it('classifyResponseUrl returns ok when the response has no URL (mocked response)', () => {
    const runtime = loadRuntime();
    expect(runtime.classifyResponseUrl(null).ok).toBe(true);
    expect(runtime.classifyResponseUrl({}).ok).toBe(true);
    expect(tsModule.classifyResponseUrl(null).ok).toBe(true);
    expect(tsModule.classifyResponseUrl({}).ok).toBe(true);
  });

  it('rejects empty hostname (e.g. file:/// or data: URLs that slip through)', () => {
    const runtime = loadRuntime();
    // file:/// has no hostname but is also not in our allowed-scheme list, so we
    // should see unsupported-scheme first. Mirror that.
    const rt = runtime.classifyFetchUrl('file:///etc/passwd', ['http:', 'https:']);
    const ts = tsModule.classifyFetchUrl('file:///etc/passwd', ['http:', 'https:']);
    expect(rt.ok).toBe(false);
    expect(ts.ok).toBe(false);
    expect(rt.reason).toBe('unsupported-scheme');
    expect(ts.reason).toBe('unsupported-scheme');
  });
});

describe('fetchWithRetry SSRF gate (TS resource-loader)', () => {
  it('rejects internal-host @require URLs before any network I/O', async () => {
    const mod = await import('../src/background/resource-loader.ts');
    // Stub fetch so we can prove it is never invoked.
    const origFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = (() => {
      fetchCalls += 1;
      return Promise.reject(new Error('should not be called'));
    });
    try {
      await expect(mod.fetchWithRetry('https://127.0.0.1/', 0)).rejects.toThrow(/@require URL rejected/);
      expect(fetchCalls).toBe(0);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('rejects redirect targets that resolved to an internal host (post-flight)', async () => {
    const mod = await import('../src/background/resource-loader.ts');
    const origFetch = globalThis.fetch;
    // Simulate a 200 response whose final URL is now a private IP (redirect).
    const fakeResponse = new Response('console.log("captured")', { status: 200 });
    Object.defineProperty(fakeResponse, 'url', { value: 'https://10.0.0.1/payload.js', configurable: true });

    globalThis.fetch = (() => Promise.resolve(fakeResponse));
    try {
      await expect(mod.fetchWithRetry('https://example.com/payload.js', 0)).rejects.toThrow(/@require URL redirected to internal host/);
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});

describe('install/update SSRF gates (TS background modules)', () => {
  it('rejects internal-host install URLs before any network I/O', async () => {
    const mod = await import('../src/background/install-handler.ts');
    const origFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = (() => {
      fetchCalls += 1;
      return Promise.reject(new Error('should not be called'));
    });
    try {
      const result = await mod.installFromUrl('https://127.0.0.1/payload.user.js');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Script source: internal host/);
      expect(fetchCalls).toBe(0);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('rejects install redirects into internal hosts before parsing or storing', async () => {
    const mod = await import('../src/background/install-handler.ts');
    const origFetch = globalThis.fetch;
    const fakeResponse = new Response('// ==UserScript==\n// @name Redirected\n// ==/UserScript==\n', { status: 200 });
    Object.defineProperty(fakeResponse, 'url', { value: 'https://10.0.0.1/payload.user.js', configurable: true });

    globalThis.fetch = (() => Promise.resolve(fakeResponse));
    try {
      const result = await mod.installFromUrl('https://example.com/payload.user.js');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Script source redirected to internal host/);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('rejects internal-host update URLs before any network I/O', async () => {
    const mod = await import('../src/background/update-checker.ts');
    const origFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = (() => {
      fetchCalls += 1;
      return Promise.reject(new Error('should not be called'));
    });
    try {
      await expect(mod.UpdateSystem.fetchUpdateCandidate('https://127.0.0.1/update.user.js')).rejects.toThrow(/Update URL rejected/);
      expect(fetchCalls).toBe(0);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('rejects update redirects into internal hosts before reading code', async () => {
    const mod = await import('../src/background/update-checker.ts');
    const origFetch = globalThis.fetch;
    const fakeResponse = new Response('// ==UserScript==\n// @name Update\n// ==/UserScript==\n', { status: 200 });
    Object.defineProperty(fakeResponse, 'url', { value: 'https://169.254.169.254/update.user.js', configurable: true });

    globalThis.fetch = (() => Promise.resolve(fakeResponse));
    try {
      await expect(mod.UpdateSystem.fetchUpdateCandidate('https://example.com/update.user.js')).rejects.toThrow(/Update URL redirected to internal host/);
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});
