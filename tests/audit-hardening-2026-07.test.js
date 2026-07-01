import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('safeSetHtml fragment context (2026-07 regression)', () => {
  // A bare document.createRange().createContextualFragment() parses in
  // document context and silently drops <td>/<tr>/<option> cells. Every
  // safeSetHtml/htmlToFragment helper must anchor the range in the target
  // element via selectNodeContents so table markup survives.
  const pages = [
    'pages/dashboard.js',
    'pages/popup.js',
    'pages/install.js',
    'pages/devtools-panel.js',
    'pages/dashboard-cardview.js',
    'pages/dashboard-chains.js',
    'pages/dashboard-collections.js',
    'pages/dashboard-store.js',
    'pages/dashboard-snippets.js',
    'pages/dashboard-heatmap.js',
    'pages/dashboard-scheduler.js',
    'pages/dashboard-theme-editor.js',
  ];

  for (const page of pages) {
    it(`${page} anchors the fragment parse range`, () => {
      const src = read(page);
      expect(src).toContain('selectNodeContents');
      // No un-anchored one-liner should remain.
      expect(src).not.toContain(
        "el.replaceChildren(document.createRange().createContextualFragment(String(html ?? '')));",
      );
    });
  }
});

describe('Script chains use the real background API (2026-07 regression)', () => {
  const src = read('pages/dashboard-chains.js');
  it('runs steps via runScriptNow, not the non-existent executeScript action', () => {
    expect(src).toContain("action: 'runScriptNow'");
    expect(src).not.toContain("action: 'executeScript'");
  });
  it('loads the script list from the getScripts message, not legacy storage', () => {
    expect(src).toContain("action: 'getScripts'");
    expect(src).not.toContain("chrome.storage.local.get('userscripts')");
  });
  it('rejects failed steps so the retry loop can engage', () => {
    expect(src).toContain('reject(new Error');
  });
  it('uses the chain-link glyph, not a baseball', () => {
    expect(src).not.toContain('&#9918;');
    expect(src).toContain('&#9939;');
  });
});

describe('Context-menu script execution isolation (2026-07 regression)', () => {
  it('runs context-menu scripts through the shared USER_SCRIPT-world helper', () => {
    const src = read('background.core.js');
    const start = src.indexOf("info.menuItemId.startsWith('scriptvault-ctx-')");
    const end = src.indexOf('// Feedback notification', start);
    const block = src.slice(start, end);
    expect(block).toContain('executeWrappedScriptInTab');
    expect(block).not.toContain('chrome.scripting.executeScript');
  });
});

describe('Sync crypto KDF iteration cap (2026-07 regression)', () => {
  it('rejects out-of-range declared iteration counts on decrypt', () => {
    const src = read('modules/sync-crypto.js');
    expect(src).toContain('MAX_KDF_ITERATIONS');
    expect(src).toContain('declaredIterations > MAX_KDF_ITERATIONS');
  });
});

describe('Theme editor section headers (2026-07 regression)', () => {
  it('uses the innerHTML key (el() routes any other key to setAttribute)', () => {
    const src = read('pages/dashboard-theme-editor.js');
    expect(src).toContain("innerHTML: `<h4>${title}</h4>");
  });
});

describe('Local-date keys for heatmap and gamification (2026-07 regression)', () => {
  it('heatmap _dateKey builds the key from local date components', () => {
    const src = read('pages/dashboard-heatmap.js');
    const fn = src.slice(src.indexOf('function _dateKey'), src.indexOf('function _dateKey') + 500);
    expect(fn).toContain('getFullYear');
    expect(fn).toContain("padStart(2, '0')");
    expect(fn).not.toContain('d.toISOString()');
  });
  it('gamification todayKey builds the key from local date components', () => {
    const src = read('pages/dashboard-gamification.js');
    const fn = src.slice(src.indexOf('function todayKey'), src.indexOf('function todayKey') + 500);
    expect(fn).toContain('getFullYear');
    expect(fn).toContain("padStart(2, '0')");
    expect(fn).not.toContain('d.toISOString()');
  });
});

describe('Package includes page-loaded modules (2026-07 regression)', () => {
  const pageModules = ['modules/i18n.js', 'modules/script-config.js', 'modules/user-scripts-setup.js'];
  it('build.sh ships the page-loaded modules', () => {
    const src = read('build.sh');
    for (const m of pageModules) expect(src).toContain(m);
  });
  it('build-firefox.sh ships the page-loaded modules', () => {
    const src = read('build-firefox.sh');
    for (const m of pageModules) expect(src).toContain(m);
  });
  it('build-edge.mjs ships the page-loaded modules and the managed schema', () => {
    const src = read('scripts/build-edge.mjs');
    for (const m of pageModules) expect(src).toContain(m);
    expect(src).toContain('managed-storage-schema.json');
  });
});
