// Pins the "restrict to current site" UX (roadmap P2): the popup one-click
// action that scopes a script to the current hostname, and the dashboard
// @match pattern validation on the user-matches editor.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');

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

describe('dashboard @match pattern validation', () => {
  const dashJs = read('pages/dashboard.js');
  const isValidMatchPattern = new Function(`${extractFn(dashJs, 'isValidMatchPattern')}; return isValidMatchPattern;`)();

  it('accepts valid match patterns', () => {
    for (const p of ['<all_urls>', '*://*/*', '*://example.com/*', 'https://*.example.com/path', 'http://example.com/', 'file:///*']) {
      expect(isValidMatchPattern(p), p).toBe(true);
    }
  });

  it('rejects malformed patterns', () => {
    for (const p of ['', 'example.com', 'https://example.com', 'ftp://', 'javascript://x/*', '*://*', 'not a url']) {
      expect(isValidMatchPattern(p), p).toBe(false);
    }
  });

  it('addUserPattern rejects invalid match/exclude patterns before adding', () => {
    expect(dashJs).toContain("(type === 'match' || type === 'exclude') && !isValidMatchPattern(pattern)");
    expect(dashJs).toContain('Invalid match pattern');
  });
});

describe('popup restrict-to-site action', () => {
  const popupJs = read('pages/popup.js');
  const popupHtml = read('pages/popup.html');

  it('exposes the "Only on This Site" menu item', () => {
    expect(popupHtml).toContain('data-action="restrictSite"');
    expect(popupHtml).toContain('data-i18n="popupRestrictToSite"');
  });

  it('restricts the script to the current hostname via setScriptSettings', () => {
    const handler = popupJs.slice(popupJs.indexOf('[data-action="restrictSite"]'));
    expect(handler).toContain('`*://${host}/*`');
    expect(handler).toContain('useOriginalMatches: false');
    expect(handler).toContain('userMatches: [hostPattern]');
    expect(handler).toContain("action: 'setScriptSettings'");
  });
});
