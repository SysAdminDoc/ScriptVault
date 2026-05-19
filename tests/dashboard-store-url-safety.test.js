// Regression test for the XSS-via-href fix in dashboard-store.js. The card
// renderer interpolates `pageUrl`/`codeUrl` from third-party catalog APIs into
// `<a href>` and `data-url` attributes. escapeHtml prevents tag injection but
// not `javascript:` / `data:` URLs — those need a scheme allowlist.
//
// This test extracts the `safeExternalUrl()` helper from dashboard-store.js
// and pins its behavior so a future refactor can't silently regress to raw
// pass-through.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'pages/dashboard-store.js'), 'utf8');

function extractFunction(src, name) {
  const marker = `function ${name}(`;
  const start = src.indexOf(marker);
  if (start === -1) throw new Error(`function ${name} not found`);
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

const safeExternalUrlSrc = extractFunction(source, 'safeExternalUrl');
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const safeExternalUrl = new Function(`${safeExternalUrlSrc}\nreturn safeExternalUrl;`)();

describe('safeExternalUrl (dashboard-store XSS guard)', () => {
  it('passes through http(s) URLs unchanged', () => {
    expect(safeExternalUrl('https://greasyfork.org/en/scripts/12345')).toBe(
      'https://greasyfork.org/en/scripts/12345'
    );
    expect(safeExternalUrl('http://example.com/lib.user.js')).toBe(
      'http://example.com/lib.user.js'
    );
    expect(safeExternalUrl('ftp://files.example.com/x.js')).toBe(
      'ftp://files.example.com/x.js'
    );
  });

  it('rejects javascript: URLs', () => {
    expect(safeExternalUrl('javascript:alert(1)')).toBe('');
    expect(safeExternalUrl('JaVaScRiPt:alert(1)')).toBe('');
  });

  it('rejects data:, blob:, file:, vbscript:', () => {
    expect(safeExternalUrl('data:text/html,<script>alert(1)</script>')).toBe('');
    expect(safeExternalUrl('blob:https://example.com/uuid')).toBe('');
    expect(safeExternalUrl('file:///etc/passwd')).toBe('');
    expect(safeExternalUrl('vbscript:msgbox(1)')).toBe('');
  });

  it('rejects chrome-extension: and mailto: schemes', () => {
    expect(safeExternalUrl('chrome-extension://abc/x.html')).toBe('');
    expect(safeExternalUrl('mailto:foo@example.com')).toBe('');
  });

  it('strips NUL bytes and control characters that the URL parser would otherwise skip', () => {
    expect(safeExternalUrl('\u0000javascript:alert(1)')).toBe('');
    // Tab-separated scheme — strip controls then check the prefix
    expect(safeExternalUrl('java\tscript:alert(1)')).toBe('');
  });

  it('handles malformed input without throwing', () => {
    expect(safeExternalUrl('')).toBe('');
    expect(safeExternalUrl(null)).toBe('');
    expect(safeExternalUrl(undefined)).toBe('');
    expect(safeExternalUrl(42)).toBe('');
    expect(safeExternalUrl({})).toBe('');
  });

  it('preserves relative URLs (treated as same-origin / harmless)', () => {
    // Catalog APIs do not return relative URLs, but if one slips through it's
    // inert against the active document and not a scheme bypass.
    expect(safeExternalUrl('/some/path')).toBe('/some/path');
    expect(safeExternalUrl('relative.html')).toBe('relative.html');
  });
});

describe('dashboard-store wires safeExternalUrl into pageUrl / codeUrl', () => {
  it('codeUrl/pageUrl assignment in renderCards calls safeExternalUrl', () => {
    // Source-level pin so a future refactor that re-introduces raw pass-through
    // fails this test loudly.
    const match = source.match(
      /const codeUrl = safeExternalUrl\([^)]*\);\s*\n\s*const pageUrl = safeExternalUrl\(/
    );
    expect(match).toBeTruthy();
  });
});
