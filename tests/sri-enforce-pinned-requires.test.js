// Pins the SRI "require" enforcement (roadmap P1): un-pinned @require is
// flagged in install review (warn-by-default) and refused when Security >
// Subresource Integrity is set to "require" (enforce). Hash-pinned and npm
// requires are unaffected.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  fetchRequireScript,
  hasVerifiableRequireIntegrity,
  requireCache,
} from '../src/background/resource-loader.ts';
import { SettingsManager } from '../src/modules/storage.ts';

const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('hasVerifiableRequireIntegrity', () => {
  it('treats sha256/384/512 fragments as verifiable and everything else as un-pinned', () => {
    expect(hasVerifiableRequireIntegrity('https://cdn/x.js#sha256-abc')).toBe(true);
    expect(hasVerifiableRequireIntegrity('https://cdn/x.js#sha384=abc')).toBe(true);
    expect(hasVerifiableRequireIntegrity('https://cdn/x.js#sha512-abc')).toBe(true);
    expect(hasVerifiableRequireIntegrity('https://cdn/x.js')).toBe(false);
    expect(hasVerifiableRequireIntegrity('https://cdn/x.js#md5-abc')).toBe(false);
  });
});

describe('fetchRequireScript SRI enforcement (enforcePinned)', () => {
  const originalFetch = globalThis.fetch;
  const originalDebugLog = globalThis.debugLog;

  beforeEach(() => {
    globalThis.__resetStorageMock?.();
    globalThis.debugLog = vi.fn();
    SettingsManager.cache = null;
    requireCache.clear();
    globalThis.fetch = vi.fn(async () => new Response('remote-code', { status: 200 }));
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.debugLog = originalDebugLog;
    SettingsManager.cache = null;
    requireCache.clear();
  });

  it('warn-by-default: fetches an un-pinned require when enforcement is off', async () => {
    const code = await fetchRequireScript('https://cdn.example/lib.js');
    expect(code).toBe('remote-code');
    expect(globalThis.fetch).toHaveBeenCalled();
  });

  it('require mode: refuses an un-pinned require without hitting the network', async () => {
    await SettingsManager.set('sri', 'require');

    const code = await fetchRequireScript('https://cdn.example/lib.js');

    expect(code).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('require mode: still fetches a hash-pinned require (integrity gate applies later)', async () => {
    await SettingsManager.set('sri', 'require');

    await fetchRequireScript('https://cdn.example/lib.js#sha256-abc');

    expect(globalThis.fetch).toHaveBeenCalled();
  });

  it('require mode but allowUnpinned (probe/preview) still inspects an un-pinned require', async () => {
    await SettingsManager.set('sri', 'require');

    await fetchRequireScript('https://cdn.example/lib.js', { allowUnpinned: true });

    expect(globalThis.fetch).toHaveBeenCalled();
  });
});

describe('install.js requireIsPinned + live core.ts wiring', () => {
  it('install page flags un-pinned requires and treats npm/hash as pinned', () => {
    const src = read('pages/install.js');
    const body = src.slice(src.indexOf('function requireIsPinned'));
    const fn = new Function(`${body.slice(0, body.indexOf('\n}') + 2)}; return requireIsPinned;`)();
    expect(fn('https://cdn/x.js')).toBe(false);
    expect(fn('https://cdn/x.js#sha256-abc')).toBe(true);
    expect(fn('npm:lodash')).toBe(true);
    // The dependency list surfaces an "unverified remote code" flag.
    expect(src).toContain('unverified remote code');
  });

  it('live core.ts fetchRequireScript enforces on sri === "require" and exempts receipt probes', () => {
    const core = read('background.core.js');
    expect(core).toContain("_sriSettings?.sri === 'require'");
    expect(core).toContain('allowUnpinned: true');
  });

  it('resource-loader extraction target also uses settings-driven SRI enforcement', () => {
    const src = read('src/background/resource-loader.ts');
    expect(src).toContain('SettingsManager.get()');
    expect(src).not.toContain('options.enforcePinned');
    expect(read('src/background/install-handler.ts')).toContain('allowUnpinned: true');
    expect(read('src/background/update-checker.ts')).toContain('allowUnpinned: true');
  });
});
