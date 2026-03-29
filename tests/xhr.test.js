import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const code = readFileSync(resolve(__dirname, '../modules/xhr.js'), 'utf8');

let XhrManager;
function createFresh() {
  const fn = new Function(code + '\nreturn XhrManager;');
  return fn();
}

beforeEach(() => {
  XhrManager = createFresh();
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
