import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { compileFunction } from 'node:vm';

const modulePath = resolve(__dirname, '../modules/xhr.js');
const code = readFileSync(modulePath, 'utf8');

let XhrManager;
function createFresh() {
  const fn = compileFunction(code + '\nreturn XhrManager;', [], { filename: modulePath });
  return fn();
}

beforeEach(() => {
  XhrManager = createFresh();
});

afterEach(() => {
  for (const requestId of Array.from(XhrManager.requests.keys())) {
    XhrManager.remove(requestId);
  }
  vi.useRealTimers();
});

describe('XhrManager', () => {
  it('create() returns a request with unique ID', () => {
    const req = XhrManager.create(1, 'script1', { url: 'https://a.com' });
    expect(req.id).toMatch(/^xhr_/);
    expect(req.tabId).toBe(1);
    expect(req.scriptId).toBe('script1');
    expect(req.aborted).toBe(false);
  });

  it('create() generates unique IDs', () => {
    const req1 = XhrManager.create(1, 's1', {});
    const req2 = XhrManager.create(1, 's1', {});
    expect(req1.id).not.toBe(req2.id);
  });

  it('get() retrieves by ID', () => {
    const req = XhrManager.create(1, 's1', { url: 'x' });
    const found = XhrManager.get(req.id);
    expect(found).toBe(req);
  });

  it('get() returns undefined for missing ID', () => {
    expect(XhrManager.get('nonexistent')).toBeUndefined();
  });

  it('abort() sets aborted flag and calls controller.abort()', () => {
    const req = XhrManager.create(1, 's1', {});
    const mockController = { abort: vi.fn() };
    req.controller = mockController;
    const result = XhrManager.abort(req.id);
    expect(result).toBe(true);
    expect(req.aborted).toBe(true);
    expect(mockController.abort).toHaveBeenCalled();
  });

  it('abort() returns false for already-aborted request', () => {
    const req = XhrManager.create(1, 's1', {});
    XhrManager.abort(req.id);
    expect(XhrManager.abort(req.id)).toBe(false);
  });

  it('abort() returns false for missing request', () => {
    expect(XhrManager.abort('fake')).toBe(false);
  });

  it('remove() deletes request', () => {
    const req = XhrManager.create(1, 's1', {});
    XhrManager.remove(req.id);
    expect(XhrManager.get(req.id)).toBeUndefined();
  });

  it('auto-cleans abandoned requests after the cleanup delay', () => {
    vi.useFakeTimers();
    const req = XhrManager.create(1, 's1', {});

    vi.advanceTimersByTime(XhrManager.cleanupDelayMs - 1);
    expect(XhrManager.get(req.id)).toBe(req);

    vi.advanceTimersByTime(1);
    expect(XhrManager.get(req.id)).toBeUndefined();
  });

  it('abortByTab() aborts all requests for a tab', () => {
    const r1 = XhrManager.create(1, 's1', {});
    const r2 = XhrManager.create(1, 's2', {});
    const r3 = XhrManager.create(2, 's1', {});
    XhrManager.abortByTab(1);
    expect(XhrManager.get(r1.id)).toBeUndefined();
    expect(XhrManager.get(r2.id)).toBeUndefined();
    expect(XhrManager.get(r3.id)).toBeTruthy();
  });

  it('abortByScript() aborts all requests for a script', () => {
    XhrManager.create(1, 's1', {});
    XhrManager.create(2, 's1', {});
    XhrManager.create(1, 's2', {});
    XhrManager.abortByScript('s1');
    expect(XhrManager.getActiveCount()).toBe(1);
  });

  it('getActiveCount() tracks size', () => {
    expect(XhrManager.getActiveCount()).toBe(0);
    XhrManager.create(1, 's1', {});
    XhrManager.create(1, 's2', {});
    expect(XhrManager.getActiveCount()).toBe(2);
  });
});

