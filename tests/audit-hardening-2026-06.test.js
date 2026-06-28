// Regression coverage for the 2026-06 deep-audit hardening pass.
// Pins: SRI fail-closed + base64url/padding tolerance, collection/profile
// stored-XSS escaping, dead-toast plumbing, and heatmap global cleanup.
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { webcrypto } from 'node:crypto';
import { fetchRequireScript, requireCache, verifySRI } from '../src/background/resource-loader.ts';
import { matchPattern } from '../src/background/url-matcher.ts';

const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');

// Use a REAL content-sensitive digest for SRI tests. tests/setup.js may stub
// crypto.subtle.digest to a constant in some worker pools, which would make
// correct/wrong hashes indistinguishable.
async function sriBase64(algo, code) {
  const d = await webcrypto.subtle.digest(algo, new TextEncoder().encode(code));
  return Buffer.from(new Uint8Array(d)).toString('base64');
}
const toB64Url = (b64) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

describe('SRI verification — fail closed', () => {
  const code = 'console.log("payload")';
  let savedDigest;
  beforeAll(() => {
    savedDigest = globalThis.crypto.subtle.digest;
    globalThis.crypto.subtle.digest = webcrypto.subtle.digest.bind(webcrypto.subtle);
  });
  afterAll(() => { globalThis.crypto.subtle.digest = savedDigest; });

  it('returns true when no integrity is requested', async () => {
    expect(await verifySRI(code, null)).toBe(true);
    expect(await verifySRI(code, '')).toBe(true);
  });

  it('accepts a correct sha256 hash (standard, base64url, and unpadded)', async () => {
    const b64 = await sriBase64('SHA-256', code);
    expect(await verifySRI(code, `sha256-${b64}`)).toBe(true);
    expect(await verifySRI(code, `sha256-${toB64Url(b64)}`)).toBe(true);
    expect(await verifySRI(code, `sha256=${b64}`)).toBe(true); // = separator form
  });

  it('rejects a wrong sha256 hash', async () => {
    expect(await verifySRI(code, `sha256-${'A'.repeat(43)}=`)).toBe(false);
  });

  it('treats md5 / unsupported algorithms as unverifiable (allow)', async () => {
    expect(await verifySRI(code, 'md5-098f6bcd4621d373cade4e832627b4f6')).toBe(true);
  });

  it('FAILS CLOSED when the digest computation throws on a verifiable algorithm', async () => {
    const orig = globalThis.crypto.subtle.digest;
    const b64 = await sriBase64('SHA-256', code);
    globalThis.crypto.subtle.digest = () => { throw new Error('crypto unavailable'); };
    try {
      // Integrity was requested with a real algorithm but couldn't be verified —
      // must NOT accept the bytes (the previous behavior returned true).
      expect(await verifySRI(code, `sha256-${b64}`)).toBe(false);
    } finally {
      globalThis.crypto.subtle.digest = orig;
    }
  });
});

describe('@require trust-receipt fetch mode', () => {
  it('bypasses existing caches without storing probe bytes', async () => {
    const originalFetch = globalThis.fetch;
    const originalDebugLog = globalThis.debugLog;
    const url = 'https://cdn.example.com/tofu-lib.js';
    try {
      globalThis.__resetStorageMock?.();
      globalThis.debugLog = vi.fn();
      requireCache.clear();
      globalThis.fetch = vi.fn(async () => new Response('remote-v1', { status: 200 }));

      expect(await fetchRequireScript(url)).toBe('remote-v1');
      expect(requireCache.get(url)).toBe('remote-v1');

      chrome.storage.local.get.mockClear();
      chrome.storage.local.set.mockClear();
      globalThis.fetch = vi.fn(async () => new Response('remote-v2', { status: 200 }));

      expect(await fetchRequireScript(url, { bypassCache: true, cacheResult: false })).toBe('remote-v2');
      expect(chrome.storage.local.get).not.toHaveBeenCalled();
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
      expect(requireCache.get(url)).toBe('remote-v1');
    } finally {
      requireCache.clear();
      globalThis.fetch = originalFetch;
      if (originalDebugLog) globalThis.debugLog = originalDebugLog;
      else delete globalThis.debugLog;
    }
  });
});

describe('Stored-XSS escaping guards', () => {
  it('collections escape the icon field on render and in the edit input', () => {
    const src = read('pages/dashboard-collections.js');
    expect(src).toContain("escapeHtml(coll.icon || '\\u{1F4E6}')");
    expect(src).toContain('escapeHtml(editing.icon || \'\')');
    // The raw, unescaped interpolation must be gone.
    expect(src).not.toContain('${coll.icon || ');
  });

  it('profiles escape emoji and validate color in the header indicator + dropdown', () => {
    const src = read('pages/dashboard-profiles.js');
    expect(src).toContain('function _safeColor(');
    expect(src).toContain('background:${indicatorColor}');
    expect(src).toContain('_escapeHtml(active.emoji');
    expect(src).toContain('_escapeHtml(p.emoji');
    // No raw color interpolation into a style attribute remains.
    expect(src).not.toContain('style="background:${active.color}"');
  });
});

