import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dashboard = readFileSync(resolve(process.cwd(), 'pages/dashboard.js'), 'utf8');

// Extract the sanitizer arrow function from source and evaluate it so we test
// the real implementation, not a copy.
function loadSanitizer() {
  const m = dashboard.match(/const sanitizeTemplateTokenValue = \(value\) => String\(value \|\| ''\)[\s\S]*?\.slice\(0, 200\);/);
  expect(m).not.toBeNull();
  // eslint-disable-next-line no-new-func
  return new Function(`${m[0]} return sanitizeTemplateTokenValue;`)();
}

describe('template token sanitization (page-controlled tab title/favicon)', () => {
  const sanitize = loadSanitizer();
  const NL = String.fromCharCode(10);
  const CR = String.fromCharCode(13);
  const NUL = String.fromCharCode(0);
  const US = String.fromCharCode(31);
  const DEL = String.fromCharCode(127);

  it('collapses CR/LF so a multi-line document.title cannot inject metadata lines', () => {
    const evil = `My Page${NL}// @grant       GM_xmlhttpRequest${NL}// @connect     evil.example`;
    const out = sanitize(evil);
    expect(out.includes(NL)).toBe(false);
    expect(out.includes(CR)).toBe(false);
    expect(`// @name        ${out}`.split(NL)).toHaveLength(1);
  });

  it('strips other C0 control characters and the DEL character', () => {
    expect(sanitize(`a${NUL}b${US}c${DEL}d`)).toBe('a b c d');
  });

  it('clamps overlong values', () => {
    expect(sanitize('x'.repeat(500)).length).toBe(200);
  });

  it('leaves ordinary titles intact', () => {
    expect(sanitize('  Example — Home  ')).toBe('Example — Home');
  });

  it('is applied to the page-controlled name and icon tokens', () => {
    expect(dashboard).toContain("'{{name}}': sanitizeTemplateTokenValue(activeTab && activeTab.title)");
    expect(dashboard).toContain("'{{icon}}': sanitizeTemplateTokenValue(activeTab && activeTab.favIconUrl)");
  });
});
