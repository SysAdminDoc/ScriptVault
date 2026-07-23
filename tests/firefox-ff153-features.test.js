import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const backgroundCore = readFileSync(resolve(ROOT, 'background.core.js'), 'utf8');
const backgroundJs = readFileSync(resolve(ROOT, 'background.js'), 'utf8');
const dashboardJs = readFileSync(resolve(ROOT, 'pages/dashboard.js'), 'utf8');

function extractFn(src, name) {
  const marker = `function ${name}(`;
  const start = src.indexOf(marker);
  if (start === -1) throw new Error(`${name} not found`);
  const braceStart = src.indexOf('{', start);
  let depth = 0;
  for (let i = braceStart; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    if (src[i] === '}') { depth -= 1; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error(`unterminated ${name}`);
}

describe('FF153: file:// scheme access diagnostic', () => {
  const isFileSchemePattern = new Function(
    `${extractFn(backgroundCore, '_isFileSchemePattern')}; return _isFileSchemePattern;`,
  )();

  it('identifies file:// match/include patterns (case-insensitive)', () => {
    expect(isFileSchemePattern('file:///*')).toBe(true);
    expect(isFileSchemePattern('file://C:/notes.html')).toBe(true);
    expect(isFileSchemePattern('FILE:///foo')).toBe(true);
    expect(isFileSchemePattern('  file:///a ')).toBe(true);
  });

  it('does not flag http/https/ftp/wildcard patterns', () => {
    expect(isFileSchemePattern('https://example.com/*')).toBe(false);
    expect(isFileSchemePattern('*://*/*')).toBe(false);
    expect(isFileSchemePattern('ftp://x/')).toBe(false);
    expect(isFileSchemePattern('')).toBe(false);
    expect(isFileSchemePattern(null)).toBe(false);
  });

  it('probes isAllowedFileSchemeAccess and attaches fileSchemeAccess to the extension status', () => {
    // Runtime wiring: getExtensionStatus reports the file-scheme diagnostic.
    expect(backgroundCore).toContain('isAllowedFileSchemeAccess');
    expect(backgroundCore).toContain('probeFileSchemeAccess');
    expect(backgroundCore).toContain('status.fileSchemeAccess = await probeFileSchemeAccess()');
  });

  it('surfaces a distinct dashboard banner when a file:// script lacks file access', () => {
    expect(dashboardJs).toContain('fileSchemeAccess');
    expect(dashboardJs).toContain('file-scheme-access-disabled');
  });
});

describe('FF153: GM_addStyle reaches open shadow roots via adoptedStyleSheets', () => {
  // Behavioral proof runs in a real engine (constructable stylesheets are
  // unavailable in jsdom); these pins guard the runtime wrapper from regressing
  // the shadow-DOM reach and its clean removal. The bug where the guard skipped
  // real-Array adoptedStyleSheets (Chromium) was caught by live-browser testing.
  it('injects the shadow-reach helpers into the generated userscript wrapper', () => {
    expect(backgroundJs).toContain('_addStyleToOpenShadowRoots');
    expect(backgroundJs).toContain('_supportsConstructableSheets');
    expect(backgroundJs).toContain('adoptedStyleSheets');
  });

  it('uses an iterable-safe guard (not Array.isArray) so real-Array roots are not skipped', () => {
    const fn = extractFn(backgroundJs, '_addStyleToOpenShadowRoots');
    expect(fn).toContain('typeof adopted[Symbol.iterator]');
    expect(fn).not.toContain('Array.isArray(sr.adoptedStyleSheets) === false');
    // Bounded DOM walk so a huge page cannot stall a heavy GM_addStyle caller.
    expect(fn).toContain('15000');
  });

  it('preserves the GM_addStyle <style>-element return and wires removal cleanup', () => {
    const gm = extractFn(backgroundJs, 'GM_addStyle');
    expect(gm).toContain('_addStyleToOpenShadowRoots(css)');
    expect(gm).toContain('_removeShadowStyleHandles');
    expect(gm).toContain('return style;');
  });
});