describe('XhrManager.buildFetchOptions', () => {
  it('upper-cases the method and defaults to GET', () => {
    expect(XhrManager.buildFetchOptions({}).method).toBe('GET');
    expect(XhrManager.buildFetchOptions({ method: 'post' }).method).toBe('POST');
  });

  it('clones supplied headers (no aliasing the caller object)', () => {
    const headers = { Authorization: 'Bearer x' };
    const opts = XhrManager.buildFetchOptions({ headers });
    expect(opts.headers).toEqual(headers);
    opts.headers['X-Added'] = 'after';
    // Caller's original headers must not be mutated.
    expect(headers['X-Added']).toBeUndefined();
  });

  it('noCache:true sets Cache-Control + Pragma when caller did not', () => {
    const opts = XhrManager.buildFetchOptions({ noCache: true });
    expect(opts.headers['Cache-Control']).toBe('no-cache');
    expect(opts.headers['Pragma']).toBe('no-cache');
  });

  it('noCache:true respects caller-supplied Cache-Control (case-insensitive)', () => {
    const opts = XhrManager.buildFetchOptions({
      noCache: true,
      headers: { 'cache-control': 'no-store' }
    });
    expect(opts.headers['cache-control']).toBe('no-store');
    // Pragma still added because caller did not supply it
    expect(opts.headers['Pragma']).toBe('no-cache');
    // Don't add a second Cache-Control header in different casing
    const cacheKeys = Object.keys(opts.headers).filter(
      (k) => k.toLowerCase() === 'cache-control'
    );
    expect(cacheKeys).toHaveLength(1);
  });

  it('noCache:true respects caller-supplied Pragma (case-insensitive)', () => {
    const opts = XhrManager.buildFetchOptions({
      noCache: true,
      headers: { PRAGMA: 'public' }
    });
    expect(opts.headers['PRAGMA']).toBe('public');
    const pragmaKeys = Object.keys(opts.headers).filter(
      (k) => k.toLowerCase() === 'pragma'
    );
    expect(pragmaKeys).toHaveLength(1);
  });

  it('noCache:false (or absent) leaves cache headers alone', () => {
    expect(XhrManager.buildFetchOptions({}).headers).toEqual({});
    expect(XhrManager.buildFetchOptions({ noCache: false }).headers).toEqual({});
  });

  it('forwards redirect: "follow"|"error"|"manual" verbatim', () => {
    expect(XhrManager.buildFetchOptions({ redirect: 'follow' }).redirect).toBe('follow');
    expect(XhrManager.buildFetchOptions({ redirect: 'error' }).redirect).toBe('error');
    expect(XhrManager.buildFetchOptions({ redirect: 'manual' }).redirect).toBe('manual');
  });

  it('drops invalid redirect values silently', () => {
    expect(XhrManager.buildFetchOptions({ redirect: true }).redirect).toBeUndefined();
    expect(XhrManager.buildFetchOptions({ redirect: 'forward' }).redirect).toBeUndefined();
    expect(XhrManager.buildFetchOptions({ redirect: '' }).redirect).toBeUndefined();
  });

  it('omits credentials when anonymous:true', () => {
    expect(XhrManager.buildFetchOptions({ anonymous: true }).credentials).toBe('omit');
    expect(XhrManager.buildFetchOptions({}).credentials).toBe('include');
    // Truthy non-true value should still default to include (strict equality).
    expect(XhrManager.buildFetchOptions({ anonymous: 1 }).credentials).toBe('include');
  });
});

// Phase 38.11 — TM 5.5.6237 reports SW event-listener accumulation on
// repeated GM_xmlhttpRequest. ScriptVault's architecture uses
// AbortController + one-shot chrome.tabs.sendMessage (no persistent
// port.onMessage subscribers), so the TM bug class doesn't translate.
// Pin the underlying invariant: the request table + per-request cleanup
// timers always drop to zero once each request is removed.
describe('Phase 38.11 — XhrManager has no per-request listener/timer leak', () => {
  it('1000 sequential create→remove cycles leave the table empty and timers cleared', () => {
    vi.useFakeTimers();
    const created = [];
    for (let i = 0; i < 1000; i++) {
      const req = XhrManager.create(1, 'leakprobe', { url: 'https://example.test/' + i });
      created.push(req);
    }
    expect(XhrManager.getActiveCount()).toBe(1000);
    for (const req of created) XhrManager.remove(req.id);
    expect(XhrManager.getActiveCount()).toBe(0);
    // Advance past the auto-cleanup delay; nothing should be left to fire.
    vi.advanceTimersByTime(XhrManager.cleanupDelayMs + 1000);
    expect(XhrManager.getActiveCount()).toBe(0);
    vi.useRealTimers();
  });

  it('abortByScript() removes the matching requests without leaving zombie entries', () => {
    const a = XhrManager.create(1, 'scriptA', {});
    const b = XhrManager.create(1, 'scriptA', {});
    const c = XhrManager.create(1, 'scriptB', {});
    a.controller = { abort: vi.fn() };
    b.controller = { abort: vi.fn() };
    c.controller = { abort: vi.fn() };

    XhrManager.abortByScript('scriptA');

    expect(a.controller.abort).toHaveBeenCalled();
    expect(b.controller.abort).toHaveBeenCalled();
    expect(c.controller.abort).not.toHaveBeenCalled();
    expect(XhrManager.get(a.id)).toBeUndefined();
    expect(XhrManager.get(b.id)).toBeUndefined();
    expect(XhrManager.get(c.id)).toBe(c);
    expect(XhrManager.getActiveCount()).toBe(1);
  });

  it('abortByTab() removes the matching requests without leaving zombie entries', () => {
    const a = XhrManager.create(7, 's1', {});
    const b = XhrManager.create(7, 's2', {});
    const c = XhrManager.create(8, 's1', {});
    a.controller = { abort: vi.fn() };
    b.controller = { abort: vi.fn() };
    c.controller = { abort: vi.fn() };

    XhrManager.abortByTab(7);

    expect(XhrManager.get(a.id)).toBeUndefined();
    expect(XhrManager.get(b.id)).toBeUndefined();
    expect(XhrManager.get(c.id)).toBe(c);
    expect(XhrManager.getActiveCount()).toBe(1);
  });
});
