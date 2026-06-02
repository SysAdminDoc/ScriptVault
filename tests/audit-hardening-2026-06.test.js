// Regression coverage for the 2026-06 deep-audit hardening pass.
// Pins: SRI fail-closed + base64url/padding tolerance, collection/profile
// stored-XSS escaping, dead-toast plumbing, and heatmap global cleanup.
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { webcrypto } from 'node:crypto';
import { verifySRI } from '../src/background/resource-loader.ts';

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

describe('Cross-device delete propagation (background.core.js sync)', () => {
  it('applies remote tombstone deletions locally and aligns empty-base merge', () => {
    const src = read('background.core.js');
    expect(src).toContain('Apply remote tombstone deletions locally');
    expect(src).toContain('existing.syncBaseCode ?? existing.code');
    expect(src).toContain('base != null && base !== localScript.code');
  });
});
