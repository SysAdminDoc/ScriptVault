import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

// Compare against the SHIPPED parser, which lives inline in
// src/background/core.ts and is generated into background.core.js.
// src/background/parser.ts is an unshipped mirror — asserting against it would
// prove nothing about what actually stores and registers a script.
function loadBackgroundParseUserscript() {
  const src = readFileSync(resolve(repoRoot, 'background.core.js'), 'utf8');
  const fnStart = src.indexOf('function parseUserscript(code)');
  expect(fnStart, 'parseUserscript in background.core.js').toBeGreaterThan(-1);

  let depth = 0;
  let fnEnd = -1;
  for (let i = src.indexOf('{', fnStart); i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) { fnEnd = i + 1; break; }
    }
  }
  expect(fnEnd).toBeGreaterThan(fnStart);

  const body = [
    src.slice(fnStart, fnEnd),
    // Collaborators the parser calls that these assertions do not exercise.
    'function parseAntifeatureDirective(){ return null; }',
    'function attachRequireMetadataMaps(){}',
    'function parseScriptConfigDirectives(){ return {}; }',
    'return parseUserscript;',
  ].join('\n');
  return new Function(body)();
}

const parseBackground = (code) => loadBackgroundParseUserscript()(code).meta;

// pages/install.js has its own metadata parser. The install review uses it to
// decide (a) whether the script is already installed — matched on name +
// namespace — and (b) whether the script asks for broad host access, which
// gates a mandatory approval step. The background parser is what actually
// stores and registers the script. Any disagreement between the two is a real
// defect: on (a) it silently creates a duplicate installation, on (b) it lets a
// script register for every site while the review page reports a narrow scope.
//
// Extract the page parser without loading the DOM-heavy module.
function loadInstallParseMetadata() {
  const src = readFileSync(resolve(repoRoot, 'pages/install.js'), 'utf8');

  const setStart = src.indexOf('const SPLITTABLE_LIST_DIRECTIVES');
  expect(setStart, 'SPLITTABLE_LIST_DIRECTIVES declaration').toBeGreaterThan(-1);
  const setEnd = src.indexOf(']);', setStart) + 3;

  const fnStart = src.indexOf('function parseMetadata(code)');
  expect(fnStart, 'parseMetadata declaration').toBeGreaterThan(-1);
  let depth = 0;
  let fnEnd = -1;
  for (let i = src.indexOf('{', fnStart); i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) { fnEnd = i + 1; break; }
    }
  }
  expect(fnEnd).toBeGreaterThan(fnStart);

  const body = [
    src.slice(setStart, setEnd),
    src.slice(fnStart, fnEnd),
    // Collaborators parseMetadata calls that are irrelevant to these assertions.
    'function parseAntifeatureDirective(){ return null; }',
    'function attachRequireMetadataMaps(){}',
    'return parseMetadata;',
  ].join('\n');
  return new Function(body)();
}

const parseMetadata = loadInstallParseMetadata();

describe('install page / background parser parity', () => {
  it('agrees on the name and namespace fallbacks used to find an existing install', () => {
    const code = [
      '// ==UserScript==',
      '// @description no name and no namespace',
      '// @match https://example.com/*',
      '// ==/UserScript==',
      'console.log(1);',
    ].join('\n');

    const page = parseMetadata(code);
    const background = parseBackground(code);

    expect(page.name).toBe(background.name);
    expect(page.namespace).toBe(background.namespace);
  });

  it('splits comma-separated @match the same way, so the broad-host gate cannot be bypassed', () => {
    const code = [
      '// ==UserScript==',
      '// @name Comma',
      '// @match https://a.example/*,*://*/*',
      '// ==/UserScript==',
    ].join('\n');

    const page = parseMetadata(code);
    const background = parseBackground(code);

    expect(page.match).toEqual(background.match);
    // The all-sites pattern must be visible as its own entry — the review page
    // derives requiresBroadHostAccess by inspecting these.
    expect(page.match).toContain('*://*/*');
  });

  it('splits comma-separated @connect the same way', () => {
    const code = [
      '// ==UserScript==',
      '// @name Connect',
      '// @connect example.com,*',
      '// ==/UserScript==',
    ].join('\n');

    expect(parseMetadata(code).connect).toEqual(parseBackground(code).connect);
    expect(parseMetadata(code).connect).toContain('*');
  });

  it('leaves single-value directives untouched', () => {
    const code = [
      '// ==UserScript==',
      '// @name Plain',
      '// @match https://example.com/*',
      '// ==/UserScript==',
    ].join('\n');

    expect(parseMetadata(code).match).toEqual(['https://example.com/*']);
  });

  it('does not split @tag, which legitimately carries commas', () => {
    const code = [
      '// ==UserScript==',
      '// @name Tagged',
      '// @tag one, two',
      '// ==/UserScript==',
    ].join('\n');

    expect(parseMetadata(code).tag).toEqual(['one, two']);
  });
});
