import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dashboardSource = readFileSync(resolve(process.cwd(), 'pages/dashboard.js'), 'utf8');

function extractConverter() {
  const start = dashboardSource.indexOf('function convertBookmarkletToUserscript(');
  const braceStart = dashboardSource.indexOf('{', start);
  let depth = 0;
  let end = braceStart;
  for (let i = braceStart; i < dashboardSource.length; i++) {
    if (dashboardSource[i] === '{') depth++;
    if (dashboardSource[i] === '}') depth--;
    if (depth === 0) { end = i + 1; break; }
  }
  const _body = `${dashboardSource.slice(start, end)}\nreturn convertBookmarkletToUserscript;`;
  let fn;
  try { const vm = require('node:vm'); fn = vm.compileFunction(_body, [], { filename: resolve(process.cwd(), 'pages/dashboard.js') }); } catch { fn = new Function(_body); }
  return fn();
}

describe('bookmarklet-to-userscript converter', () => {
  const convert = extractConverter();

  it('converts a simple bookmarklet to a userscript', () => {
    const result = convert("javascript:alert('hello')");
    expect(result).toContain('==UserScript==');
    expect(result).toContain("@match       <all_urls>");
    expect(result).toContain("@run-at      document-end");
    expect(result).toContain("alert('hello')");
    expect(result).not.toContain('javascript:');
  });

  it('decodes percent-encoded bookmarklets', () => {
    const encoded = 'javascript:alert(%22hello%20world%22)';
    const result = convert(encoded);
    expect(result).toContain('alert("hello world")');
  });

  it('handles multi-statement bookmarklets', () => {
    const multi = 'javascript:var x=1;var y=2;alert(x+y)';
    const result = convert(multi);
    expect(result).toContain('var x=1;var y=2;alert(x+y)');
    expect(result).toContain('==UserScript==');
  });

  it('returns null for empty bookmarklets', () => {
    expect(convert('javascript:')).toBeNull();
    expect(convert('javascript:void(0)')).toBeNull();
    expect(convert('javascript: void(0);')).toBeNull();
  });

  it('strips the javascript: prefix case-insensitively', () => {
    const result = convert("JAVASCRIPT:alert('test')");
    expect(result).toContain("alert('test')");
    expect(result).not.toContain('JAVASCRIPT:');
  });

  it('wires the converter into the installFromUrl flow', () => {
    const urlHandler = dashboardSource.indexOf('async function installFromUrl()');
    const handlerEnd = dashboardSource.indexOf('async function', urlHandler + 30);
    const handler = dashboardSource.slice(urlHandler, handlerEnd);

    expect(handler).toContain('javascript:');
    expect(handler).toContain('convertBookmarkletToUserscript');
    expect(handler).toContain('openEditorForScript');
  });
});
