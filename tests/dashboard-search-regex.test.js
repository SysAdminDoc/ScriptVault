// Phase 38.2 — TM 5.5.6234 parity: dashboard search bar accepts regex via
// `re:<pattern>` or `/pattern/flags` prefix. This test extracts the
// `parseDashboardSearchRegex` helper from pages/dashboard.js so a future
// refactor that drops the parser fails CI loudly.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'pages/dashboard.js'), 'utf8');

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

const parseSource = extractFunction(source, 'parseDashboardSearchRegex');
const _searchBody = `${parseSource}\nreturn parseDashboardSearchRegex;`;
let _searchFn;
try { const vm = require('node:vm'); _searchFn = vm.compileFunction(_searchBody, [], { filename: resolve(process.cwd(), 'pages/dashboard.js') }); } catch { _searchFn = new Function(_searchBody); }
const parseDashboardSearchRegex = _searchFn();

describe('Phase 38.2 — parseDashboardSearchRegex', () => {
  it('returns null for empty / falsy / unprefixed input', () => {
    expect(parseDashboardSearchRegex('')).toBeNull();
    expect(parseDashboardSearchRegex(null)).toBeNull();
    expect(parseDashboardSearchRegex(undefined)).toBeNull();
    expect(parseDashboardSearchRegex('plain text')).toBeNull();
    expect(parseDashboardSearchRegex('code:fetch')).toBeNull();
  });

  it('parses /pattern/flags shape honoring flags verbatim', () => {
    const a = parseDashboardSearchRegex('/foo/');
    expect(a).toEqual({ source: 'foo', flags: '' });

    const b = parseDashboardSearchRegex('/foo/i');
    expect(b).toEqual({ source: 'foo', flags: 'i' });

    const c = parseDashboardSearchRegex('/foo|bar/gi');
    expect(c).toEqual({ source: 'foo|bar', flags: 'gi' });
  });

  it('does NOT auto-add the i flag to /pattern/flags shape (user is explicit)', () => {
    const spec = parseDashboardSearchRegex('/Foo/');
    expect(spec.flags).toBe('');
    const re = new RegExp(spec.source, spec.flags);
    expect(re.test('Foo')).toBe(true);
    expect(re.test('foo')).toBe(false);
  });

  it('parses re:<pattern> shape with case-insensitive default', () => {
    const spec = parseDashboardSearchRegex('re:fetch\\(');
    expect(spec).toEqual({ source: 'fetch\\(', flags: 'i' });
    const re = new RegExp(spec.source, spec.flags);
    expect(re.test('Fetch(')).toBe(true);
    expect(re.test('FETCH(url)')).toBe(true);
  });

  it('handles regex metacharacters in the pattern body without unescaping', () => {
    const spec = parseDashboardSearchRegex('re:.*\\d+$');
    expect(spec.source).toBe('.*\\d+$');
    const re = new RegExp(spec.source, spec.flags);
    expect(re.test('script-42')).toBe(true);
    expect(re.test('no-trailing-digits')).toBe(false);
  });

  it('rejects malformed /pattern shape (missing trailing /)', () => {
    // The grammar requires a trailing slash; bare `/foo` is treated as
    // literal (returns null) so substring search takes over.
    expect(parseDashboardSearchRegex('/foo')).toBeNull();
  });

  it('rejects invalid flag chars by failing the shape match', () => {
    // /pattern/Q where Q is not one of g/i/m/s/u/y must NOT parse — it'd
    // throw a SyntaxError at RegExp construction, so we'd rather treat it
    // as a literal substring.
    expect(parseDashboardSearchRegex('/foo/Q')).toBeNull();
  });

  it('regression: compiling a malformed regex from re: shape throws at RegExp construction', () => {
    const spec = parseDashboardSearchRegex('re:(unbalanced');
    expect(spec).not.toBeNull();
    // The CALLER (getFilteredScripts) is responsible for try/catching this
    // and surfacing aria-invalid. The parser itself only matches shapes.
    expect(() => new RegExp(spec.source, spec.flags)).toThrow();
  });
});