describe('Dead-toast plumbing', () => {
  it('scheduler routes toasts through the exposed dashboard UI global', () => {
    const src = read('pages/dashboard-scheduler.js');
    expect(src).toContain("window.ScriptVaultDashboardUI?.toast?.('Schedule saved'");
    expect(src).not.toContain("if (typeof showToast === 'function')");
  });

  it('theme editor falls back to the exposed dashboard UI toast', () => {
    const src = read('pages/dashboard-theme-editor.js');
    expect(src).toContain('window.ScriptVaultDashboardUI?.toast');
  });
});

describe('Heatmap global cleanup', () => {
  it('destroy() removes the global activity hook', () => {
    const src = read('pages/dashboard-heatmap.js');
    expect(src).toContain('delete window.__svRecordActivity');
  });
});

describe('Install-page @require reachability probe', () => {
  it('gates the probe fetch behind a scheme + internal-host guard', () => {
    const src = read('pages/install.js');
    expect(src).toContain('function _isProbeableDepUrl(');
    expect(src).toContain('if (!_isProbeableDepUrl(url))');
    expect(src).toContain('a === 169 && b === 254'); // cloud-metadata / link-local covered
  });
});

describe('Sidepanel null-safety parity', () => {
  it('renderAllScripts guards the list element', () => {
    const src = read('pages/sidepanel.js');
    expect(src).toContain('if (!list) return;');
  });
});

describe('matchPattern @match ReDoS guard', () => {
  it('evaluates a pathological consecutive-* @match path in well under a second', () => {
    // Pre-fix this froze the SW for ~minute per evaluated URL.
    const pattern = '*://example.com/' + '*'.repeat(40) + 'a';
    const url = 'https://example.com/' + 'b'.repeat(200);
    const urlObj = new URL(url);
    const start = Date.now();
    const result = matchPattern(pattern, url, urlObj);
    const elapsed = Date.now() - start;
    expect(result).toBe(false);
    expect(elapsed).toBeLessThan(500);
  });

  it('still matches a normal single-wildcard path', () => {
    const url = 'https://example.com/foo/bar';
    expect(matchPattern('*://example.com/*', url, new URL(url))).toBe(true);
  });
});

describe('Cloud token probe timeout', () => {
  it('routes all three provider getValidToken probes through the timeout wrapper', () => {
    const src = read('modules/sync-providers.js');
    // No raw fetch() probe should remain in a getValidToken body; all use the wrapper.
    expect(src).toMatch(/_oauthFetchWithTimeout\(\s*["']https:\/\/www\.googleapis\.com\/drive\/v3\/about/);
    expect(src).toMatch(/_oauthFetchWithTimeout\(\s*["']https:\/\/api\.dropboxapi\.com\/2\/users\/get_current_account/);
    expect(src).toMatch(/_oauthFetchWithTimeout\(\s*["']https:\/\/graph\.microsoft\.com\/v1\.0\/me/);
  });
});

describe('@crontab alarm reconciliation on in-place update', () => {
  it('drops a prior page-load registration when switching to crontab, and clears stale alarms otherwise', () => {
    const src = read('background.core.js');
    expect(src).toContain("Metadata may have just gained @crontab");
    expect(src).toContain("clear any stale crontab alarm");
  });
});

describe('ScriptValues.deleteAll init-race guard', () => {
  it('serializes deleteAll on init() before clearing the cache', () => {
    const src = read('src/modules/storage.ts');
    const idx = src.indexOf('async deleteAll(');
    expect(idx).toBeGreaterThan(-1);
    // The await init must appear at the top of deleteAll, before the IDB delete.
    const body = src.slice(idx, idx + 900);
    expect(body).toContain('await this.init(scriptId)');
    expect(body.indexOf('await this.init(scriptId)')).toBeLessThan(body.indexOf('ValuesDAO.deleteAll'));
  });
});

describe('Backup retention hardening', () => {
  it('caps restore receipts by bytes, not just by count', () => {
    const src = read('modules/backup-scheduler.js');
    expect(src).toContain('RECEIPT_BYTE_BUDGET');
    expect(src).toContain('total > RECEIPT_BYTE_BUDGET');
  });
  it('pruneOldBackups clamps maxBackups against negative/NaN values', () => {
    const src = read('modules/backup-scheduler.js');
    expect(src).toContain('Number.isFinite(rawMax) && rawMax >= 1 ? Math.floor(rawMax) : 5');
  });
});

describe('Cross-device delete propagation (CloudSync runtime)', () => {
  it('applies remote tombstone deletions locally and aligns empty-base merge', () => {
    const src = read('modules/cloud-sync.js');
    expect(src).toContain('await deleteSyncedScript(localScript.id)');
    expect(src).toContain('existing.syncBaseCode ?? existing.code');
    expect(src).toContain('base != null && base !== localScript.code');
  });
});
