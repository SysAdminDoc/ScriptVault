import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Extract the standalone getDomainRoot helper from popup.js (identical copies
// live in dashboard.js and sidepanel.js) and exercise both the Chrome heuristic
// fallback and the Firefox 153+ browser.publicSuffix path.
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

const popupSrc = readFileSync(resolve(process.cwd(), 'pages/popup.js'), 'utf8');
const fnSource = extractFn(popupSrc, 'getDomainRoot');

function makeGetDomainRoot(browserGlobal) {
  // Provide `browser` via a wrapping scope; undefined in the Chrome case.
  return new Function('browser', `${fnSource}; return getDomainRoot;`)(browserGlobal);
}

describe('getDomainRoot public-suffix awareness', () => {
  it('uses the label heuristic when no public-suffix API is present (Chrome)', () => {
    const getDomainRoot = makeGetDomainRoot(undefined);
    expect(getDomainRoot('example.com')).toBe('example');
    expect(getDomainRoot('www.example.com')).toBe('example');
    expect(getDomainRoot('localhost')).toBe('localhost');
    // Heuristic limitation on a multi-level TLD (documented; FF153 fixes it):
    expect(getDomainRoot('example.co.uk')).toBe('co');
  });

  it('uses browser.publicSuffix.getDomain for accurate multi-level-TLD roots (Firefox 153+)', () => {
    const browserGlobal = {
      publicSuffix: {
        getDomain: (host) => {
          if (host.endsWith('example.co.uk')) return 'example.co.uk';
          if (host.endsWith('example.com')) return 'example.com';
          return '';
        },
      },
    };
    const getDomainRoot = makeGetDomainRoot(browserGlobal);
    expect(getDomainRoot('news.example.co.uk')).toBe('example');
    expect(getDomainRoot('example.co.uk')).toBe('example');
    expect(getDomainRoot('www.example.com')).toBe('example');
  });

  it('falls back to the heuristic if the public-suffix call throws', () => {
    const browserGlobal = { publicSuffix: { getDomain: () => { throw new Error('boom'); } } };
    const getDomainRoot = makeGetDomainRoot(browserGlobal);
    expect(getDomainRoot('example.com')).toBe('example');
  });
});
