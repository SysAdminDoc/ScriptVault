import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');

// The 2026-07 audit found several dashboard modules used a textContent→innerHTML
// escapeHtml that does NOT escape quotes, so values interpolated into HTML
// attributes (e.g. the @require title="" in the dependency graph, the snippet
// search value="") could break out of the attribute and inject event handlers.
// Every local escaper must now escape both quote characters.

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

const targets = [
  ['pages/dashboard-depgraph.js', 'escapeHtml'],
  ['pages/dashboard-snippets.js', 'escapeHTML'],
  ['pages/dashboard-templates.js', 'escHtml'],
  ['pages/dashboard-csp.js', 'escapeHtml'],
  ['pages/dashboard-sharing.js', 'escapeHtml'],
  ['pages/dashboard-gamification.js', 'esc'],
  ['pages/dashboard-cardview.js', 'escapeHtml'],
];

describe('local escapeHtml helpers escape quotes (attribute-injection guard)', () => {
  for (const [file, fnName] of targets) {
    it(`${file} :: ${fnName} escapes " and '`, () => {
      // eslint-disable-next-line no-new-func
      const fn = new Function(`${extractFn(read(file), fnName)}; return ${fnName};`)();
      const out = fn('x" onmouseover="alert(1)');
      expect(out).not.toContain('"');
      expect(out).toContain('&quot;');
      const out2 = fn("y' onclick='alert(1)");
      expect(out2).not.toContain("'");
      expect(out2).toContain('&#39;');
      // Still escapes angle brackets and ampersand.
      expect(fn('<a&b>')).toBe('&lt;a&amp;b&gt;');
    });
  }
});
