// LR-001 regression test — runtime modules/sync-providers.js
// `_oauthFetchWithTimeout` must:
//   1. Return the Response on a normal completion
//   2. Return null when the platform timeout signal fires
//   3. Return null when fetch rejects with a network error
//   4. Avoid application-owned timers that stop at response headers
//
// Extracted from the runtime file via source-text function extraction so a
// refactor that drops the guard fails CI loudly.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'modules/sync-providers.js'), 'utf8');

function extractFunction(src, name) {
  const marker = `async function ${name}(`;
  const start = src.indexOf(marker);
  if (start === -1) throw new Error(`async function ${name} not found`);
  const braceStart = src.indexOf('{', start);
  let depth = 0;
  for (let i = braceStart; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(`async function ${name} body did not close`);
}

const fnSource = extractFunction(source, '_oauthFetchWithTimeout');
// Construct a callable in a fresh closure that we can inject fetch into.
const factory = new Function('fetch', 'console', `
  ${fnSource}
  return _oauthFetchWithTimeout;
`);

const silentConsole = { warn() {} };

describe('LR-001 — _oauthFetchWithTimeout', () => {
  let originalFetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it('returns the Response on a normal completion', async () => {
    const okResp = new Response('ok', { status: 200 });
    const fetchFn = vi.fn().mockResolvedValue(okResp);
    const _oauthFetchWithTimeout = factory(fetchFn, silentConsole);

    const result = await _oauthFetchWithTimeout('https://example/', { method: 'POST' }, 'Test');
    expect(result).toBe(okResp);
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it('returns null when the platform timeout signal fires', async () => {
    // Honest fetch mock — only rejects when the supplied signal aborts.
    const fetchFn = vi.fn((url, opts) => new Promise((_, reject) => {
      const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
      if (opts?.signal?.aborted) onAbort();
      else opts?.signal?.addEventListener('abort', onAbort);
      // No resolve path — only the abort wins.
    }));
    const _oauthFetchWithTimeout = factory(fetchFn, silentConsole);

    const result = await _oauthFetchWithTimeout('https://example/', {}, 'Test', 20);
    expect(result).toBeNull();
  });

  it('returns null when fetch rejects with a generic network error', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const _oauthFetchWithTimeout = factory(fetchFn, silentConsole);

    const result = await _oauthFetchWithTimeout('https://example/', {}, 'Test', 5000);
    expect(result).toBeNull();
  });

  it('uses a platform timeout signal without an application-owned timer', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    const okResp = new Response('ok', { status: 200 });
    const fetchFn = vi.fn().mockResolvedValue(okResp);
    const _oauthFetchWithTimeout = factory(fetchFn, silentConsole);

    await _oauthFetchWithTimeout('https://example/', {}, 'Test', 15000);

    expect(setTimeoutSpy).not.toHaveBeenCalled();
    expect(clearTimeoutSpy).not.toHaveBeenCalled();
  });

  it('passes the AbortSignal through into the fetch init', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    const _oauthFetchWithTimeout = factory(fetchFn, silentConsole);

    await _oauthFetchWithTimeout('https://example/', { method: 'POST', headers: { X: '1' } }, 'Test', 5000);

    expect(fetchFn).toHaveBeenCalledWith(
      'https://example/',
      expect.objectContaining({
        method: 'POST',
        headers: { X: '1' },
        signal: expect.any(AbortSignal),
      }),
    );
  });
});
